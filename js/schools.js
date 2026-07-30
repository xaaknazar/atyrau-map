// ══════════════════════════════════════════════════════════════
//  SCHOOLS — загрузка школ из Google Sheets
// ══════════════════════════════════════════════════════════════

var schoolPoints = [];
var _schoolCallbacks = [];
var _schoolDataReady = false;

// Данные через авторизованный серверный прокси (same-origin).
var SCHOOLS_CSV_URL = "/api/data?source=schools";
var SCHOOLS_CACHE_KEY = "atyrau-schools-cache-v1";

function onSchoolsReady(fn) {
    if (_schoolDataReady) { fn(); return; }
    _schoolCallbacks.push(fn);
}

function _notifySchoolsReady() {
    _schoolDataReady = true;
    _schoolCallbacks.forEach(function (fn) { fn(); });
    _schoolCallbacks = [];
}

/**
 * Парсинг CSV → массив школ.
 * Используем _fullParseCSV из cameras.js.
 *
 * Формат: №, Название школы, Адрес, Директор, Телефон школы,
 *          Телефон директора, Координаты
 *
 * Некоторые школы имеют доп. строки с телефонами (без №).
 */
function _parseSchoolsCSV(text) {
    var allRows = _fullParseCSV(text);
    if (allRows.length < 2) return [];

    var points = [];
    var current = null;

    for (var i = 1; i < allRows.length; i++) {
        var cols = allRows[i];
        if (cols.length < 2) continue;

        var num = (cols[0] || "").trim();
        var name = (cols[1] || "").trim();
        var address = (cols[2] || "").trim();
        var director = (cols[3] || "").trim();
        var schoolPhone = (cols[4] || "").trim();
        var directorPhone = (cols[5] || "").trim();

        // Координаты — последний столбец или столбец 6
        var coordStr = "";
        // Координаты могут быть в столбце 6 или разделены запятой на 6+7
        if (cols.length > 6) coordStr = (cols[6] || "").trim();

        // Строка с номером — новая школа
        if (num && num.match(/^\d+$/)) {
            // Сохраняем предыдущую
            if (current) points.push(current);

            var lat = NaN, lng = NaN;

            // Парсинг координат: "47.112652, 51.922414" или разделены запятой CSV
            if (coordStr) {
                var cleaned = coordStr.replace(/\s/g, "");
                if (cols.length > 7 && cleaned.match(/^\d/) && !cleaned.match(/,/)) {
                    lat = parseFloat(cleaned);
                    lng = parseFloat((cols[7] || "").replace(/\s/g, "").replace(",", "."));
                } else {
                    var parts = cleaned.split(",");
                    if (parts.length >= 2) {
                        lat = parseFloat(parts[0]);
                        lng = parseFloat(parts[1]);
                    }
                }
            }

            current = {
                id: parseInt(num, 10),
                name: name,
                address: address,
                director: director,
                schoolPhones: schoolPhone ? [schoolPhone] : [],
                directorPhone: directorPhone,
                lat: (isNaN(lat) || lat < 40 || lat > 55) ? null : lat,
                lng: (isNaN(lng) || lng < 45 || lng > 60) ? null : lng
            };
        } else if (current) {
            // Доп. строка — собираем телефоны
            if (schoolPhone) current.schoolPhones.push(schoolPhone);
            if (directorPhone && !current.directorPhone) current.directorPhone = directorPhone;
        }
    }
    // Последняя школа
    if (current) points.push(current);

    // Фильтруем без координат
    var withCoords = points.filter(function (s) { return s.lat !== null; });
    console.log("[schools] Распарсено: " + points.length + ", с координатами: " + withCoords.length);
    return withCoords;
}

/**
 * Загрузить школы.
 */
function loadSchools(onDone) {
    var cacheLoaded = false;
    try {
        var cached = localStorage.getItem(SCHOOLS_CACHE_KEY);
        if (cached) {
            schoolPoints = JSON.parse(cached);
            cacheLoaded = true;
            console.log("[schools] Из кэша: " + schoolPoints.length);
            if (onDone) onDone();
            _notifySchoolsReady();
        }
    } catch (e) { /* ignore */ }

    var xhr = new XMLHttpRequest();
    xhr.open("GET", SCHOOLS_CSV_URL, true);
    xhr.timeout = 20000;
    xhr.onload = function () {
        if (xhr.status === 200) {
            var parsed = _parseSchoolsCSV(xhr.responseText);
            if (parsed.length > 0) {
                schoolPoints = parsed;
                try { localStorage.setItem(SCHOOLS_CACHE_KEY, JSON.stringify(schoolPoints)); } catch (e) {}
                console.log("[schools] Загружено из сети: " + schoolPoints.length);
                if (cacheLoaded && onDone) onDone();
            }
            if (!_schoolDataReady) {
                if (onDone) onDone();
                _notifySchoolsReady();
            }
        }
    };
    xhr.onerror = xhr.ontimeout = function () {
        console.warn("[schools] Ошибка загрузки");
        if (!_schoolDataReady) {
            if (onDone) onDone();
            _notifySchoolsReady();
        }
    };
    xhr.send();
}
