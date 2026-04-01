/**
 * Загрузка правонарушений (ЕРДР) из Google Sheets.
 *
 * Таблица публикуется как CSV, парсится на клиенте,
 * адреса автоматически геокодируются через Nominatim,
 * результаты кэшируются в localStorage.
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
 */

// ══════════════════════════════════════════════════════════════
//  Конфигурация
// ══════════════════════════════════════════════════════════════

// Ссылка на опубликованную Google таблицу (CSV формат)
var CRIMES_SHEET_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/" +
    "2PACX-1vRdNcnBVsk8JV3lsjicAt9erR4jAmaq8Pj4AsC5eIcqGqR_q3OLkU2Eujn9eG99WEdzMUzA1OEHf7wE" +
    "/pub?gid=0&single=true&output=csv";

var GEOCODE_CACHE_KEY = "atyrau-crime-geocode-cache";
var CRIMES_DATA_CACHE_KEY = "atyrau-crimes-data-cache";

// ══════════════════════════════════════════════════════════════
//  Глобальные переменные
// ══════════════════════════════════════════════════════════════

var crimeIncidents = [];
var _geocodeCache = {};
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
        lat: null,
        lng: null
    };
}

// ══════════════════════════════════════════════════════════════
//  Загрузка данных из Google Sheets
// ══════════════════════════════════════════════════════════════

function loadCrimesFromSheet(callback) {
    console.log("[crimes] Загрузка данных из Google Sheets...");

    fetch(CRIMES_SHEET_CSV_URL)
        .then(function (resp) {
            if (!resp.ok) throw new Error("HTTP " + resp.status);
            return resp.text();
        })
        .then(function (csv) {
            var rows = parseCSV(csv);
            if (rows.length < 2) {
                console.warn("[crimes] Таблица пуста или не удалось распарсить");
                _tryLoadFromCache();
                callback();
                return;
            }

            // Первая строка — заголовки, пропускаем
            crimeIncidents = [];
            for (var i = 1; i < rows.length; i++) {
                var cols = rows[i];
                // Пропускаем строки без номера ЕРДР
                if (!cols[1] || cols[1].trim() === "") continue;
                crimeIncidents.push(csvRowToCrime(cols, i - 1));
            }

            console.log("[crimes] Загружено записей: " + crimeIncidents.length);

            // Кэшируем данные на случай оффлайна
            _saveCrimesCache();

            callback();
        })
        .catch(function (err) {
            console.warn("[crimes] Ошибка загрузки таблицы:", err.message);
            console.log("[crimes] Пробуем загрузить из кэша...");
            _tryLoadFromCache();
            callback();
        });
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

// ══════════════════════════════════════════════════════════════
//  Автоматическое геокодирование адресов через Nominatim
// ══════════════════════════════════════════════════════════════

/** Загрузить кэш геокодирования из localStorage */
function _loadGeoCache() {
    try {
        var saved = localStorage.getItem(GEOCODE_CACHE_KEY);
        if (saved) _geocodeCache = JSON.parse(saved);
    } catch (e) { /* ignore */ }
}

/** Сохранить кэш в localStorage */
function _saveGeoCache() {
    try {
        localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(_geocodeCache));
    } catch (e) { /* ignore */ }
}

/**
 * Уникальный ключ кэша для данного инцидента.
 */
function _geoCacheKey(crime) {
    return [
        (crime.city || "").toUpperCase().trim(),
        (crime.street || "").toUpperCase().trim(),
        (crime.house || "").trim(),
        (crime.district || "").toUpperCase().trim()
    ].join("|");
}

/**
 * Геокодировать один адрес через Nominatim.
 */
function _geocodeAddress(query) {
    var url = "https://nominatim.openstreetmap.org/search" +
        "?q=" + encodeURIComponent(query) +
        "&format=json&limit=1" +
        "&countrycodes=kz" +
        "&accept-language=ru";

    return fetch(url, {
        headers: { "User-Agent": "AtyrauProsecutorMap/1.0" }
    })
    .then(function (resp) { return resp.json(); })
    .then(function (data) {
        if (data && data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon)
            };
        }
        return null;
    })
    .catch(function () { return null; });
}

/**
 * Попробовать несколько вариантов запроса: от подробного к общему.
 */
function _geocodeWithFallback(crime) {
    var queries = [];

    var street = (crime.street || "").replace(/№/g, "").trim();
    var house = (crime.house || "").trim();
    var city = (crime.city || "").trim();
    var district = (crime.district || "").trim();

    // 1. Полный адрес: улица + дом + город
    if (street && house && city) {
        queries.push(street + " " + house + ", " + city + ", Атырау");
    }

    // 2. Улица + город
    if (street && city) {
        queries.push(street + ", " + city + ", Атырау");
    }

    // 3. Город/населённый пункт + район
    if (city && district && district !== "Атырау" &&
        district.toLowerCase() !== city.toLowerCase()) {
        queries.push(city + ", " + district + ", Атырау");
    }

    // 4. Только город
    if (city) {
        queries.push(city + ", Атырау");
    }

    // 5. Fallback: Атырау
    queries.push("Атырау, Казахстан");

    function tryNext(idx) {
        if (idx >= queries.length) return Promise.resolve(null);
        return _geocodeAddress(queries[idx]).then(function (result) {
            if (result) return result;
            return tryNext(idx + 1);
        });
    }

    return tryNext(0);
}

/**
 * Геокодировать все инциденты.
 * ОПТИМИЗАЦИЯ: группировка по уникальным адресам.
 * Вместо 719 запросов — только уникальные комбинации (город+улица+дом).
 *
 * @param {Function} onProgress — вызывается после каждого геокодированного адреса
 * @param {Function} onDone — вызывается когда все готово
 */
function geocodeAllCrimes(onProgress, onDone) {
    _loadGeoCache();

    // 1. Применяем кэш ко всем записям
    crimeIncidents.forEach(function (crime) {
        var key = _geoCacheKey(crime);
        if (_geocodeCache[key]) {
            crime.lat = _geocodeCache[key].lat;
            crime.lng = _geocodeCache[key].lng;
        }
    });

    // 2. Собираем УНИКАЛЬНЫЕ адреса, которых нет в кэше
    var uniqueAddresses = {};   // key → первый crime с этим адресом
    var crimesByKey = {};       // key → [crime, crime, ...]

    crimeIncidents.forEach(function (crime) {
        var key = _geoCacheKey(crime);
        if (!crimesByKey[key]) crimesByKey[key] = [];
        crimesByKey[key].push(crime);

        if (!_geocodeCache[key] && !uniqueAddresses[key]) {
            uniqueAddresses[key] = crime;
        }
    });

    var keysToGeocode = Object.keys(uniqueAddresses);

    if (keysToGeocode.length === 0) {
        console.log("[geocode] Все адреса в кэше (" + crimeIncidents.length +
            " записей, " + Object.keys(crimesByKey).length + " уникальных адресов)");
        if (onDone) onDone();
        return;
    }

    var totalUnique = keysToGeocode.length;
    var totalRecords = crimeIncidents.filter(function (c) { return !c.lat; }).length;
    console.log("[geocode] Уникальных адресов для геокодирования: " + totalUnique +
        " (покрывают " + totalRecords + " записей из " + crimeIncidents.length + ")");

    var idx = 0;

    function processNext() {
        if (idx >= keysToGeocode.length) {
            _saveGeoCache();
            console.log("[geocode] Готово");
            if (onDone) onDone();
            return;
        }

        var key = keysToGeocode[idx];
        var sampleCrime = uniqueAddresses[key];

        _geocodeWithFallback(sampleCrime).then(function (result) {
            var coords;
            if (result) {
                coords = result;
                console.log("[geocode] [" + (idx + 1) + "/" + totalUnique + "] " +
                    key.replace(/\|/g, ", ") + " → " +
                    result.lat.toFixed(4) + ", " + result.lng.toFixed(4));
            } else {
                coords = { lat: 47.1067, lng: 51.9203 };
                console.warn("[geocode] [" + (idx + 1) + "/" + totalUnique + "] " +
                    key.replace(/\|/g, ", ") + " — не найден, центр Атырау");
            }

            // Сохраняем в кэш
            _geocodeCache[key] = coords;

            // Раздаём координаты ВСЕМ записям с этим адресом
            crimesByKey[key].forEach(function (crime) {
                crime.lat = coords.lat;
                crime.lng = coords.lng;
            });

            idx++;
            if (onProgress) onProgress(idx, totalUnique);

            // Сохраняем кэш каждые 10 запросов
            if (idx % 10 === 0) _saveGeoCache();

            // Nominatim: max 1 запрос в секунду
            setTimeout(processNext, 1100);
        });
    }

    processNext();
}

/**
 * Полная инициализация: загрузить из таблицы → геокодировать → уведомить.
 */
function initCrimeData(onProgress, onDone) {
    loadCrimesFromSheet(function () {
        if (crimeIncidents.length === 0) {
            console.warn("[crimes] Нет данных для отображения");
            if (onDone) onDone();
            _notifyCrimesReady();
            return;
        }

        geocodeAllCrimes(onProgress, function () {
            _saveCrimesCache();
            if (onDone) onDone();
            _notifyCrimesReady();
        });
    });
}

// ══════════════════════════════════════════════════════════════
//  Утилиты
// ══════════════════════════════════════════════════════════════

/**
 * Фильтрация инцидентов по периоду.
 * @param {string} period — "all" | "month" | "week" | "day"
 * @returns {Array} Отфильтрованный массив (только с координатами)
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
