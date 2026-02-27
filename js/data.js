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
    // ── One-time migration: clear all old points ─────────────
    var DATA_VERSION = 3;
    var metaRef = db.ref("_meta/data_version");
    var migrationDone = false;

    metaRef.once("value").then(function (snap) {
        if (snap.val() !== DATA_VERSION) {
            console.log("[data] Запуск миграции v" + DATA_VERSION + " — удаление всех точек...");
            return Promise.all([
                pointsRef.remove(),
                db.ref("suggestions").remove()
            ]).then(function () {
                return metaRef.set(DATA_VERSION);
            }).then(function () {
                console.log("[data] Миграция v" + DATA_VERSION + " завершена — все точки удалены");
            });
        }
    }).then(function () {
        migrationDone = true;
        // Start listener only AFTER migration is complete
        pointsRef.on("value", function (snapshot) {
            var data = snapshot.val();
            mapPoints = [];
            if (data) {
                Object.keys(data).forEach(function (key) {
                    mapPoints.push(data[key]);
                });
            }
            _notifyListeners();
        });
    });

} else {
    // ── localStorage fallback ─────────────────────────────────
    console.log("[data] Firebase не настроен — используется localStorage");

    var STORAGE_KEY = "atyrau-map-points";

    // Clear old localStorage data
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("atyrau-map-suggestions");

    mapPoints = [];

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

// ══════════════════════════════════════════════════════════════
//  Suggestions (citizen feedback) — same storage pattern
// ══════════════════════════════════════════════════════════════

var mapSuggestions = [];
var suggestionsRef = null;
var _suggestionsListeners = [];

function onSuggestionsChanged(fn) {
    _suggestionsListeners.push(fn);
}

function _notifySuggestionsListeners() {
    _suggestionsListeners.forEach(function (fn) { fn(); });
}

if (useFirebase) {
    suggestionsRef = db.ref("suggestions");
    suggestionsRef.on("value", function (snapshot) {
        var data = snapshot.val();
        mapSuggestions = [];
        if (data) {
            Object.keys(data).forEach(function (key) {
                mapSuggestions.push(data[key]);
            });
        }
        _notifySuggestionsListeners();
    });
} else {
    var SUGGESTIONS_KEY = "atyrau-map-suggestions";

    function _loadSuggestions() {
        var saved = localStorage.getItem(SUGGESTIONS_KEY);
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { /* corrupted */ }
        }
        return [];
    }

    mapSuggestions = _loadSuggestions();
    setTimeout(function () { _notifySuggestionsListeners(); }, 0);
}

/** Save a new suggestion */
function saveSuggestion(suggestion) {
    if (useFirebase) {
        suggestionsRef.child(String(suggestion.id)).set(suggestion);
    } else {
        var idx = mapSuggestions.findIndex(function (s) { return s.id === suggestion.id; });
        if (idx !== -1) {
            mapSuggestions[idx] = suggestion;
        } else {
            mapSuggestions.push(suggestion);
        }
        localStorage.setItem(SUGGESTIONS_KEY, JSON.stringify(mapSuggestions));
        _notifySuggestionsListeners();
    }
}

/** Delete a suggestion by id */
function deleteSuggestion(id) {
    if (useFirebase) {
        suggestionsRef.child(String(id)).remove();
    } else {
        mapSuggestions = mapSuggestions.filter(function (s) { return s.id !== id; });
        localStorage.setItem(SUGGESTIONS_KEY, JSON.stringify(mapSuggestions));
        _notifySuggestionsListeners();
    }
}

/** Get next suggestion id */
function getNextSuggestionId() {
    var max = 0;
    mapSuggestions.forEach(function (s) {
        if (s.id > max) max = s.id;
    });
    return max + 1;
}
