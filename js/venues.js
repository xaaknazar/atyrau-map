var venuePoints = [];
var _venuesReady = false;
var _venueCallbacks = [];

function onVenuesReady(fn) {
    if (_venuesReady) { fn(); return; }
    _venueCallbacks.push(fn);
}

function _notifyVenuesReady() {
    _venuesReady = true;
    _venueCallbacks.forEach(function (fn) { fn(); });
}

var VENUES_SHEET_ID = "1W7J6c7rM3Skd5cJbv_95J3d5fM_6X5mBNQBvhxhLkBU";
var VENUES_GID = "1361292445";
var VENUES_CSV_URL = "https://docs.google.com/spreadsheets/d/" + VENUES_SHEET_ID +
    "/export?format=csv&gid=" + VENUES_GID;
var VENUES_CACHE_KEY = "atyrau-venues-cache-v1";

function _parseVenuesCSV(text) {
    var rows = [];
    var lines = text.split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (!line.trim()) continue;
        // Simple CSV parse handling quoted fields with commas
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

    // Find columns (header row)
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
        var addr = c[iAddr] || "";
        var lat = null, lng = null;
        if (iCoord !== -1 && c[iCoord]) {
            var m = c[iCoord].match(/(-?\d+\.?\d*)\s*[,;]\s*(-?\d+\.?\d*)/);
            if (m) { lat = parseFloat(m[1]); lng = parseFloat(m[2]); }
        }
        if ((lat === null || lng === null) && iLat !== -1 && iLng !== -1) {
            lat = parseFloat((c[iLat] || "").replace(",", "."));
            lng = parseFloat((c[iLng] || "").replace(",", "."));
        }
        if (isNaN(lat) || isNaN(lng) || lat === null || lng === null) continue;
        if (lat < 40 || lat > 55 || lng < 45 || lng > 60) continue;
        items.push({ name: name, addr: addr, lat: lat, lng: lng });
    }
    return items;
}

function loadVenues(onDone) {
    var cacheLoaded = false;
    try {
        var cached = localStorage.getItem(VENUES_CACHE_KEY);
        if (cached) {
            venuePoints = JSON.parse(cached);
            cacheLoaded = true;
            console.log("[venues] Из кэша: " + venuePoints.length);
            if (onDone) onDone();
            _notifyVenuesReady();
        }
    } catch (e) {}

    fetch(VENUES_CSV_URL)
        .then(function (r) { return r.text(); })
        .then(function (txt) {
            var parsed = _parseVenuesCSV(txt);
            if (parsed.length > 0) {
                venuePoints = parsed;
                try { localStorage.setItem(VENUES_CACHE_KEY, JSON.stringify(venuePoints)); } catch (e) {}
                console.log("[venues] Загружено: " + venuePoints.length);
                if (!_venuesReady) { if (onDone) onDone(); _notifyVenuesReady(); }
                else if (onDone) onDone();
            }
        })
        .catch(function (err) {
            console.warn("[venues] Ошибка загрузки:", err);
            if (!_venuesReady && !cacheLoaded) { _notifyVenuesReady(); }
        });
}
