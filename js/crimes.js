/**
 * Загрузка данных ЕРДР из Google Sheets (Apps Script API).
 *
 * Таблица имеет 2 листа:
 *  Лист 1 — «Основная информация» (преступления)
 *  Лист 2 — «Люди» (подозреваемые/лица)
 *  Связь через поле «Номер ЕРДР»
 *
 * Колонки Лист 1:
 *  №, Номер ЕРДР, Дата-время регистрации, Орган регистрации,
 *  Номер КУИ, Дата-время регистрации в КУИ, Дата совершения,
 *  время совершения, Описание преступления/проступка,
 *  10.Квалификация, 10.Квалификация п.п., 10.3.Совершено в отношении,
 *  28.Преступление совершено, 29.Место совершения, 29.1.Общественное место,
 *  30.Охрана объекта, 31.Место совершения Республика,
 *  31.Место совершения Область, 31.Место совершения Район,
 *  31.Место совершения Населенный пункт, 31.Место совершения Улица,
 *  31.Место совершения Дом, 31.Место совершения Корпус,
 *  31.Место совершения Квартира,
 *  31. Место совершения (координата X), 31. Место совершения (координата Y)
 *
 * Колонки Лист 2:
 *  №, Возраст на момент совершения, Пол, Место рождения Республика,
 *  Место рождения Область, Место рождения Район, Место рождения Населенный пункт,
 *  Гражданство, Гражданство иностранца, Национальность, Образование,
 *  Семейное положение, Дополнительные сведения, Несовершеннолетний,
 *  Род занятий, Доп.отметки, Место работы (учебы), Должность,
 *  Номер ЕРДР, Дата-время регистрации
 */

// ══════════════════════════════════════════════════════════════
//  Конфигурация
// ══════════════════════════════════════════════════════════════

// Google Apps Script web app — возвращает JSON с обоими листами
var CRIMES_API_URL =
    "https://script.google.com/macros/s/" +
    "AKfycby-q4A-i6RYGRHGhwHs9nLDDz45Y36hhC_lyvHSe4dHXuVaXBF2LfcjoD5W_dOSLqjG" +
    "/exec";

// Резервная ссылка — CSV из таблицы (без координат, без людей)
var CRIMES_SHEET_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/" +
    "2PACX-1vRdNcnBVsk8JV3lsjicAt9erR4jAmaq8Pj4AsC5eIcqGqR_q3OLkU2Eujn9eG99WEdzMUzA1OEHf7wE" +
    "/pub?gid=0&single=true&output=csv";

var CRIMES_DATA_CACHE_KEY = "atyrau-crimes-data-cache";
var PEOPLE_DATA_CACHE_KEY = "atyrau-people-data-cache";

// ══════════════════════════════════════════════════════════════
//  Глобальные переменные
// ══════════════════════════════════════════════════════════════

var crimeIncidents = [];
var crimePeople = [];       // данные о лицах
var crimePeopleByErdr = {}; // { "номер ЕРДР": [person, ...] }
var _crimeGeoCallbacks = [];
var _crimeDataReady = false;

/** Вызывается когда данные загружены */
function onCrimesReady(fn) {
    if (_crimeDataReady) { fn(); return; }
    _crimeGeoCallbacks.push(fn);
}

function _notifyCrimesReady() {
    _crimeDataReady = true;
    _crimeGeoCallbacks.forEach(function (fn) { fn(); });
}

// ══════════════════════════════════════════════════════════════
//  Валидация координат
// ══════════════════════════════════════════════════════════════

/**
 * Проверка: координаты валидны (не центр города, в пределах Атырау).
 */
function _validateCoords(lat, lng) {
    if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) return { lat: null, lng: null };
    // Центр Атырау — ошибка геокодинга (~47.0945, ~51.9238)
    if (Math.abs(lat - 47.0945) < 0.003 && Math.abs(lng - 51.9238) < 0.003) return { lat: null, lng: null };
    // За пределами Атырау
    if (lat < 46.85 || lat > 47.25 || lng < 51.60 || lng > 52.15) return { lat: null, lng: null };
    return { lat: lat, lng: lng };
}

// ══════════════════════════════════════════════════════════════
//  Парсинг CSV
// ══════════════════════════════════════════════════════════════

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

    if (field || row.length > 0) {
        row.push(field.trim());
        if (row.length > 1) rows.push(row);
    }

    return rows;
}

function parseDateToISO(dateStr) {
    if (!dateStr) return "";
    var m = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})\s*(\d{2}):(\d{2})/);
    if (m) {
        return m[3] + "-" + m[2] + "-" + m[1] + "T" + m[4] + ":" + m[5] + ":00";
    }
    var m2 = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (m2) {
        return m2[3] + "-" + m2[2] + "-" + m2[1];
    }
    return dateStr;
}

// ══════════════════════════════════════════════════════════════
//  Парсинг строк — преступления
// ══════════════════════════════════════════════════════════════

/** Безопасно привести к строке */
function _s(v) { return (v === undefined || v === null || v === "") ? "" : String(v); }

/** Парсинг даты (ISO или ДД.ММ.ГГГГ) */
function _parseDate(v) {
    if (!v) return "";
    var str = String(v);
    if (str.indexOf("T") !== -1) return str;
    return parseDateToISO(str);
}

/**
 * Конвертировать JSON-объект (строку из Apps Script) в объект инцидента.
 * Новая структура с координатами X/Y.
 */
function jsonRowToCrime(row, idx) {
    if (Array.isArray(row)) {
        return csvRowToCrime(row, idx);
    }

    // Координаты — новые поля
    var latVal = row["31. Место совершения (координата X)"] ||
                 row["U (Широта)"] || row["Широта"] || row["lat"] || "";
    var lngVal = row["31. Место совершения (координата Y)"] ||
                 row["V (Долгота)"] || row["Долгота"] || row["lng"] || "";
    var lat = latVal !== "" ? parseFloat(latVal) : null;
    var lng = lngVal !== "" ? parseFloat(lngVal) : null;

    var coords = _validateCoords(lat, lng);
    lat = coords.lat;
    lng = coords.lng;

    var article = _s(row["10.Квалификация"]);

    // Статья 190 — не имеет точных координат
    if (article.indexOf("190") !== -1) {
        lat = null;
        lng = null;
    }

    return {
        id: idx + 1,
        erdr: _s(row["Номер ЕРДР"] || row["1.Номер ЕРДР"]),
        regDate: _parseDate(row["Дата-время регистрации"] || row["1.Дата-время регистрации"]),
        organ: _s(row["Орган регистрации"] || row["2.Орган регистрации"]),
        kuiNumber: _s(row["Номер КУИ"] || row["3. Номер КУИ"] || row["4.Номер КУИ"]),
        kuiDate: _parseDate(row["Дата-время регистрации в КУИ"] || row["4.Дата-время регистрации в КУИ"]),
        crimeDate: _parseDate(row["Дата совершения"] || row["9.Дата совершения"]),
        crimeTime: _s(row["время совершения"] || row["9.время совершения"]),
        description: _s(row["Описание преступления/проступка"] || row["9.1 Описание преступления/проступка"]),
        article: article,
        articlePart: _s(row["10.Квалификация п.п."]),
        victimType: _s(row["10.3.Совершено в отношении"]),
        crimeMethod: _s(row["28.Преступление совершено"]),
        placeType: _s(row["29.Место совершения"]),
        isPublic: _s(row["29.1.Общественное место"]).toLowerCase().indexOf("общественное") !== -1,
        security: _s(row["30.Охрана объекта"]),
        republic: _s(row["31.Место совершения Республика"]),
        oblast: _s(row["31.Место совершения Область"]),
        district: _s(row["31.Место совершения Район"]),
        city: _s(row["31.Место совершения Населенный пункт"]),
        street: _s(row["31.Место совершения Улица"]),
        house: _s(row["31.Место совершения Дом"]),
        building: _s(row["31.Место совершения Корпус"]),
        apartment: _s(row["31.Место совершения Квартира"]),
        lat: (lat !== null && !isNaN(lat)) ? lat : null,
        lng: (lng !== null && !isNaN(lng)) ? lng : null
    };
}

/**
 * CSV fallback (старый формат).
 */
function csvRowToCrime(cols, idx) {
    var lat = cols[24] ? parseFloat(cols[24]) : (cols[20] ? parseFloat(cols[20]) : null);
    var lng = cols[25] ? parseFloat(cols[25]) : (cols[21] ? parseFloat(cols[21]) : null);
    var coords = _validateCoords(lat, lng);
    var article = cols[9] || "";
    if (article.indexOf("190") !== -1) { coords.lat = null; coords.lng = null; }

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
        article: article,
        articlePart: cols[10] || "",
        victimType: cols[11] || "",
        crimeMethod: cols[12] || "",
        placeType: cols[13] || "",
        isPublic: (cols[14] || "").toLowerCase().indexOf("общественное") !== -1,
        security: cols[15] || "",
        republic: cols[16] || "",
        oblast: cols[17] || "",
        district: cols[18] || "",
        city: cols[19] || "",
        street: cols[20] || "",
        house: cols[21] || "",
        building: cols[22] || "",
        apartment: cols[23] || "",
        lat: coords.lat,
        lng: coords.lng
    };
}

// ══════════════════════════════════════════════════════════════
//  Парсинг строк — люди
// ══════════════════════════════════════════════════════════════

/**
 * Конвертировать JSON-объект (лист «Люди») в объект лица.
 */
function jsonRowToPerson(row, idx) {
    if (Array.isArray(row)) return null;

    return {
        id: idx + 1,
        age: parseInt(_s(row["Возраст на момент совершения"])) || null,
        gender: _s(row["Пол"]),
        birthRepublic: _s(row["Место рождения Республика"]),
        birthOblast: _s(row["Место рождения Область"]),
        birthDistrict: _s(row["Место рождения Район"]),
        birthCity: _s(row["Место рождения Населенный пункт"]),
        citizenship: _s(row["Гражданство"]),
        foreignCitizenship: _s(row["Гражданство иностранца"]),
        nationality: _s(row["Национальность"]),
        education: _s(row["Образование"]),
        maritalStatus: _s(row["Семейное положение"]),
        additionalInfo: _s(row["Дополнительные сведения"]),
        isMinor: _s(row["Несовершеннолетний"]),
        occupation: _s(row["Род занятий"]),
        extraMarks: _s(row["Доп.отметки"]),
        workplace: _s(row["Место работы (учебы)"]),
        position: _s(row["Должность"]),
        erdr: _s(row["Номер ЕРДР"]),
        regDate: _parseDate(row["Дата-время регистрации"])
    };
}

/**
 * Построить индекс людей по номеру ЕРДР.
 */
function _buildPeopleIndex() {
    crimePeopleByErdr = {};
    crimePeople.forEach(function (p) {
        if (!p.erdr) return;
        if (!crimePeopleByErdr[p.erdr]) crimePeopleByErdr[p.erdr] = [];
        crimePeopleByErdr[p.erdr].push(p);
    });
    console.log("[crimes] Людей привязано к ЕРДР: " + Object.keys(crimePeopleByErdr).length + " уникальных номеров");
}

/**
 * Получить людей для данного преступления.
 */
function getPeopleForCrime(crime) {
    return crimePeopleByErdr[crime.erdr] || [];
}

// ══════════════════════════════════════════════════════════════
//  Загрузка данных
// ══════════════════════════════════════════════════════════════

/**
 * Загрузить из Apps Script API (JSON — оба листа).
 */
function _loadFromAPI(callback) {
    console.log("[crimes] Загрузка из Apps Script API...");

    fetch(CRIMES_API_URL, { redirect: "follow" })
        .then(function (resp) {
            if (!resp.ok) throw new Error("HTTP " + resp.status);
            return resp.text();
        })
        .then(function (text) {
            var data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                throw new Error("Ответ не JSON: " + text.substring(0, 100));
            }
            return data;
        })
        .then(function (data) {
            // Новый формат: { crimes: [...], people: [...] }
            // Старый формат: просто массив [...]
            var crimeRows, peopleRows;

            if (data.crimes) {
                crimeRows = data.crimes;
                peopleRows = data.people || [];
            } else {
                crimeRows = Array.isArray(data) ? data : (data.data || data.rows || []);
                peopleRows = [];
            }

            if (crimeRows.length === 0) {
                throw new Error("API вернул пустые данные");
            }

            // Парсим преступления
            crimeIncidents = [];
            for (var i = 0; i < crimeRows.length; i++) {
                var crime = jsonRowToCrime(crimeRows[i], i);
                if (crime.erdr) {
                    crimeIncidents.push(crime);
                }
            }

            // Парсим людей
            crimePeople = [];
            for (var j = 0; j < peopleRows.length; j++) {
                var person = jsonRowToPerson(peopleRows[j], j);
                if (person && person.erdr) {
                    crimePeople.push(person);
                }
            }

            _buildPeopleIndex();

            console.log("[crimes] Загружено из API: " + crimeIncidents.length + " преступлений, " + crimePeople.length + " лиц");
            _saveCrimesCache();
            callback();
        })
        .catch(function (err) {
            console.warn("[crimes] API недоступен:", err.message);
            _loadFromCSV(callback);
        });
}

/**
 * Загрузить из CSV (резервный вариант — только преступления).
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
        if (crimePeople.length > 0) {
            localStorage.setItem(PEOPLE_DATA_CACHE_KEY, JSON.stringify(crimePeople));
        }
    } catch (e) { /* ignore */ }
}

function _tryLoadFromCache() {
    try {
        var saved = localStorage.getItem(CRIMES_DATA_CACHE_KEY);
        if (saved) {
            crimeIncidents = JSON.parse(saved);
            console.log("[crimes] Загружено из кэша: " + crimeIncidents.length);
        }
        var savedPeople = localStorage.getItem(PEOPLE_DATA_CACHE_KEY);
        if (savedPeople) {
            crimePeople = JSON.parse(savedPeople);
            _buildPeopleIndex();
            console.log("[crimes] Людей из кэша: " + crimePeople.length);
        }
    } catch (e) { /* ignore */ }
}

/**
 * Полная инициализация.
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

function filterCrimesByPeriod(period) {
    var list = crimeIncidents.slice();
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
