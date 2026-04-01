/**
 * Загрузка правонарушений (ЕРДР) из Google Sheets.
 *
 * Таблица публикуется как CSV, парсится на клиенте.
 * Координаты (широта/долгота) заполняются ВНУТРИ таблицы
 * через Google Apps Script — клиент только читает готовые значения.
 *
 * Колонки таблицы (по порядку):
 *  0  — №
 *  1  — 1.Номер ЕРДР
 *  2  — 1.Дата-время регистрации
 *  3  — 2.Орган регистрации
 *  4  — 4.Номер КУИ
 *  5  — 4.Дата-время регистрации в КУИ
 *  6  — 9.Дата совершения
 *  7  — 9.время совершения
 *  8  — 9.1 Описание преступления/проступка
 *  9  — 10.Квалификация
 *  10 — 10.Квалификация п.п.
 *  11 — 29.Место совершения
 *  12 — 29.1.Общественное место
 *  13 — 31.Место совершения Область
 *  14 — 31.Место совершения Район
 *  15 — 31.Место совершения Населенный пункт
 *  16 — 31.Место совершения Улица
 *  17 — 31.Место совершения Дом
 *  18 — 31.Место совершения Корпус
 *  19 — 31.Место совершения Квартира
 *  20 — Широта (lat)
 *  21 — Долгота (lng)
 */

// ══════════════════════════════════════════════════════════════
//  Конфигурация
// ══════════════════════════════════════════════════════════════

// Google Apps Script web app — возвращает JSON с координатами
var CRIMES_API_URL =
    "https://script.google.com/macros/s/" +
    "AKfycbz9Q5pkCGFgOZJbrxb_peozbGT9Kr8sj4VEa-0U46lh3g5Xw6DGOTis2tEfTQFBUagj" +
    "/exec";

// Резервная ссылка — CSV из таблицы (без координат, на случай если API недоступен)
var CRIMES_SHEET_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/" +
    "2PACX-1vRdNcnBVsk8JV3lsjicAt9erR4jAmaq8Pj4AsC5eIcqGqR_q3OLkU2Eujn9eG99WEdzMUzA1OEHf7wE" +
    "/pub?gid=0&single=true&output=csv";

var CRIMES_DATA_CACHE_KEY = "atyrau-crimes-data-cache";

// ══════════════════════════════════════════════════════════════
//  Глобальные переменные
// ══════════════════════════════════════════════════════════════

var crimeIncidents = [];
var _crimeGeoCallbacks = [];
var _crimeDataReady = false;

/** Вызывается когда данные загружены и геокодированы */
function onCrimesReady(fn) {
    if (_crimeDataReady) { fn(); return; }
    _crimeGeoCallbacks.push(fn);
}

function _notifyCrimesReady() {
    _crimeDataReady = true;
    _crimeGeoCallbacks.forEach(function (fn) { fn(); });
}

// ══════════════════════════════════════════════════════════════
//  Парсинг CSV
// ══════════════════════════════════════════════════════════════

/**
 * Простой парсер CSV с поддержкой кавычек и переносов строк внутри полей.
 */
function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;
    var i = 0;

    while (i < text.length) {
        var ch = text[i];

        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < text.length && text[i + 1] === '"') {
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
                i++;
            } else if (ch === '\n') {
                row.push(field.trim());
                field = "";
                if (row.length > 1) rows.push(row);
                row = [];
                i++;
            } else {
                field += ch;
                i++;
            }
        }
    }

    // Последняя строка
    if (field || row.length > 0) {
        row.push(field.trim());
        if (row.length > 1) rows.push(row);
    }

    return rows;
}

/**
 * Парсинг даты формата "ДД.ММ.ГГГГ ЧЧ:ММ" в ISO строку.
 */
function parseDateToISO(dateStr) {
    if (!dateStr) return "";
    // Пример: "04.02.2026 11:43"
    var m = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})\s*(\d{2}):(\d{2})/);
    if (m) {
        return m[3] + "-" + m[2] + "-" + m[1] + "T" + m[4] + ":" + m[5] + ":00";
    }
    // Попробуем только дату "ДД.ММ.ГГГГ"
    var m2 = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (m2) {
        return m2[3] + "-" + m2[2] + "-" + m2[1];
    }
    return dateStr;
}

/**
 * Конвертировать строку CSV в объект инцидента.
 */
function csvRowToCrime(cols, idx) {
    return {
        id: idx + 1,
        erdr: cols[1] || "",
        regDate: parseDateToISO(cols[2] || ""),
        organ: cols[3] || "",
        kuiNumber: cols[4] || "",
        kuiDate: cols[5] || "",
        crimeDate: parseDateToISO(cols[6] || ""),
        crimeTime: cols[7] || "",
        description: cols[8] || "",
        article: cols[9] || "",
        articlePart: cols[10] || "",
        placeType: cols[11] || "",
        isPublic: (cols[12] || "").toLowerCase().indexOf("общественное") !== -1,
        oblast: cols[13] || "",
        district: cols[14] || "",
        city: cols[15] || "",
        street: cols[16] || "",
        house: cols[17] || "",
        building: cols[18] || "",
        apartment: cols[19] || "",
        lat: cols[20] ? parseFloat(cols[20]) : null,
        lng: cols[21] ? parseFloat(cols[21]) : null
    };
}

// ══════════════════════════════════════════════════════════════
//  Загрузка данных из Google Sheets
// ══════════════════════════════════════════════════════════════

/**
 * Конвертировать JSON-объект (строку из Apps Script) в объект инцидента.
 * Apps Script может вернуть массив объектов с ключами-заголовками
 * или массив массивов (как CSV).
 */
function jsonRowToCrime(row, idx) {
    // Если row — массив (array of arrays формат)
    if (Array.isArray(row)) {
        return csvRowToCrime(row, idx);
    }

    // Если row — объект с ключами
    return {
        id: idx + 1,
        erdr: row["1.Номер ЕРДР"] || row["erdr"] || row["ЕРДР"] || "",
        regDate: parseDateToISO(row["1.Дата-время регистрации"] || row["regDate"] || ""),
        organ: row["2.Орган регистрации"] || row["organ"] || "",
        kuiNumber: row["4.Номер КУИ"] || row["kuiNumber"] || "",
        kuiDate: row["4.Дата-время регистрации в КУИ"] || row["kuiDate"] || "",
        crimeDate: parseDateToISO(row["9.Дата совершения"] || row["crimeDate"] || ""),
        crimeTime: row["9.время совершения"] || row["crimeTime"] || "",
        description: row["9.1 Описание преступления/проступка"] || row["description"] || "",
        article: row["10.Квалификация"] || row["article"] || "",
        articlePart: row["10.Квалификация п.п."] || row["articlePart"] || "",
        placeType: row["29.Место совершения"] || row["placeType"] || "",
        isPublic: (row["29.1.Общественное место"] || row["isPublic"] || "").toString().toLowerCase().indexOf("общественное") !== -1,
        oblast: row["31.Место совершения Область"] || row["oblast"] || "",
        district: row["31.Место совершения Район"] || row["district"] || "",
        city: row["31.Место совершения Населенный пункт"] || row["city"] || "",
        street: row["31.Место совершения Улица"] || row["street"] || "",
        house: row["31.Место совершения Дом"] || row["house"] || "",
        building: row["31.Место совершения Корпус"] || row["building"] || "",
        apartment: row["31.Место совершения Квартира"] || row["apartment"] || "",
        lat: parseFloat(row["Широта"] || row["lat"]) || null,
        lng: parseFloat(row["Долгота"] || row["lng"]) || null
    };
}

/**
 * Загрузить из Apps Script API (JSON с координатами).
 */
function _loadFromAPI(callback) {
    console.log("[crimes] Загрузка из Apps Script API...");

    fetch(CRIMES_API_URL)
        .then(function (resp) {
            if (!resp.ok) throw new Error("HTTP " + resp.status);
            return resp.json();
        })
        .then(function (data) {
            // data может быть: { data: [...] } или просто [...]
            var rows = Array.isArray(data) ? data : (data.data || data.rows || []);

            if (rows.length === 0) {
                throw new Error("API вернул пустые данные");
            }

            crimeIncidents = [];
            for (var i = 0; i < rows.length; i++) {
                var crime = jsonRowToCrime(rows[i], i);
                if (crime.erdr) {
                    crimeIncidents.push(crime);
                }
            }

            console.log("[crimes] Загружено из API: " + crimeIncidents.length);
            _saveCrimesCache();
            callback();
        })
        .catch(function (err) {
            console.warn("[crimes] API недоступен:", err.message);
            // Fallback на CSV
            _loadFromCSV(callback);
        });
}

/**
 * Загрузить из CSV (резервный вариант).
 */
function _loadFromCSV(callback) {
    console.log("[crimes] Загрузка из CSV (резервный)...");

    fetch(CRIMES_SHEET_CSV_URL)
        .then(function (resp) {
            if (!resp.ok) throw new Error("HTTP " + resp.status);
            return resp.text();
        })
        .then(function (csv) {
            var rows = parseCSV(csv);
            if (rows.length < 2) {
                console.warn("[crimes] Таблица пуста");
                _tryLoadFromCache();
                callback();
                return;
            }

            crimeIncidents = [];
            for (var i = 1; i < rows.length; i++) {
                var cols = rows[i];
                if (!cols[1] || cols[1].trim() === "") continue;
                crimeIncidents.push(csvRowToCrime(cols, i - 1));
            }

            console.log("[crimes] Загружено из CSV: " + crimeIncidents.length);
            _saveCrimesCache();
            callback();
        })
        .catch(function (err) {
            console.warn("[crimes] CSV тоже недоступен:", err.message);
            _tryLoadFromCache();
            callback();
        });
}

function loadCrimesFromSheet(callback) {
    _loadFromAPI(callback);
}

function _saveCrimesCache() {
    try {
        localStorage.setItem(CRIMES_DATA_CACHE_KEY, JSON.stringify(crimeIncidents));
    } catch (e) { /* ignore */ }
}

function _tryLoadFromCache() {
    try {
        var saved = localStorage.getItem(CRIMES_DATA_CACHE_KEY);
        if (saved) {
            crimeIncidents = JSON.parse(saved);
            console.log("[crimes] Загружено из кэша: " + crimeIncidents.length);
        }
    } catch (e) { /* ignore */ }
}

/**
 * Полная инициализация: загрузить из таблицы → уведомить.
 * Координаты уже содержатся в таблице (колонки 20-21).
 */
function initCrimeData(onProgress, onDone) {
    loadCrimesFromSheet(function () {
        var withCoords = crimeIncidents.filter(function (c) {
            return typeof c.lat === "number" && !isNaN(c.lat);
        }).length;
        console.log("[crimes] С координатами: " + withCoords + " из " + crimeIncidents.length);

        _saveCrimesCache();
        if (onDone) onDone();
        _notifyCrimesReady();
    });
}

// ══════════════════════════════════════════════════════════════
//  Утилиты
// ══════════════════════════════════════════════════════════════

/**
 * Фильтрация инцидентов по периоду.
 * Показываются только записи с координатами (где были город + улица + дом).
 * @param {string} period — "all" | "month" | "week" | "day"
 * @returns {Array} Отфильтрованный массив
 */
function filterCrimesByPeriod(period) {
    var list = crimeIncidents.filter(function (c) {
        return typeof c.lat === "number" && typeof c.lng === "number";
    });

    if (period === "all") return list;

    var now = new Date();
    var cutoff;

    switch (period) {
        case "day":
            cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
        case "week":
            cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case "month":
            cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        default:
            return list;
    }

    return list.filter(function (c) {
        var d = new Date(c.regDate);
        return d >= cutoff;
    });
}

/**
 * Построить адресную строку из полей инцидента.
 */
function buildCrimeAddress(c) {
    var parts = [];
    if (c.oblast) parts.push(c.oblast);
    if (c.district) parts.push(c.district);
    if (c.city) parts.push(c.city);
    if (c.street) parts.push("ул. " + c.street);
    if (c.house) parts.push("д. " + c.house);
    if (c.building) parts.push("корп. " + c.building);
    if (c.apartment) parts.push("кв. " + c.apartment);
    return parts.join(", ");
}

/**
 * Форматировать дату для отображения.
 */
function formatCrimeDate(isoStr) {
    if (!isoStr) return "—";
    var d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    var day = ("0" + d.getDate()).slice(-2);
    var month = ("0" + (d.getMonth() + 1)).slice(-2);
    var year = d.getFullYear();
    var hours = ("0" + d.getHours()).slice(-2);
    var mins = ("0" + d.getMinutes()).slice(-2);
    return day + "." + month + "." + year + " " + hours + ":" + mins;
}
