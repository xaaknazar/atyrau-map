// ══════════════════════════════════════════════════════════════
//  ADMIN VIOLATIONS — Административные правонарушения
// ══════════════════════════════════════════════════════════════

var adminViolations = [];
var _avCallbacks = [];
var _avDataReady = false;

var AV_SHEET_ID = "1W7J6c7rM3Skd5cJbv_95J3d5fM_6X5mBNQBvhxhLkBU";
var AV_GID = "121213149";
var AV_CSV_URL = "https://docs.google.com/spreadsheets/d/" + AV_SHEET_ID +
    "/export?format=csv&gid=" + AV_GID;
var AV_CACHE_KEY = "atyrau-av-cache-v1";

function onAdminViolationsReady(fn) {
    if (_avDataReady) { fn(); return; }
    _avCallbacks.push(fn);
}

function _notifyAVReady() {
    _avDataReady = true;
    _avCallbacks.forEach(function (fn) { fn(); });
    _avCallbacks = [];
}

/**
 * Найти индекс столбца по частичному совпадению заголовка.
 */
function _avFindCol(header, keywords) {
    for (var i = 0; i < header.length; i++) {
        var h = header[i].toLowerCase();
        var match = true;
        for (var k = 0; k < keywords.length; k++) {
            if (h.indexOf(keywords[k].toLowerCase()) === -1) { match = false; break; }
        }
        if (match) return i;
    }
    return -1;
}

function _avStr(cols, idx) {
    return (idx >= 0 && idx < cols.length) ? (cols[idx] || "").trim() : "";
}

function _avParseDate(val) {
    if (!val) return null;
    val = val.trim();
    // DD.MM.YYYY
    var m = val.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (m) return m[3] + "-" + m[2] + "-" + m[1];
    return val;
}

/**
 * Парсинг CSV → массив объектов административных правонарушений.
 * Зависит от _fullParseCSV() из cameras.js
 */
function _parseAdminViolationsCSV(text) {
    var allRows = _fullParseCSV(text);
    if (allRows.length < 2) return [];

    var h = allRows[0];

    // Определяем индексы столбцов
    var iOrgan     = _avFindCol(h, ["орган", "выявивш"]);
    var iVedomstvo = _avFindCol(h, ["ведомств"]);
    var iPodrazd   = _avFindCol(h, ["подразделен"]);
    var iOblast    = _avFindCol(h, ["область", "соверш"]);
    var iRaion     = _avFindCol(h, ["район", "соверш"]);
    var iPlace     = _avFindCol(h, ["место", "соверш", "правонаруш"]);
    var iLatCol    = _avFindCol(h, ["координата", "x"]);
    var iLngCol    = _avFindCol(h, ["координата", "y"]);
    var iNumber    = _avFindCol(h, ["номер", "материал"]);
    var iRegDate   = _avFindCol(h, ["дата", "заведен"]);
    var iFioAuthor = _avFindCol(h, ["фио", "лица", "составивш"]);
    var iPosition  = _avFindCol(h, ["должность", "лица", "составивш"]);
    var iArticle   = _avFindCol(h, ["квалификац"]);
    var iCrimeDate = _avFindCol(h, ["дата", "соверш"]);
    var iFabula    = _avFindCol(h, ["фабула"]);
    if (iFabula === -1) iFabula = _avFindCol(h, ["фабула", "новая"]);
    var iFabulaNew = _avFindCol(h, ["фабула", "нов"]);
    var iLastName  = _avFindCol(h, ["фамилия"]);
    var iFirstName = _avFindCol(h, ["15", "имя"]);
    if (iFirstName === -1) iFirstName = _avFindCol(h, ["имя"]);
    var iPatronymic= _avFindCol(h, ["отчество"]);
    var iBirthDate = _avFindCol(h, ["дата", "рожден"]);
    var iAge       = _avFindCol(h, ["возраст"]);
    var iWorkPlace = _avFindCol(h, ["место", "работ"]);
    var iWorkPos   = _avFindCol(h, ["26", "должность"]);
    if (iWorkPos === -1) iWorkPos = _avFindCol(h, ["должность"]);
    var iState     = _avFindCol(h, ["состояни"]);
    var iPhone     = _avFindCol(h, ["телефон"]);

    var items = [];
    var skipped = 0;

    for (var i = 1; i < allRows.length; i++) {
        var c = allRows[i];
        if (c.length < 3) continue;

        var num = _avStr(c, 0);
        if (!num && !_avStr(c, iNumber)) continue; // пустая строка

        var lat = parseFloat((_avStr(c, iLatCol) || "").replace(",", "."));
        var lng = parseFloat((_avStr(c, iLngCol) || "").replace(",", "."));
        if (isNaN(lat) || isNaN(lng) || lat < 40 || lat > 55 || lng < 45 || lng > 60) {
            lat = null; lng = null;
        }

        var fabula = _avStr(c, iFabulaNew) || _avStr(c, iFabula);

        items.push({
            id: i,
            organ: _avStr(c, iOrgan),
            vedomstvo: _avStr(c, iVedomstvo),
            podrazdelenie: _avStr(c, iPodrazd),
            oblast: _avStr(c, iOblast),
            raion: _avStr(c, iRaion),
            place: _avStr(c, iPlace),
            lat: lat,
            lng: lng,
            materialNumber: _avStr(c, iNumber),
            regDate: _avParseDate(_avStr(c, iRegDate)),
            authorFio: _avStr(c, iFioAuthor),
            authorPosition: _avStr(c, iPosition),
            article: _avStr(c, iArticle),
            crimeDate: _avParseDate(_avStr(c, iCrimeDate)),
            fabula: fabula,
            lastName: _avStr(c, iLastName),
            firstName: _avStr(c, iFirstName),
            patronymic: _avStr(c, iPatronymic),
            birthDate: _avStr(c, iBirthDate),
            age: _avStr(c, iAge),
            workplace: _avStr(c, iWorkPlace),
            workPosition: _avStr(c, iWorkPos),
            state: _avStr(c, iState),
            phone: _avStr(c, iPhone)
        });
    }

    console.log("[admin-violations] Распарсено: " + items.length + ", пропущено: " + skipped);
    return items;
}

/**
 * Фильтр по периоду. Использует getPeriodCutoff() из crimes.js
 */
function filterAVByPeriod(period) {
    var list = adminViolations.slice();
    var cutoff = getPeriodCutoff(period);
    if (!cutoff) return list;
    return list.filter(function (v) {
        var d = new Date(v.regDate);
        return d >= cutoff;
    });
}

/**
 * Аналитика по административным правонарушениям.
 */
function analyzeAdminViolations(items) {
    var total = items.length;

    // По инспекторам (кто составил протокол)
    var byAuthor = {};
    items.forEach(function (v) {
        var key = v.authorFio || "Не указан";
        if (!byAuthor[key]) byAuthor[key] = { label: key, count: 0, position: v.authorPosition, unit: v.podrazdelenie || "" };
        byAuthor[key].count++;
    });
    var authorList = Object.values(byAuthor).sort(function (a, b) { return b.count - a.count; });

    // Инспекторы сгруппированные по подразделениям
    var authorsByUnit = {};
    authorList.forEach(function (a) {
        var u = a.unit || "Не указано";
        if (!authorsByUnit[u]) authorsByUnit[u] = { label: u, authors: [], total: 0 };
        authorsByUnit[u].authors.push(a);
        authorsByUnit[u].total += a.count;
    });
    var authorsByUnitList = Object.values(authorsByUnit).sort(function (a, b) { return b.total - a.total; });

    // По подразделениям
    var byUnit = {};
    items.forEach(function (v) {
        var key = v.podrazdelenie || "Не указано";
        if (!byUnit[key]) byUnit[key] = { label: key, count: 0 };
        byUnit[key].count++;
    });
    var unitList = Object.values(byUnit).sort(function (a, b) { return b.count - a.count; });

    // По статьям
    var byArticle = {};
    items.forEach(function (v) {
        var key = v.article || "Не указана";
        if (!byArticle[key]) byArticle[key] = { label: key, count: 0 };
        byArticle[key].count++;
    });
    var articleList = Object.values(byArticle).sort(function (a, b) { return b.count - a.count; });

    // По районам
    var byRaion = {};
    items.forEach(function (v) {
        var key = v.raion || "Не указан";
        if (!byRaion[key]) byRaion[key] = { label: key, count: 0 };
        byRaion[key].count++;
    });
    var raionList = Object.values(byRaion).sort(function (a, b) { return b.count - a.count; });

    // По состоянию
    var byState = {};
    items.forEach(function (v) {
        var key = v.state || "не указано";
        if (!byState[key]) byState[key] = { label: key, count: 0 };
        byState[key].count++;
    });
    var stateList = Object.values(byState).sort(function (a, b) { return b.count - a.count; });

    // По возрасту
    var byAge = {};
    items.forEach(function (v) {
        var key = v.age || "Не указан";
        if (!byAge[key]) byAge[key] = { label: key, count: 0 };
        byAge[key].count++;
    });
    var ageList = Object.values(byAge).sort(function (a, b) { return b.count - a.count; });

    // По месяцам
    var byMonth = {};
    items.forEach(function (v) {
        if (!v.regDate) return;
        var key = v.regDate.substring(0, 7); // YYYY-MM
        if (!byMonth[key]) byMonth[key] = { label: key, count: 0 };
        byMonth[key].count++;
    });
    var monthList = Object.values(byMonth).sort(function (a, b) { return a.label.localeCompare(b.label); });

    var withCoords = items.filter(function (v) { return v.lat !== null; }).length;

    return {
        total: total,
        withCoords: withCoords,
        uniqueArticles: articleList.length,
        uniqueAuthors: authorList.length,
        byAuthor: authorList,
        byAuthorGrouped: authorsByUnitList,
        byUnit: unitList,
        byArticle: articleList,
        byRaion: raionList,
        byState: stateList,
        byAge: ageList,
        byMonth: monthList
    };
}

/**
 * Загрузить административные правонарушения.
 */
function loadAdminViolations(onDone) {
    var cacheLoaded = false;
    try {
        var cached = localStorage.getItem(AV_CACHE_KEY);
        if (cached) {
            adminViolations = JSON.parse(cached);
            cacheLoaded = true;
            console.log("[admin-violations] Из кэша: " + adminViolations.length);
            if (onDone) onDone();
            _notifyAVReady();
        }
    } catch (e) {}

    var xhr = new XMLHttpRequest();
    xhr.open("GET", AV_CSV_URL, true);
    xhr.timeout = 25000;
    xhr.onload = function () {
        if (xhr.status === 200) {
            var parsed = _parseAdminViolationsCSV(xhr.responseText);
            if (parsed.length > 0) {
                adminViolations = parsed;
                try { localStorage.setItem(AV_CACHE_KEY, JSON.stringify(adminViolations)); } catch (e) {}
                console.log("[admin-violations] Загружено из сети: " + adminViolations.length);
                if (cacheLoaded && onDone) onDone();
            }
            if (!_avDataReady) {
                if (onDone) onDone();
                _notifyAVReady();
            }
        }
    };
    xhr.onerror = xhr.ontimeout = function () {
        console.warn("[admin-violations] Ошибка загрузки");
        if (!_avDataReady) {
            if (onDone) onDone();
            _notifyAVReady();
        }
    };
    xhr.send();
}
