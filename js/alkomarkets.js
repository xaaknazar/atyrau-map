// ══════════════════════════════════════════════════════════════
//  АЛКОМАРКЕТЫ — точки продажи алкоголя (эмодзи 🍺)
//  Данные из Google Sheets, автообновление по мере поступления.
// ══════════════════════════════════════════════════════════════
var alkomarketPoints = [];
var _alkoReady = false;
var _alkoCallbacks = [];

function onAlkomarketsReady(fn) {
    if (_alkoReady) { fn(); return; }
    _alkoCallbacks.push(fn);
}

function _notifyAlkoReady() {
    _alkoReady = true;
    _alkoCallbacks.forEach(function (fn) { fn(); });
    _alkoCallbacks = [];
}

// Данные через авторизованный серверный прокси (same-origin).
function _alkoCsvUrl() {
    return "/api/data?source=alkomarkets&_=" + Date.now();
}
var ALKO_CACHE_KEY = "atyrau-alkomarkets-cache-v1";

function _parseAlkoCSV(text) {
    var rows = [];
    var lines = text.split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (!line.trim()) continue;
        var cells = [];
        var cur = "", inQ = false;
        for (var j = 0; j < line.length; j++) {
            var ch = line[j];
            if (ch === '"') {
                if (inQ && line[j + 1] === '"') { cur += '"'; j++; }
                else inQ = !inQ;
            } else if (ch === "," && !inQ) {
                cells.push(cur); cur = "";
            } else {
                cur += ch;
            }
        }
        cells.push(cur);
        rows.push(cells.map(function (c) { return c.trim(); }));
    }
    if (rows.length < 2) return [];

    var h = rows[0].map(function (s) { return s.toLowerCase(); });
    function findCol(parts) {
        for (var k = 0; k < h.length; k++) {
            var hit = true;
            for (var p = 0; p < parts.length; p++) {
                if (h[k].indexOf(parts[p]) === -1) { hit = false; break; }
            }
            if (hit) return k;
        }
        return -1;
    }
    var iName = findCol(["назван"]);
    if (iName === -1) iName = findCol(["наимен"]);
    if (iName === -1) iName = findCol(["алкомаркет"]);
    var iAddr = findCol(["адрес"]);
    var iCoord = findCol(["координат"]);
    var iLat = findCol(["широт"]);
    if (iLat === -1) iLat = findCol(["lat"]);
    var iLng = findCol(["долгот"]);
    if (iLng === -1) iLng = findCol(["lng"]);
    if (iLng === -1) iLng = findCol(["lon"]);
    if (iName === -1) iName = 0;
    if (iAddr === -1) iAddr = 1;

    var items = [];
    for (var r = 1; r < rows.length; r++) {
        var c = rows[r];
        var name = c[iName] || "";
        if (!name) continue;
        var addr = (iAddr !== -1 ? c[iAddr] : "") || "";
        var lat = null, lng = null;
        if (iCoord !== -1 && c[iCoord]) {
            var m = c[iCoord].match(/(-?\d+\.?\d*)\s*[,;]\s*(-?\d+\.?\d*)/);
            if (m) { lat = parseFloat(m[1]); lng = parseFloat(m[2]); }
        }
        if ((lat === null || lng === null || isNaN(lat) || isNaN(lng)) && iLat !== -1 && iLng !== -1) {
            lat = parseFloat((c[iLat] || "").replace(",", "."));
            lng = parseFloat((c[iLng] || "").replace(",", "."));
        }
        if (isNaN(lat) || isNaN(lng) || lat === null || lng === null) continue;
        if (lat < 40 || lat > 55 || lng < 45 || lng > 60) continue;
        items.push({ name: name, addr: addr, lat: lat, lng: lng });
    }
    return items;
}

/**
 * Загрузить алкомаркеты. onDone вызывается при наличии данных (кэш/сеть).
 * Для фонового обновления вызывайте повторно — маркеры пересоберутся.
 */
function loadAlkomarkets(onDone) {
    var cacheLoaded = false;
    try {
        var cached = localStorage.getItem(ALKO_CACHE_KEY);
        if (cached) {
            alkomarketPoints = JSON.parse(cached);
            cacheLoaded = true;
            console.log("[alkomarkets] Из кэша: " + alkomarketPoints.length);
            if (onDone) onDone();
            _notifyAlkoReady();
        }
    } catch (e) {}

    fetch(_alkoCsvUrl())
        .then(function (r) { return r.text(); })
        .then(function (txt) {
            var parsed = _parseAlkoCSV(txt);
            if (parsed.length > 0) {
                var changed = JSON.stringify(parsed) !== JSON.stringify(alkomarketPoints);
                alkomarketPoints = parsed;
                try { localStorage.setItem(ALKO_CACHE_KEY, JSON.stringify(alkomarketPoints)); } catch (e) {}
                console.log("[alkomarkets] Загружено: " + alkomarketPoints.length + (changed ? " (обновлено)" : ""));
                if (!_alkoReady) { if (onDone) onDone(); _notifyAlkoReady(); }
                else if (onDone && changed) onDone();
            }
        })
        .catch(function (err) {
            console.warn("[alkomarkets] Ошибка загрузки:", err);
            if (!_alkoReady && !cacheLoaded) { _notifyAlkoReady(); }
        });
}
