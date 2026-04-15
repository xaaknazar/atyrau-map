// ══════════════════════════════════════════════════════════════
//  POLICE STATIONS (Участковые пункты) — загрузка из Google Sheets
// ══════════════════════════════════════════════════════════════

var policePoints = [];
var _policeCallbacks = [];
var _policeDataReady = false;

var POLICE_SHEET_ID = "1W7J6c7rM3Skd5cJbv_95J3d5fM_6X5mBNQBvhxhLkBU";
var POLICE_GID = "538301573";
var POLICE_CSV_URL = "https://docs.google.com/spreadsheets/d/" + POLICE_SHEET_ID +
    "/export?format=csv&gid=" + POLICE_GID;
var POLICE_CACHE_KEY = "atyrau-police-cache-v1";

function onPoliceReady(fn) {
    if (_policeDataReady) { fn(); return; }
    _policeCallbacks.push(fn);
}

function _notifyPoliceReady() {
    _policeDataReady = true;
    _policeCallbacks.forEach(function (fn) { fn(); });
    _policeCallbacks = [];
}

/**
 * Парсинг CSV → массив участковых пунктов.
 * Используем _fullParseCSV из cameras.js.
 */
function _parsePoliceCSV(text) {
    var allRows = _fullParseCSV(text);
    if (allRows.length < 2) return [];

    var points = [];
    var skipped = 0;

    // Определяем индексы столбцов по заголовкам
    var header = allRows[0];
    var idxName = -1, idxStaff = -1, idxAddr = -1, idxCoords = -1;
    var idxLat = -1, idxLng = -1;

    for (var h = 0; h < header.length; h++) {
        var hl = header[h].toLowerCase();
        if (hl.indexOf("номер участк") !== -1 || hl.indexOf("название") !== -1) idxName = h;
        else if (hl.indexOf("количество") !== -1 || hl.indexOf("сотрудник") !== -1) idxStaff = h;
        else if (hl.indexOf("адрес") !== -1) idxAddr = h;
        else if (hl.indexOf("координат") !== -1 && hl.indexOf("x") !== -1) idxLat = h;
        else if (hl.indexOf("координат") !== -1 && hl.indexOf("y") !== -1) idxLng = h;
        else if (hl.indexOf("координат") !== -1) idxCoords = h;
    }

    // Fallback позиции: №(0), Название(1), Кол-во(2), Адрес(3), Координаты(4)
    if (idxName === -1) idxName = 1;
    if (idxStaff === -1) idxStaff = 2;
    if (idxAddr === -1) idxAddr = 3;
    if (idxCoords === -1 && idxLat === -1) idxCoords = 4;

    for (var i = 1; i < allRows.length; i++) {
        var cols = allRows[i];
        var name = cols[idxName] || "";
        var staff = parseInt(cols[idxStaff], 10) || 0;
        var address = cols[idxAddr] || "";
        var lat = NaN, lng = NaN;

        // Координаты в одном столбце "47.091021, 51.911367"
        if (idxCoords !== -1 && cols[idxCoords]) {
            var coordStr = cols[idxCoords].replace(/\s/g, "");
            // Если запятая уже разделила на два столбца (CSV)
            if (idxCoords + 1 < cols.length && coordStr.match(/^\d/) && !coordStr.match(/,/)) {
                lat = parseFloat(coordStr.replace(",", "."));
                lng = parseFloat((cols[idxCoords + 1] || "").replace(/\s/g, "").replace(",", "."));
            } else {
                var parts = coordStr.split(",");
                if (parts.length >= 2) {
                    lat = parseFloat(parts[0]);
                    lng = parseFloat(parts[1]);
                }
            }
        } else if (idxLat !== -1 && idxLng !== -1) {
            lat = parseFloat((cols[idxLat] || "").replace(/\s/g, "").replace(",", "."));
            lng = parseFloat((cols[idxLng] || "").replace(/\s/g, "").replace(",", "."));
        }

        if (isNaN(lat) || isNaN(lng)) { skipped++; continue; }
        if (lat < 40 || lat > 55 || lng < 45 || lng > 60) { skipped++; continue; }

        points.push({
            id: i,
            name: name,
            staff: staff,
            address: address,
            lat: lat,
            lng: lng
        });
    }

    if (skipped > 0) {
        console.log("[police] Пропущено строк (нет координат): " + skipped);
    }
    return points;
}

/**
 * Загрузить участковые пункты.
 */
function loadPoliceStations(onDone) {
    var cacheLoaded = false;
    try {
        var cached = localStorage.getItem(POLICE_CACHE_KEY);
        if (cached) {
            policePoints = JSON.parse(cached);
            cacheLoaded = true;
            console.log("[police] Из кэша: " + policePoints.length);
            if (onDone) onDone();
            _notifyPoliceReady();
        }
    } catch (e) { /* ignore */ }

    var xhr = new XMLHttpRequest();
    xhr.open("GET", POLICE_CSV_URL, true);
    xhr.timeout = 20000;
    xhr.onload = function () {
        if (xhr.status === 200) {
            var parsed = _parsePoliceCSV(xhr.responseText);
            if (parsed.length > 0) {
                policePoints = parsed;
                try { localStorage.setItem(POLICE_CACHE_KEY, JSON.stringify(policePoints)); } catch (e) {}
                console.log("[police] Загружено из сети: " + policePoints.length);
                if (cacheLoaded && onDone) onDone();
            }
            if (!_policeDataReady) {
                if (onDone) onDone();
                _notifyPoliceReady();
            }
        }
    };
    xhr.onerror = xhr.ontimeout = function () {
        console.warn("[police] Ошибка загрузки, используем кэш");
        if (!_policeDataReady) {
            if (onDone) onDone();
            _notifyPoliceReady();
        }
    };
    xhr.send();
}
