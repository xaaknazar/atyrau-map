// ══════════════════════════════════════════════════════════════
//  CAMERAS — загрузка камер из Google Sheets
// ══════════════════════════════════════════════════════════════

var cameraPoints = [];
var _cameraCallbacks = [];
var _cameraDataReady = false;

var CAMERAS_SHEET_ID = "1W7J6c7rM3Skd5cJbv_95J3d5fM_6X5mBNQBvhxhLkBU";
var CAMERAS_GID = "2044322486";
var CAMERAS_CSV_URL = "https://docs.google.com/spreadsheets/d/" + CAMERAS_SHEET_ID +
    "/export?format=csv&gid=" + CAMERAS_GID;
var CAMERAS_CACHE_KEY = "atyrau-cameras-cache";

function onCamerasReady(fn) {
    if (_cameraDataReady) { fn(); return; }
    _cameraCallbacks.push(fn);
}

function _notifyCamerasReady() {
    _cameraDataReady = true;
    _cameraCallbacks.forEach(function (fn) { fn(); });
    _cameraCallbacks = [];
}

/**
 * Парсинг CSV-строки (простой, без кавычек внутри полей).
 */
function _parseCSVLine(line) {
    var result = [];
    var current = "";
    var inQuotes = false;
    for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (ch === '"') {
            if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            result.push(current.trim());
            current = "";
        } else {
            current += ch;
        }
    }
    result.push(current.trim());
    return result;
}

/**
 * Парсинг CSV → массив объектов камер.
 */
function _parseCSV(text) {
    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim().length > 0; });
    if (lines.length < 2) return [];

    var cameras = [];
    // Пропускаем заголовок (строка 0)
    for (var i = 1; i < lines.length; i++) {
        var cols = _parseCSVLine(lines[i]);
        // №, Название, Количество, Адрес, X (lat), Y (lng)
        var name = cols[1] || "";
        var type = cols[2] || "";
        var address = cols[3] || "";
        var lat = parseFloat(cols[4]);
        var lng = parseFloat(cols[5]);

        if (isNaN(lat) || isNaN(lng)) continue;
        // Валидация: Атырау область
        if (lat < 45.5 || lat > 49.5 || lng < 50.0 || lng > 55.5) continue;

        cameras.push({
            id: i,
            name: name,
            type: type,
            address: address,
            lat: lat,
            lng: lng
        });
    }
    return cameras;
}

/**
 * Загрузить камеры из Google Sheets CSV.
 */
function loadCameras(onDone) {
    // Сначала кэш
    try {
        var cached = localStorage.getItem(CAMERAS_CACHE_KEY);
        if (cached) {
            cameraPoints = JSON.parse(cached);
            console.log("[cameras] Из кэша: " + cameraPoints.length);
            if (onDone) onDone();
            _notifyCamerasReady();
        }
    } catch (e) { /* ignore */ }

    // Загрузка из сети
    var xhr = new XMLHttpRequest();
    xhr.open("GET", CAMERAS_CSV_URL, true);
    xhr.timeout = 15000;
    xhr.onload = function () {
        if (xhr.status === 200) {
            var parsed = _parseCSV(xhr.responseText);
            if (parsed.length > 0) {
                cameraPoints = parsed;
                try { localStorage.setItem(CAMERAS_CACHE_KEY, JSON.stringify(cameraPoints)); } catch (e) {}
                console.log("[cameras] Загружено: " + cameraPoints.length);
            }
            if (!_cameraDataReady) {
                if (onDone) onDone();
                _notifyCamerasReady();
            }
        }
    };
    xhr.onerror = xhr.ontimeout = function () {
        console.warn("[cameras] Ошибка загрузки, используем кэш");
        if (!_cameraDataReady) {
            if (onDone) onDone();
            _notifyCamerasReady();
        }
    };
    xhr.send();
}
