/**
 * Google Apps Script для автоматического геокодирования адресов в Google Sheets.
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
 * 6. Добавьте в таблицу колонки U (Широта) и V (Долгота) — колонки 21 и 22
 *    (или они уже могут быть — главное чтобы были пустые колонки после последней)
 * 7. Запустите функцию geocodeAllRows (кнопка ▶ Run)
 *    При первом запуске Google попросит разрешения — нажмите "Разрешить"
 * 8. Скрипт заполнит координаты для всех адресов г. Атырау
 *    (город = "АТЫРАУ", улица и дом не пустые)
 *
 * ВАЖНО:
 * - Скрипт использует Google Maps Geocoding (бесплатно в Apps Script)
 * - Обрабатывает только строки где город = "АТЫРАУ" и есть улица + дом
 * - Пропускает строки где координаты уже заполнены
 * - Работает пакетами по 50 строк с паузами (лимиты Google)
 * - После завершения таблицу нужно переопубликовать (Файл → Опубликовать)
 *
 * ═══════════════════════════════════════════════════════════════
 */

// Номера колонок (1-based)
var COL_CITY   = 16;  // 31.Место совершения Населенный пункт
var COL_STREET = 17;  // 31.Место совершения Улица
var COL_HOUSE  = 18;  // 31.Место совершения Дом
var COL_LAT    = 21;  // Широта (новая колонка U)
var COL_LNG    = 22;  // Долгота (новая колонка V)

/**
 * Главная функция — геокодировать все строки.
 * Запускайте эту функцию.
 */
function geocodeAllRows() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  var updated = 0;
  var skipped = 0;
  var errors = 0;
  var alreadyDone = 0;

  // Пропускаем заголовок (строка 1)
  for (var i = 1; i < data.length; i++) {
    var row = data[i];

    // Колонки 0-based в массиве
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

    // Формируем адрес для геокодирования
    var address = "Казахстан, Атырау, " + street + " " + house;

    try {
      var coords = geocodeAddress(address);
      if (coords) {
        // Записываем в ячейки (строка i+1 т.к. 1-based)
        sheet.getRange(i + 1, COL_LAT).setValue(coords.lat);
        sheet.getRange(i + 1, COL_LNG).setValue(coords.lng);
        updated++;
        Logger.log("✓ Строка " + (i + 1) + ": " + address + " → " + coords.lat + ", " + coords.lng);
      } else {
        errors++;
        Logger.log("✗ Строка " + (i + 1) + ": не найден — " + address);
      }
    } catch (e) {
      errors++;
      Logger.log("✗ Строка " + (i + 1) + ": ошибка — " + e.message);
    }

    // Пауза каждые 50 строк чтобы не превысить лимиты
    if (updated > 0 && updated % 50 === 0) {
      Utilities.sleep(1000);
    }
  }

  var msg = "Готово!\n" +
    "Обновлено: " + updated + "\n" +
    "Уже было: " + alreadyDone + "\n" +
    "Пропущено (не Атырау / нет улицы): " + skipped + "\n" +
    "Ошибки: " + errors;

  Logger.log(msg);
  SpreadsheetApp.getUi().alert(msg);
}

/**
 * Геокодирование одного адреса через Google Maps Geocoding API.
 * Бесплатно в Google Apps Script (не требует API ключа).
 *
 * @param {string} address — полный адрес
 * @returns {{lat: number, lng: number} | null}
 */
function geocodeAddress(address) {
  var geocoder = Maps.newGeocoder()
    .setRegion("kz")
    .setLanguage("ru");

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
