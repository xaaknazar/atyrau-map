/**
 * Google Apps Script для геокодирования адресов ЕРДР в Google Sheets.
 *
 * ═══════════════════════════════════════════════════════════════
 *  КАК ИСПОЛЬЗОВАТЬ:
 * ═══════════════════════════════════════════════════════════════
 *
 * 1. Откройте вашу Google таблицу с данными ЕРДР
 * 2. Меню → Расширения → Apps Script
 * 3. Удалите содержимое файла Code.gs
 * 4. Вставьте ВЕСЬ этот код
 * 5. Нажмите 💾 Сохранить
 * 6. Запустите: clearCoordinates() → затем geocodeAllRows()
 *    При первом запуске Google попросит разрешения — нажмите "Разрешить"
 *
 * ВАЖНО:
 * - Координаты проверяются: должны попадать в границы г. Атырау
 * - Если Google не нашёл точный адрес (вернул центр города) — помечается как ошибка
 * - Микрорайоны (№8, №20 и т.д.) преобразуются в "микрорайон 8"
 * - Пауза между запросами для соблюдения лимитов Google
 *
 * ═══════════════════════════════════════════════════════════════
 */

// Номера колонок (1-based)
var COL_CITY   = 16;  // 31.Место совершения Населенный пункт
var COL_STREET = 17;  // 31.Место совершения Улица
var COL_HOUSE  = 18;  // 31.Место совершения Дом
var COL_LAT    = 21;  // U (Широта)
var COL_LNG    = 22;  // V (Долгота)

// Границы города Атырау — координаты за пределами = ошибка геокодирования
var ATYRAU_MIN_LAT = 46.92;
var ATYRAU_MAX_LAT = 47.20;
var ATYRAU_MIN_LNG = 51.75;
var ATYRAU_MAX_LNG = 52.05;

// Координата центра Атырау — если Google вернул её, значит адрес НЕ найден
var ATYRAU_CENTER_LAT = 47.0945;
var ATYRAU_CENTER_LNG = 51.9238;
var CENTER_THRESHOLD = 0.002;  // ~200 метров от центра = "не найдено"

/**
 * Проверить что координаты в пределах Атырау (не в Алматы, не в Кокшетау и т.д.)
 */
function isInAtyrauBounds(lat, lng) {
  return lat >= ATYRAU_MIN_LAT && lat <= ATYRAU_MAX_LAT &&
         lng >= ATYRAU_MIN_LNG && lng <= ATYRAU_MAX_LNG;
}

/**
 * Проверить что координаты НЕ являются центром города (= адрес не найден)
 */
function isNotCityCenter(lat, lng) {
  return Math.abs(lat - ATYRAU_CENTER_LAT) > CENTER_THRESHOLD ||
         Math.abs(lng - ATYRAU_CENTER_LNG) > CENTER_THRESHOLD;
}

/**
 * Нормализовать название улицы для лучшего геокодирования.
 * - "№8" или "8" → "микрорайон 8"
 * - "АВАНГАРД-3" → "Авангард 3"
 * - Убрать лишние символы
 */
function normalizeStreet(street) {
  var s = String(street).trim();

  // Улица — просто число или "№число" → микрорайон
  if (/^№?\s*\d+$/.test(s)) {
    var num = s.replace(/[№\s]/g, "");
    return "микрорайон " + num;
  }

  // "№ 27" формат
  if (/^№\s*\d+/.test(s)) {
    var num2 = s.replace(/[№\s]/g, "");
    return "микрорайон " + num2;
  }

  return s;
}

/**
 * Нормализовать номер дома — убрать даты и мусор.
 * Иногда в поле "дом" попадает дата или другие данные.
 */
function normalizeHouse(house) {
  var h = String(house).trim();

  // Если это дата (содержит "Mon", "Tue", "GMT", "/" и т.д.)
  if (/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|GMT)\b/i.test(h)) {
    return "";  // Невалидный дом
  }

  // Если содержит год (2024, 2025, 2026)
  if (/\b20(2[0-9])\b/.test(h) && h.length > 10) {
    return "";  // Это дата, не номер дома
  }

  return h;
}

/**
 * Главная функция — геокодировать все строки.
 */
function geocodeAllRows() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
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

    // Нормализация
    var normStreet = normalizeStreet(street);
    var normHouse = normalizeHouse(house);

    if (!normHouse) {
      errors++;
      Logger.log("✗ Строка " + (i + 1) + ": невалидный дом — '" + house + "'");
      continue;
    }

    // Формируем адрес — добавляем "улица" для обычных названий
    var address;
    if (normStreet.indexOf("микрорайон") === 0) {
      address = "Казахстан, город Атырау, " + normStreet + ", дом " + normHouse;
    } else {
      address = "Казахстан, город Атырау, улица " + normStreet + ", дом " + normHouse;
    }

    try {
      // Пауза перед каждым запросом для избежания rate limit
      Utilities.sleep(200);

      var coords = geocodeAddress(address);

      if (!coords) {
        errors++;
        Logger.log("✗ Строка " + (i + 1) + ": не найден — " + address);
        continue;
      }

      // Проверка 1: координаты в пределах Атырау?
      if (!isInAtyrauBounds(coords.lat, coords.lng)) {
        outOfBounds++;
        Logger.log("⚠ Строка " + (i + 1) + ": ВНЕ АТЫРАУ (" + coords.lat + ", " + coords.lng + ") — " + address);
        continue;
      }

      // Проверка 2: не центр города? (= адрес не найден точно)
      if (!isNotCityCenter(coords.lat, coords.lng)) {
        centerHits++;
        Logger.log("⚠ Строка " + (i + 1) + ": ЦЕНТР ГОРОДА (неточно) — " + address);
        continue;
      }

      // Координаты валидны — записываем
      sheet.getRange(i + 1, COL_LAT).setValue(coords.lat);
      sheet.getRange(i + 1, COL_LNG).setValue(coords.lng);
      updated++;
      Logger.log("✓ Строка " + (i + 1) + ": " + address + " → " + coords.lat + ", " + coords.lng);

    } catch (e) {
      errors++;
      Logger.log("✗ Строка " + (i + 1) + ": ошибка — " + e.message);
      // Если rate limit — подождать подольше
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
    "Ошибки: " + errors + "\n\n" +
    "Адреса помеченные ⚠ нужно проверить вручную через 2ГИС.";

  Logger.log(msg);
  SpreadsheetApp.getUi().alert(msg);
}

/**
 * Геокодирование одного адреса через Google Maps Geocoding API.
 * Ограничивает поиск рамками Атырауской области.
 */
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

/**
 * Добавить пункт меню для удобного запуска.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Геокодирование")
    .addItem("Определить координаты", "geocodeAllRows")
    .addItem("Очистить координаты", "clearCoordinates")
    .addToUi();
}

// ══════════════════════════════════════════════════════════════
//  Web App — API для карты (doGet)
// ══════════════════════════════════════════════════════════════

/**
 * Обработчик GET-запросов — возвращает данные из таблицы как JSON.
 */
function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();

  if (data.length < 2) {
    return ContentService.createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var headers = data[0];
  var rows = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[1] || String(row[1]).trim() === "") continue;

    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j] !== undefined ? row[j] : "";
    }
    rows.push(obj);
  }

  return ContentService.createTextOutput(JSON.stringify(rows))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Очистить все координаты (для повторного геокодирования).
 */
function clearCoordinates() {
  var ui = SpreadsheetApp.getUi();
  var result = ui.alert(
    "Очистить координаты?",
    "Будут удалены ВСЕ координаты (колонки Широта и Долгота).\nПродолжить?",
    ui.ButtonSet.YES_NO
  );

  if (result !== ui.Button.YES) return;

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = sheet.getLastRow();

  if (lastRow > 1) {
    sheet.getRange(2, COL_LAT, lastRow - 1, 1).clearContent();
    sheet.getRange(2, COL_LNG, lastRow - 1, 1).clearContent();
  }

  ui.alert("Координаты очищены. Можно запустить геокодирование заново.");
}
