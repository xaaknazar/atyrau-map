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

// ЕРДР грузим через собственный серверный прокси (same-origin) —
// иначе Safari блокирует прямой запрос к script.google.com (CORS на редиректе).
var CRIMES_API_URL = "/api/crimes";

// Резервная ссылка — CSV из таблицы (без координат, без людей)
var CRIMES_SHEET_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/" +
    "2PACX-1vRdNcnBVsk8JV3lsjicAt9erR4jAmaq8Pj4AsC5eIcqGqR_q3OLkU2Eujn9eG99WEdzMUzA1OEHf7wE" +
    "/pub?gid=0&single=true&output=csv";

var PEOPLE_SHEET_ID = "1W7J6c7rM3Skd5cJbv_95J3d5fM_6X5mBNQBvhxhLkBU";
var PEOPLE_GID = "187886123";
var PEOPLE_CSV_URL = "https://docs.google.com/spreadsheets/d/" + PEOPLE_SHEET_ID +
    "/export?format=csv&gid=" + PEOPLE_GID;

var CRIMES_DATA_CACHE_KEY = "atyrau-crimes-data-cache-v4";
var PEOPLE_DATA_CACHE_KEY = "atyrau-people-data-cache-v4";

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
//  Конвертация координат: Pulkovo 1942 / Gauss-Kruger CM 69E → WGS84
//  (EPSG:2502 → EPSG:4326)
//  Эллипсоид Красовского 1940, центральный меридиан 69°E
// ══════════════════════════════════════════════════════════════

/**
 * Конвертировать координаты из Pulkovo 1942 GK CM 69E в широту/долготу WGS84.
 * @param {number} easting — координата X (метры, с false easting 500000)
 * @param {number} northing — координата Y (метры)
 * @returns {{ lat: number, lng: number } | null}
 */
function pulkovoToWgs84(easting, northing) {
    // Параметры эллипсоида Красовского
    var a = 6378245.0;
    var f = 1 / 298.3;
    var b = a * (1 - f);
    var e2 = (a * a - b * b) / (a * a);
    var ep2 = (a * a - b * b) / (b * b);
    var lon0 = 69 * Math.PI / 180; // центральный меридиан
    var k0 = 1.0;
    var x0 = 500000; // false easting

    var x = easting - x0;
    var y = northing;

    // Footpoint latitude
    var M = y / k0;
    var mu = M / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256));

    var e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
    var phi1 = mu +
        (3 * e1 / 2 - 27 * e1 * e1 * e1 / 32) * Math.sin(2 * mu) +
        (21 * e1 * e1 / 16 - 55 * e1 * e1 * e1 * e1 / 32) * Math.sin(4 * mu) +
        (151 * e1 * e1 * e1 / 96) * Math.sin(6 * mu) +
        (1097 * e1 * e1 * e1 * e1 / 512) * Math.sin(8 * mu);

    var sinPhi = Math.sin(phi1);
    var cosPhi = Math.cos(phi1);
    var tanPhi = Math.tan(phi1);

    var N1 = a / Math.sqrt(1 - e2 * sinPhi * sinPhi);
    var T1 = tanPhi * tanPhi;
    var C1 = ep2 * cosPhi * cosPhi;
    var R1 = a * (1 - e2) / Math.pow(1 - e2 * sinPhi * sinPhi, 1.5);
    var D = x / (N1 * k0);

    var lat = phi1 -
        (N1 * tanPhi / R1) * (
            D * D / 2 -
            (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D * D * D * D / 24 +
            (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D * D * D * D * D * D / 720
        );

    var lng = lon0 + (
        D -
        (1 + 2 * T1 + C1) * D * D * D / 6 +
        (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D * D * D * D * D / 120
    ) / cosPhi;

    var latDeg = lat * 180 / Math.PI;
    var lngDeg = lng * 180 / Math.PI;

    return { lat: latDeg, lng: lngDeg };
}

/**
 * Парсить значение координаты из таблицы.
 * В таблице числа записаны с запятой как десятичный разделитель: "-799461,8249"
 */
function _parseCoordValue(v) {
    if (v === undefined || v === null || v === "") return null;
    if (typeof v === "number") return isNaN(v) ? null : v;
    var s = String(v).trim().replace(/\s/g, "");
    // Заменить запятую на точку (европейский формат: "-799461,8249")
    s = s.replace(",", ".");
    var num = parseFloat(s);
    return isNaN(num) ? null : num;
}

// ══════════════════════════════════════════════════════════════
//  Валидация координат
// ══════════════════════════════════════════════════════════════

/**
 * Проверка: координаты валидны (в пределах Атырауской области).
 * Границы области: ~45.5°N – 49.5°N, ~50°E – 55.5°E
 */
function _validateCoords(lat, lng) {
    if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) return { lat: null, lng: null };
    // За пределами Атырауской области
    if (lat < 45.5 || lat > 49.5 || lng < 50.0 || lng > 55.5) return { lat: null, lng: null };
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

    // Координаты — приоритет: "Новые координаты" (WGS84: "47.120578, 51.924944")
    // Если нет — конвертируем из Pulkovo X/Y
    var lat = null;
    var lng = null;

    var newCoords = _s(row["Новые координаты"]);
    if (newCoords) {
        var parts = newCoords.replace(/\s/g, "").split(",");
        if (parts.length === 2) {
            var nLat = parseFloat(parts[0]);
            var nLng = parseFloat(parts[1]);
            if (!isNaN(nLat) && !isNaN(nLng)) {
                lat = nLat;
                lng = nLng;
            }
        }
    }

    // Если новых координат нет — берём из Pulkovo X/Y
    if (lat === null || lng === null) {
        var rawX = _parseCoordValue(row["31. Место совершения (координата X)"]);
        var rawY = _parseCoordValue(row["31. Место совершения (координата Y)"]);
        if (rawX !== null && rawY !== null) {
            var wgs = pulkovoToWgs84(rawX, rawY);
            if (wgs) {
                lat = wgs.lat;
                lng = wgs.lng;
            }
        }
    }

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
        crimeDate: _parseDate(row["Дата совершения"] || row["9.Дата совершения"] || _findFieldCI(row, ["дата", "соверш"])),
        crimeTime: _s(row["время совершения"] || row["Время совершения"] || row["9.время совершения"] || row["9.Время совершения"] || _findFieldCI(row, ["время", "соверш"])),
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
// Поиск значения по частичному совпадению ключа (без учёта регистра).
function _findFieldCI(row, parts) {
    for (var key in row) {
        var k = key.toLowerCase();
        var match = true;
        for (var i = 0; i < parts.length; i++) {
            if (k.indexOf(parts[i]) === -1) { match = false; break; }
        }
        if (match) {
            var v = row[key];
            if (v !== null && v !== undefined && String(v).trim() !== "") return v;
        }
    }
    return "";
}

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

    // Поиск значения по частичному совпадению ключа
    function _find(row, parts) {
        for (var key in row) {
            var k = key.toLowerCase();
            var match = true;
            for (var i = 0; i < parts.length; i++) {
                if (k.indexOf(parts[i]) === -1) { match = false; break; }
            }
            if (match) return _s(row[key]);
        }
        return "";
    }

    return {
        id: idx + 1,
        erdr: _s(row["Номер ЕРДР"]) || _find(row, ["номер", "ердр"]),
        regDate: _parseDate(row["Дата-время регистрации"]) || _parseDate(_find(row, ["дата", "регистрац"])),
        organ: _s(row["Орган регистрации"]) || _find(row, ["орган", "регистрац"]),
        article: _s(row["Квалификация"]) || _find(row, ["квалификац"]),
        articlePart: _s(row["Квалификация п.п."]) || _find(row, ["квалификац", "п.п"]),
        crimeDescription: _s(row["Описание преступления/проступка"]) || _find(row, ["описани"]),
        crimeDate: _s(row["Дата совершения"]) || _find(row, ["дата", "соверш"]),
        crimeTime: _s(row["время совершения"]) || _find(row, ["время", "соверш"]),
        iin: _s(row["ИИН"]) || _find(row, ["иин"]),
        lastName: _s(row["Фамилия"]) || _find(row, ["фамили"]),
        firstName: _s(row["Имя"]) || _find(row, ["имя"]),
        patronymic: _s(row["Отчество"]) || _find(row, ["отчеств"]),
        birthDate: _s(row["Дата рождения"]) || _find(row, ["дата", "рожден"]),
        age: parseInt(_s(row["5.1.Возраст на момент совершения"])) || parseInt(_find(row, ["возраст"])) || null,
        gender: _s(row["6.Пол"]) || _s(row["Пол"]) || _find(row, ["пол"]),
        birthRepublic: _find(row, ["место", "рожден", "республ"]),
        birthOblast: _find(row, ["место", "рожден", "област"]),
        birthDistrict: _find(row, ["место", "рожден", "район"]),
        birthCity: _find(row, ["место", "рожден", "населен"]),
        citizenship: _s(row["8.Гражданство"]) || _s(row["Гражданство"]) || _find(row, ["гражданств"]),
        foreignCitizenship: _find(row, ["гражданств", "иностран"]),
        nationality: _s(row["9.Национальность"]) || _s(row["Национальность"]) || _find(row, ["национальн"]),
        education: _s(row["11.Образование"]) || _s(row["Образование"]) || _find(row, ["образован"]),
        maritalStatus: _s(row["12.Семейное положение"]) || _s(row["Семейное положение"]) || _find(row, ["семейн"]),
        additionalInfo: _s(row["13.Дополнительные сведения"]) || _find(row, ["дополнительн", "сведен"]),
        isMinor: _s(row["13.1.Несовершеннолетний"]) || _find(row, ["несовершеннолетн"]),
        residencePlace: _find(row, ["по месту", "проживан"]),
        addrRepublic: _find(row, ["адрес", "республ"]),
        addrOblast: _find(row, ["адрес", "област"]),
        addrDistrict: _find(row, ["адрес", "район"]),
        addrCity: _find(row, ["адрес", "населен"]),
        addrStreet: _find(row, ["адрес", "улиц"]),
        addrHouse: _find(row, ["адрес", "дом"]),
        occupation: _s(row["17.Род занятий"]) || _s(row["Род занятий"]) || _find(row, ["род", "занят"]),
        workplace: _s(row["19.Место работы (учебы)"]) || _find(row, ["место", "работ"]),
        position: _s(row["19.Должность"]) || _find(row, ["должност"]),
        previousCrime: _find(row, ["ранее", "соверш"]),
        intoxication: _find(row, ["в состоянии"]),
        inGroup: _find(row, ["в группе"]),
        participationType: _find(row, ["вид", "соучаст"]),
        conviction: _find(row, ["судимост"]),
        registeredAccount: _find(row, ["состоял", "на учет"]),
        decision: _find(row, ["решение", "отношен"])
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
 * Один запрос к API с таймаутом.
 */
function _fetchWithTimeout(url, timeoutMs) {
    return new Promise(function (resolve, reject) {
        var controller = window.AbortController ? new AbortController() : null;
        var timer = setTimeout(function () {
            if (controller) controller.abort();
            reject(new Error("Таймаут " + timeoutMs + "мс"));
        }, timeoutMs);

        fetch(url, {
            redirect: "follow",
            signal: controller ? controller.signal : undefined
        })
        .then(function (resp) {
            clearTimeout(timer);
            resolve(resp);
        })
        .catch(function (err) {
            clearTimeout(timer);
            reject(err);
        });
    });
}

/**
 * Распарсить JSON-ответ API в crimeIncidents и crimePeople.
 */
function _parseAPIResponse(data) {
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

    crimeIncidents = [];
    for (var i = 0; i < crimeRows.length; i++) {
        var crime = jsonRowToCrime(crimeRows[i], i);
        if (crime.erdr) {
            crimeIncidents.push(crime);
        }
    }

    if (peopleRows.length > 0) {
        crimePeople = [];
        for (var j = 0; j < peopleRows.length; j++) {
            var person = jsonRowToPerson(peopleRows[j], j);
            if (person) {
                crimePeople.push(person);
            }
        }
        _buildPeopleIndex();
    }
    console.log("[crimes] Загружено: " + crimeIncidents.length + " преступлений, " + crimePeople.length + " лиц");
}

/**
 * Загрузить из Apps Script API с повторными попытками.
 * До 3 попыток с экспоненциальной паузой (2с, 4с, 8с).
 */
function _loadFromAPI(callback, attempt) {
    attempt = attempt || 1;
    var maxAttempts = 3;
    var delays = [2000, 4000, 8000];

    console.log("[crimes] API запрос (попытка " + attempt + "/" + maxAttempts + ")...");

    _fetchWithTimeout(CRIMES_API_URL, 30000)
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
            _parseAPIResponse(data);
            _saveCrimesCache();
            callback();
        })
        .catch(function (err) {
            console.warn("[crimes] Попытка " + attempt + " не удалась:", err.message);

            if (attempt < maxAttempts) {
                var delay = delays[attempt - 1] || 4000;
                console.log("[crimes] Повтор через " + (delay / 1000) + "с...");
                setTimeout(function () {
                    _loadFromAPI(callback, attempt + 1);
                }, delay);
            } else {
                console.warn("[crimes] Все попытки исчерпаны, загружаю из кэша...");
                _tryLoadFromCache();
                callback();
            }
        });
}

function loadCrimesFromSheet(callback) {
    // Сначала показать кэш (мгновенно), затем обновить из API
    _tryLoadFromCache();
    if (crimeIncidents.length > 0) {
        console.log("[crimes] Показываем кэш, обновляем в фоне...");
        callback(); // сразу показать кэшированные данные
        // Обновить из API в фоне
        _loadFromAPI(function () {
            callback(); // обновить UI свежими данными
        });
    } else {
        // Кэша нет — ждём API
        _loadFromAPI(callback);
    }
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
function _loadPeopleCSV(callback) {
    console.log("[crimes] Загрузка людей из CSV...");
    fetch(PEOPLE_CSV_URL)
        .then(function (r) { return r.text(); })
        .then(function (txt) {
            var lines = _parseCSVRows(txt);
            if (lines.length < 2) { callback(); return; }
            var headers = _parseCSVLine(lines[0]);
            console.log("[crimes] CSV People headers:", headers.slice(0, 5).join(", "), "... total:", headers.length, "rows:", lines.length - 1);
            var people = [];
            for (var i = 1; i < lines.length; i++) {
                var cols = _parseCSVLine(lines[i]);
                var row = {};
                for (var j = 0; j < headers.length; j++) {
                    row[headers[j]] = cols[j] || "";
                }
                var person = jsonRowToPerson(row, i - 1);
                if (person) {
                    people.push(person);
                } else if (i < 4) {
                    console.log("[crimes] CSV row " + i + " returned null, row keys:", Object.keys(row).slice(0, 5).join(", "));
                }
            }
            if (people.length > 0) {
                crimePeople = people;
                _buildPeopleIndex();
                _saveCrimesCache();
                console.log("[crimes] Людей из CSV: " + crimePeople.length);
            }
            callback();
        })
        .catch(function (err) {
            console.warn("[crimes] Ошибка загрузки людей CSV:", err);
            callback();
        });
}

function _parseCSVLine(line) {
    var cells = [];
    var cur = "", inQ = false;
    for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (ch === '"') {
            if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
            else inQ = !inQ;
        } else if (ch === "," && !inQ) {
            cells.push(cur.trim()); cur = "";
        } else {
            cur += ch;
        }
    }
    cells.push(cur.trim());
    return cells;
}

function _parseCSVRows(text) {
    var rows = [];
    var cur = "", inQ = false;
    for (var i = 0; i < text.length; i++) {
        var ch = text[i];
        if (ch === '"') {
            cur += ch;
            inQ = !inQ;
        } else if ((ch === '\n' || ch === '\r') && !inQ) {
            if (ch === '\r' && text[i + 1] === '\n') i++;
            if (cur.trim()) rows.push(cur);
            cur = "";
        } else {
            cur += ch;
        }
    }
    if (cur.trim()) rows.push(cur);
    return rows;
}

function initCrimeData(onProgress, onDone) {
    loadCrimesFromSheet(function () {
        var withCoords = crimeIncidents.filter(function (c) {
            return typeof c.lat === "number" && !isNaN(c.lat);
        }).length;
        console.log("[crimes] С координатами: " + withCoords + " из " + crimeIncidents.length);
        _saveCrimesCache();

        // Всегда загружать людей из CSV (API не возвращает их)
        _loadPeopleCSV(function () {
            if (onDone) onDone();
            _notifyCrimesReady();
        });
    });
}

// ══════════════════════════════════════════════════════════════
//  Утилиты
// ══════════════════════════════════════════════════════════════

function getPeriodCutoff(period) {
    if (period === "all") return null;
    var now = new Date();
    switch (period) {
        case "day":
            // Вчерашний день (если сегодня 11-е, показываем данные за 10-е)
            return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        case "week":
            // Понедельник текущей недели
            var day = now.getDay(); // 0=Sun..6=Sat
            var diff = (day === 0) ? 6 : day - 1; // days since Monday
            var monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
            return monday;
        case "month":
            return new Date(now.getFullYear(), now.getMonth(), 1);
        case "quarter":
            var qMonth = Math.floor(now.getMonth() / 3) * 3;
            return new Date(now.getFullYear(), qMonth, 1);
        case "year":
            return new Date(now.getFullYear(), 0, 1);
        default:
            return null;
    }
}

function filterCrimesByPeriod(period) {
    var list = crimeIncidents.slice();
    var cutoff = getPeriodCutoff(period);
    if (!cutoff) return list;

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

function formatDateOnly(isoStr) {
    if (!isoStr) return "—";
    var d = new Date(isoStr);
    if (isNaN(d.getTime())) return String(isoStr).replace(/T.*/, "");
    return ("0" + d.getDate()).slice(-2) + "." + ("0" + (d.getMonth() + 1)).slice(-2) + "." + d.getFullYear();
}

function formatTimeOnly(isoStr) {
    if (!isoStr) return "";
    var d = new Date(isoStr);
    if (isNaN(d.getTime())) {
        var m = String(isoStr).match(/(\d{2}):(\d{2})/);
        return m ? m[1] + ":" + m[2] : "";
    }
    return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
}
