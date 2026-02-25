/**
 * Данные точек и слой хранения.
 * Если Firebase настроен — данные в облаке (видны всем, в реальном времени).
 * Если нет — fallback на localStorage (только для локального тестирования).
 */

var DEFAULT_POINTS = [];

// ══════════════════════════════════════════════════════════════
//  Storage layer — Firebase (cloud) or localStorage (fallback)
// ══════════════════════════════════════════════════════════════

var mapPoints = [];
var useFirebase = false;
var pointsRef = null;
var _dataListeners = [];

/** Register a callback that fires whenever mapPoints changes */
function onDataChanged(fn) {
    _dataListeners.push(fn);
}

function _notifyListeners() {
    _dataListeners.forEach(function (fn) { fn(); });
}

// ── Try to init Firebase ──────────────────────────────────────
if (typeof FIREBASE_CONFIG !== "undefined" &&
    FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.databaseURL) {
    try {
        firebase.initializeApp(FIREBASE_CONFIG);
        var db = firebase.database();
        pointsRef = db.ref("points");
        useFirebase = true;
        console.log("[data] Firebase подключён");
    } catch (e) {
        console.warn("[data] Firebase init error, fallback to localStorage:", e);
        useFirebase = false;
    }
}

if (useFirebase) {
    // ── Firebase: real-time listener ──────────────────────────
    pointsRef.on("value", function (snapshot) {
        var data = snapshot.val();
        if (data) {
            // Firebase stores as object {id: point}, convert to array
            mapPoints = [];
            Object.keys(data).forEach(function (key) {
                mapPoints.push(data[key]);
            });
        } else {
            // Database empty — seed with default points
            _seedFirebase();
            return; // the set() will trigger this listener again
        }
        _notifyListeners();
    });

    function _seedFirebase() {
        // First try to migrate data from localStorage (includes admin-added points)
        var STORAGE_KEY = "atyrau-map-points";
        var localData = null;
        try {
            var saved = localStorage.getItem(STORAGE_KEY);
            if (saved) localData = JSON.parse(saved);
        } catch (e) { /* ignore */ }

        var source = (localData && localData.length) ? localData : DEFAULT_POINTS;
        var batch = {};
        source.forEach(function (p) {
            batch[p.id] = p;
        });
        pointsRef.set(batch).then(function () {
            // Clear localStorage after successful migration
            if (localData && localData.length) {
                localStorage.removeItem(STORAGE_KEY);
                console.log("[data] localStorage → Firebase: перенесено " + source.length + " точек");
            }
        });
    }

} else {
    // ── localStorage fallback ─────────────────────────────────
    console.log("[data] Firebase не настроен — используется localStorage");

    var STORAGE_KEY = "atyrau-map-points";

    function _loadLocal() {
        var saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { /* corrupted */ }
        }
        return JSON.parse(JSON.stringify(DEFAULT_POINTS));
    }

    mapPoints = _loadLocal();

    // Notify after app.js has had a chance to register its listener
    setTimeout(function () { _notifyListeners(); }, 0);
}

// ══════════════════════════════════════════════════════════════
//  Public API (used by app.js)
// ══════════════════════════════════════════════════════════════

/** Save a single new/updated point */
function savePoint(point) {
    if (useFirebase) {
        pointsRef.child(String(point.id)).set(point);
    } else {
        // update local array
        var idx = mapPoints.findIndex(function (p) { return p.id === point.id; });
        if (idx !== -1) {
            mapPoints[idx] = point;
        } else {
            mapPoints.push(point);
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mapPoints));
        _notifyListeners();
    }
}

/** Delete a point by id */
function deletePoint(id) {
    if (useFirebase) {
        pointsRef.child(String(id)).remove();
    } else {
        mapPoints = mapPoints.filter(function (p) { return p.id !== id; });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mapPoints));
        _notifyListeners();
    }
}

/** Get next available id */
function getNextId() {
    var max = 0;
    mapPoints.forEach(function (p) {
        if (p.id > max) max = p.id;
    });
    return max + 1;
}
