/**
 * Google Apps Script для работы с данными ЕРДР.
 *
 * ═══════════════════════════════════════════════════════════════
 *  КАК ИСПОЛЬЗОВАТЬ:
 * ═══════════════════════════════════════════════════════════════
 *
 * 1. Откройте вашу Google таблицу с данными ЕРДР
 * 2. Меню → Расширения → Apps Script
 * 3. Удалите содержимое файла Code.gs
 * 4. Вставьте ВЕСЬ этот код
 * 5. Нажмите Сохранить
 * 6. Разверните как веб-приложение (Развертывания → Новое → Веб-приложение)
 *
 * Таблица имеет 2 листа:
 *  Лист 1 — «Основная информация» (преступления)
 *  Лист 2 — «Люди» (подозреваемые/лица)
 *  Связь через поле «Номер ЕРДР»
 *
 * ═══════════════════════════════════════════════════════════════
 */

// ══════════════════════════════════════════════════════════════
//  Web App — API для карты (doGet)
// ══════════════════════════════════════════════════════════════

/**
 * Обработчик GET-запросов — возвращает данные из обоих листов как JSON.
 * Формат: { crimes: [...], people: [...] }
 */
function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();

  // Лист 1 — Основная информация (преступления)
  var crimesSheet = sheets[0];
  var crimesData = crimesSheet.getDataRange().getValues();
  var crimes = _sheetToJson(crimesData);

  // Лист 2 — Люди (если есть)
  var people = [];
  if (sheets.length >= 2) {
    var peopleSheet = sheets[1];
    var peopleData = peopleSheet.getDataRange().getValues();
    people = _sheetToJson(peopleData);
  }

  var result = { crimes: crimes, people: people };

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Преобразовать двумерный массив (заголовки + строки) в массив объектов.
 */
function _sheetToJson(data) {
  if (data.length < 2) return [];

  var headers = data[0];
  var rows = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    // Пропустить пустые строки (проверяем 2-й столбец — Номер ЕРДР)
    if (!row[1] || String(row[1]).trim() === "") continue;

    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[String(headers[j]).trim()] = row[j] !== undefined ? row[j] : "";
    }
    rows.push(obj);
  }

  return rows;
}

// ══════════════════════════════════════════════════════════════
//  Геокодирование (опционально)
// ══════════════════════════════════════════════════════════════

// Номера колонок (1-based) — обновлены для новой структуры
var COL_CITY   = 20;  // 31.Место совершения Населенный пункт
var COL_STREET = 21;  // 31.Место совершения Улица
var COL_HOUSE  = 22;  // 31.Место совершения Дом
var COL_LAT    = 25;  // 31. Место совершения (координата X)
var COL_LNG    = 26;  // 31. Место совершения (координата Y)

// Границы города Атырау
var ATYRAU_MIN_LAT = 46.92;
var ATYRAU_MAX_LAT = 47.20;
var ATYRAU_MIN_LNG = 51.75;
var ATYRAU_MAX_LNG = 52.05;

// Координата центра Атырау — если Google вернул её, значит адрес НЕ найден
var ATYRAU_CENTER_LAT = 47.0945;
var ATYRAU_CENTER_LNG = 51.9238;
var CENTER_THRESHOLD = 0.002;

function isInAtyrauBounds(lat, lng) {
  return lat >= ATYRAU_MIN_LAT && lat <= ATYRAU_MAX_LAT &&
         lng >= ATYRAU_MIN_LNG && lng <= ATYRAU_MAX_LNG;
}

function isNotCityCenter(lat, lng) {
  return Math.abs(lat - ATYRAU_CENTER_LAT) > CENTER_THRESHOLD ||
         Math.abs(lng - ATYRAU_CENTER_LNG) > CENTER_THRESHOLD;
}

function normalizeStreet(street) {
  var s = String(street).trim();
  if (/^№?\s*\d+$/.test(s)) {
    var num = s.replace(/[№\s]/g, "");
    return "микрорайон " + num;
  }
  if (/^№\s*\d+/.test(s)) {
    var num2 = s.replace(/[№\s]/g, "");
    return "микрорайон " + num2;
  }
  return s;
}

function normalizeHouse(house) {
  var h = String(house).trim();
  if (/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|GMT)\b/i.test(h)) {
    return "";
  }
  if (/\b20(2[0-9])\b/.test(h) && h.length > 10) {
    return "";
  }
  return h;
}

/**
 * Главная функция — геокодировать все строки (Лист 1).
 */
function geocodeAllRows() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var data = sheet.getDataRange().getValues();
  var updated = 0;
  var skipped = 0;
  var errors = 0;
  var alreadyDone = 0;
  var outOfBounds = 0;
  var centerHits = 0;

  for (var i = 1; i < data.length; i++) {
    var row = data[i];

    var city   = String(row[COL_CITY - 1] || "").trim().toUpperCase();
    var street = String(row[COL_STREET - 1] || "").trim();
    var house  = String(row[COL_HOUSE - 1] || "").trim();
    var lat    = row[COL_LAT - 1];
    var lng    = row[COL_LNG - 1];

    // Пропускаем если уже есть координаты
    if (lat && lng && lat !== "" && lng !== "") {
      alreadyDone++;
      continue;
    }

    // Только город Атырау с улицей и домом
    if (city !== "АТЫРАУ" || !street || !house) {
      skipped++;
      continue;
    }

    var normStreet = normalizeStreet(street);
    var normHouse = normalizeHouse(house);

    if (!normHouse) {
      errors++;
      Logger.log("✗ Строка " + (i + 1) + ": невалидный дом — '" + house + "'");
      continue;
    }

    var address;
    if (normStreet.indexOf("микрорайон") === 0) {
      address = "Казахстан, город Атырау, " + normStreet + ", дом " + normHouse;
    } else {
      address = "Казахстан, город Атырау, улица " + normStreet + ", дом " + normHouse;
    }

    try {
      Utilities.sleep(200);
      var coords = geocodeAddress(address);

      if (!coords) {
        errors++;
        Logger.log("✗ Строка " + (i + 1) + ": не найден — " + address);
        continue;
      }

      if (!isInAtyrauBounds(coords.lat, coords.lng)) {
        outOfBounds++;
        Logger.log("⚠ Строка " + (i + 1) + ": ВНЕ АТЫРАУ (" + coords.lat + ", " + coords.lng + ") — " + address);
        continue;
      }

      if (!isNotCityCenter(coords.lat, coords.lng)) {
        centerHits++;
        Logger.log("⚠ Строка " + (i + 1) + ": ЦЕНТР ГОРОДА (неточно) — " + address);
        continue;
      }

      sheet.getRange(i + 1, COL_LAT).setValue(coords.lat);
      sheet.getRange(i + 1, COL_LNG).setValue(coords.lng);
      updated++;
      Logger.log("✓ Строка " + (i + 1) + ": " + address + " → " + coords.lat + ", " + coords.lng);

    } catch (e) {
      errors++;
      Logger.log("✗ Строка " + (i + 1) + ": ошибка — " + e.message);
      if (e.message.indexOf("too many times") !== -1) {
        Utilities.sleep(5000);
      }
    }
  }

  var msg = "Готово!\n\n" +
    "Точно определено: " + updated + "\n" +
    "Уже было: " + alreadyDone + "\n" +
    "Пропущено (не Атырау / нет улицы): " + skipped + "\n" +
    "Вне границ Атырау (отклонено): " + outOfBounds + "\n" +
    "Центр города / неточно (отклонено): " + centerHits + "\n" +
    "Ошибки: " + errors;

  Logger.log(msg);
  SpreadsheetApp.getUi().alert(msg);
}

function geocodeAddress(address) {
  var geocoder = Maps.newGeocoder()
    .setRegion("kz")
    .setLanguage("ru")
    .setBounds(ATYRAU_MIN_LAT, ATYRAU_MIN_LNG, ATYRAU_MAX_LAT, ATYRAU_MAX_LNG);

  var response = geocoder.geocode(address);

  if (response.status === "OK" && response.results.length > 0) {
    var location = response.results[0].geometry.location;
    return {
      lat: Math.round(location.lat * 1000000) / 1000000,
      lng: Math.round(location.lng * 1000000) / 1000000
    };
  }

  return null;
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Геокодирование")
    .addItem("Определить координаты", "geocodeAllRows")
    .addItem("Очистить координаты", "clearCoordinates")
    .addToUi();
}

function clearCoordinates() {
  var ui = SpreadsheetApp.getUi();
  var result = ui.alert(
    "Очистить координаты?",
    "Будут удалены ВСЕ координаты.\nПродолжить?",
    ui.ButtonSet.YES_NO
  );

  if (result !== ui.Button.YES) return;

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var lastRow = sheet.getLastRow();

  if (lastRow > 1) {
    sheet.getRange(2, COL_LAT, lastRow - 1, 1).clearContent();
    sheet.getRange(2, COL_LNG, lastRow - 1, 1).clearContent();
  }

  ui.alert("Координаты очищены.");
}
