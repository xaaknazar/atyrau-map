// ══════════════════════════════════════════════════════════════
//  CAMERAS — загрузка камер из Google Sheets
// ══════════════════════════════════════════════════════════════

var cameraPoints = [];
var _cameraCallbacks = [];
var _cameraDataReady = false;

// Данные идут через авторизованный серверный прокси (same-origin, cookie сессии
// уходит автоматически). Прямые ссылки на Google в браузере не хранятся.
var CAMERAS_CSV_URL = "/api/data?source=cameras";
var CAMERAS_CACHE_KEY = "atyrau-cameras-cache-v2";

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
 * Полный парсинг CSV с поддержкой кавычек, переносов строк в полях.
 * Возвращает массив массивов строк.
 */
function _fullParseCSV(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;
    var i = 0;
    var len = text.length;

    while (i < len) {
        var ch = text[i];

        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < len && text[i + 1] === '"') {
                    field += '"';
                    i += 2;
                } else {
                    inQuotes = false;
                    i++;
                }
            } else {
                field += ch;
                i++;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
                i++;
            } else if (ch === ',') {
                row.push(field.trim());
                field = "";
                i++;
            } else if (ch === '\r') {
                // skip \r
                i++;
            } else if (ch === '\n') {
                row.push(field.trim());
                if (row.length > 1 || (row.length === 1 && row[0] !== "")) {
                    rows.push(row);
                }
                row = [];
                field = "";
                i++;
            } else {
                field += ch;
                i++;
            }
        }
    }
    // Последнее поле / строка
    row.push(field.trim());
    if (row.length > 1 || (row.length === 1 && row[0] !== "")) {
        rows.push(row);
    }

    return rows;
}

/**
 * Найти индексы столбцов по заголовкам.
 */
function _findColumnIndexes(header) {
    var idxName = -1, idxType = -1, idxAddr = -1, idxLat = -1, idxLng = -1;

    for (var i = 0; i < header.length; i++) {
        var h = header[i].toLowerCase();
        if (h.indexOf("название") !== -1) idxName = i;
        else if (h.indexOf("количество") !== -1 || h.indexOf("кол-во") !== -1) idxType = i;
        else if (h.indexOf("адрес") !== -1) idxAddr = i;
        else if (h.indexOf("координата x") !== -1 || h.indexOf("координата х") !== -1 || h === "x" || h === "lat") idxLat = i;
        else if (h.indexOf("координата y") !== -1 || h === "y" || h === "lng") idxLng = i;
    }

    // Fallback: если не нашли по имени, берём по позиции
    // №(0), Название(1), Количество(2), Адрес(3), X(4), Y(5)
    if (idxName === -1) idxName = 1;
    if (idxType === -1) idxType = 2;
    if (idxAddr === -1) idxAddr = 3;
    if (idxLat === -1) idxLat = 4;
    if (idxLng === -1) idxLng = 5;

    return { name: idxName, type: idxType, addr: idxAddr, lat: idxLat, lng: idxLng };
}

/**
 * Парсинг координаты — поддержка точки и запятой как десятичного разделителя.
 */
function _parseCamCoord(val) {
    if (!val) return NaN;
    val = val.replace(/\s/g, "").replace(",", ".");
    return parseFloat(val);
}

/**
 * Парсинг CSV → массив объектов камер.
 */
function _parseCamerasCSV(text) {
    var allRows = _fullParseCSV(text);
    if (allRows.length < 2) return [];

    var idx = _findColumnIndexes(allRows[0]);
    var cameras = [];
    var skipped = 0;

    for (var i = 1; i < allRows.length; i++) {
        var cols = allRows[i];
        var name = cols[idx.name] || "";
        var type = cols[idx.type] || "";
        var address = cols[idx.addr] || "";
        var lat = _parseCamCoord(cols[idx.lat]);
        var lng = _parseCamCoord(cols[idx.lng]);

        if (isNaN(lat) || isNaN(lng)) { skipped++; continue; }
        // Валидация: Атырау область (широкие рамки)
        if (lat < 40 || lat > 55 || lng < 45 || lng > 60) { skipped++; continue; }

        cameras.push({
            id: i,
            name: name,
            type: type,
            address: address,
            lat: lat,
            lng: lng
        });
    }

    if (skipped > 0) {
        console.log("[cameras] Пропущено строк (нет координат): " + skipped);
    }
    return cameras;
}

/**
 * Загрузить камеры из Google Sheets CSV.
 */
function loadCameras(onDone) {
    // Сначала кэш
    var cacheLoaded = false;
    try {
        var cached = localStorage.getItem(CAMERAS_CACHE_KEY);
        if (cached) {
            cameraPoints = JSON.parse(cached);
            cacheLoaded = true;
            console.log("[cameras] Из кэша: " + cameraPoints.length);
            if (onDone) onDone();
            _notifyCamerasReady();
        }
    } catch (e) { /* ignore */ }

    // Загрузка из сети
    var xhr = new XMLHttpRequest();
    xhr.open("GET", CAMERAS_CSV_URL, true);
    xhr.timeout = 20000;
    xhr.onload = function () {
        if (xhr.status === 200) {
            var parsed = _parseCamerasCSV(xhr.responseText);
            if (parsed.length > 0) {
                cameraPoints = parsed;
                try { localStorage.setItem(CAMERAS_CACHE_KEY, JSON.stringify(cameraPoints)); } catch (e) {}
                console.log("[cameras] Загружено из сети: " + cameraPoints.length);
                if (cacheLoaded && onDone) onDone(); // обновить маркеры
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
