/**
 * Данные о зарегистрированных правонарушениях (ЕРДР).
 *
 * Координаты (lat/lng) определяются автоматически через Nominatim
 * по полям адреса (oblast, district, city, street, house).
 * Результаты геокодирования кэшируются в localStorage.
 */

var crimeIncidents = [
    {
        id: 1,
        erdr: "260000121000007",
        regDate: "2026-02-04T11:43:00",
        organ: "Агентство РК по финансовому мониторингу",
        crimeDate: "2025-01-01",
        crimeTime: "10:00",
        description: "Бір топ адамның, азаматтардың бірыңғай жинақтаушы зейнетақы қорындағы жинақтарын заңсыз шығару фактісі бойынша тергеп-тексеру. Стоматологиялық клиникалар арқылы жалған ДКК қорытындыларын жасау.",
        article: "ст.247 ч.2",
        articlePart: "",
        placeType: "медучреждение",
        isPublic: true,
        oblast: "Атырауская область",
        district: "Атырау",
        city: "Балықшы",
        street: "3",
        house: "24",
        building: "",
        apartment: ""
    },
    {
        id: 2,
        erdr: "260000121000025",
        regDate: "2026-03-17T01:02:00",
        organ: "Агентство РК по финансовому мониторингу",
        crimeDate: "2021-05-22",
        crimeTime: "15:26",
        description: "Стоматологиялық клиникалардың басшылары «БЗЖҚ» АҚ-нан салымшылардың зейнетақы төлемдерін заңсыз шығаруда жалған құжаттарды жасаған. ҚК-нің 385-бабы 2-бөлігі.",
        article: "ст.385 ч.2",
        articlePart: "",
        placeType: "офис",
        isPublic: true,
        oblast: "Атырау облысы",
        district: "Атырау",
        city: "АТЫРАУ",
        street: "",
        house: "",
        building: "",
        apartment: ""
    },
    {
        id: 3,
        erdr: "262300011000004",
        regDate: "2026-02-18T19:52:00",
        organ: "Прокуратура Атырауской области",
        crimeDate: "2025-07-05",
        crimeTime: "04:00",
        description: "«Барма» түнгі клубының алдында жәбірленуші Болатова Жадыра Иванқызын бұрыңғы жолдасы Ұзақбаев Асылхан басымен мұрнынан ұрып, мұрынын сындырған. ҚК-нің 107-бабы 1-бөлігі.",
        article: "ст.107 ч.1",
        articlePart: "",
        placeType: "улица (площадь)",
        isPublic: true,
        oblast: "Атырау облысы",
        district: "Атырау",
        city: "АТЫРАУ",
        street: "АЗАТТЫҚ",
        house: "2",
        building: "",
        apartment: ""
    },
    {
        id: 4,
        erdr: "262300011000003",
        regDate: "2026-02-05T19:27:00",
        organ: "Прокуратура Атырауской области",
        crimeDate: "2025-12-03",
        crimeTime: "12:00",
        description: "Полиция органдары қызметкерлерінің іс-әрекеттерінде ҚК-нің 433-бабы 3-бөлігі 1-тармағында көзделген қылмыстық құқық бұзушылық белгілері анықталды.",
        article: "ст.433 ч.3",
        articlePart: "п.1",
        placeType: "другие помещения",
        isPublic: false,
        oblast: "Атырау облысы",
        district: "Қызылқоға ауданы",
        city: "МИЯЛЫ",
        street: "УӘЛИ ЖАЙЫҚОВ",
        house: "13/1",
        building: "",
        apartment: ""
    },
    {
        id: 5,
        erdr: "262300011000005",
        regDate: "2026-03-23T18:00:00",
        organ: "Прокуратура Атырауской области",
        crimeDate: "2026-03-22",
        crimeTime: "19:00",
        description: "ҚАЖ-нің №15 мекемесінде сотталған Д.Утегенов қайтыс болған. Мекеме қызметкерлері бейне бақылау камерасы жабылғанына назар аудармай, медициналық көмекті қамтамасыз етпеген. ҚК-нің 370-бабы.",
        article: "ст.370 ч.4",
        articlePart: "п.1; п.2",
        placeType: "другие помещения",
        isPublic: false,
        oblast: "Атырау облысы",
        district: "Атырау",
        city: "ТАСҚАЛА",
        street: "",
        house: "",
        building: "1",
        apartment: ""
    },
    {
        id: 6,
        erdr: "262300031000011",
        regDate: "2026-02-17T20:56:00",
        organ: "ДП Атырауской области",
        crimeDate: "2023-12-20",
        crimeTime: "12:00",
        description: "Күдікті С.Литвиненконың жас бала жәбірленушіге (18.04.2015 ж.т.) қатысты жасаған іс-әрекетінде ҚК-нің 121-бабы 4-бөлігінде көзделген қылмыстық құқық бұзушылық құрамы анықталды.",
        article: "ст.121 ч.4",
        articlePart: "",
        placeType: "квартира",
        isPublic: false,
        oblast: "Атырау облысы",
        district: "Атырау",
        city: "АТЫРАУ",
        street: "АВАНГАРД-3",
        house: "76",
        building: "",
        apartment: "21"
    },
    {
        id: 7,
        erdr: "262300031000023",
        regDate: "2026-03-19T16:29:00",
        organ: "ДП Атырауской области",
        crimeDate: "2025-12-27",
        crimeTime: "12:00",
        description: "Күдікті С.Сарсемалиевке қатысты қаза болған М.Карабалинге тиесілі ірі қара малдарын ғаламтор желісі арқылы алаяқтық ниетпен сатып, мүліктік залал келтіру. ҚК-нің 190-бабы.",
        article: "ст.190 ч.2",
        articlePart: "п.4",
        placeType: "другие помещения",
        isPublic: false,
        oblast: "Атырау облысы",
        district: "Қызылқоға ауданы",
        city: "ЖАНГЕЛДИН",
        street: "",
        house: "",
        building: "",
        apartment: ""
    },
    {
        id: 8,
        erdr: "262300031000025",
        regDate: "2026-03-26T09:34:00",
        organ: "ДП Атырауской области",
        crimeDate: "2021-03-03",
        crimeTime: "10:00",
        description: "Тергелуші Утяшов А.С. 2021 жылы Сағыз ауылында 3 дана атыс қаруына ұқсас затты көміп жасырып кеткендігін мойындаған. ҚК-нің 287-бабы.",
        article: "ст.287 ч.2",
        articlePart: "",
        placeType: "лес, лесопосадка",
        isPublic: false,
        oblast: "Атырау облысы",
        district: "Қызылқоға ауданы",
        city: "САГИЗ",
        street: "АХТАН КЕРЕЙҰЛЫ",
        house: "1",
        building: "",
        apartment: ""
    },
    {
        id: 9,
        erdr: "262300031000017",
        regDate: "2026-03-09T19:04:00",
        organ: "ДП Атырауской области",
        crimeDate: "2025-05-10",
        crimeTime: "11:00",
        description: "С.Сарсемалиев Мұнайшы мөлтек ауданы, №3 көше, №7 үйде қайын аға туысқаны Мұқанғалиев Н.М.-ны пышақпен қазаға ұшыратқан. Мүрдесі іргетас жанынан табылған. ҚК-нің 99-бабы.",
        article: "ст.99 ч.1",
        articlePart: "",
        placeType: "дом",
        isPublic: false,
        oblast: "Атырау облысы",
        district: "Атырау",
        city: "АТЫРАУ",
        street: "№3",
        house: "17",
        building: "",
        apartment: ""
    },
    {
        id: 10,
        erdr: "262300031000022",
        regDate: "2026-03-18T11:01:00",
        organ: "ДП Атырауской области",
        crimeDate: "2026-03-18",
        crimeTime: "04:05",
        description: "Кәмелетке толмаған қызға (15.07.2010 ж.т.) қатысты жыныстық қатынас фактісі. ҚК-нің 122-бабы 1-бөлігі.",
        article: "ст.122 ч.1",
        articlePart: "",
        placeType: "дом",
        isPublic: false,
        oblast: "Атырау облысы",
        district: "Атырау",
        city: "АТЫРАУ",
        street: "Молдагулова",
        house: "102",
        building: "",
        apartment: ""
    },
    {
        id: 11,
        erdr: "262300031000021",
        regDate: "2026-03-16T19:11:00",
        organ: "ДП Атырауской области",
        crimeDate: "2025-01-14",
        crimeTime: "15:31",
        description: "Жанбырбаев Н.Ж. Instagram-да «hacker.atyrau» парақшасы арқылы алаяқтық жасап, Дүйсебаев Б.А.-дан Kaspi Bank арқылы 500 000 теңге аудартқызып, иемденген. ҚК-нің 190-бабы.",
        article: "ст.190 ч.3",
        articlePart: "п.4",
        placeType: "другие помещения",
        isPublic: false,
        oblast: "Атырау облысы",
        district: "Атырау",
        city: "АТЫРАУ",
        street: "1",
        house: "2",
        building: "",
        apartment: ""
    },
    {
        id: 12,
        erdr: "262300031000018",
        regDate: "2026-03-09T19:09:00",
        organ: "ДП Атырауской области",
        crimeDate: "2025-11-06",
        crimeTime: "13:00",
        description: "С.Сарсемалиев Мұнайшы мөлтек ауданы, №3 көше, №7 үйде қайын апа туысқаны Қарабалина М.М.-ны пышақпен қазаға ұшыратқан. Мүрдесі іргетас жанынан табылған. ҚК-нің 99-бабы 2-бөлігі.",
        article: "ст.99 ч.2",
        articlePart: "п.13",
        placeType: "дом",
        isPublic: false,
        oblast: "Атырау облысы",
        district: "Атырау",
        city: "АТЫРАУ",
        street: "№3",
        house: "17",
        building: "",
        apartment: ""
    },
    {
        id: 13,
        erdr: "262300041000002",
        regDate: "2026-01-14T15:18:00",
        organ: "ДКНБ по Атырауской области",
        crimeDate: "2026-01-14",
        crimeTime: "14:00",
        description: "ҚАЖ-нің №15 мекемесінде жазасын өтеуші сотталған Д.М.Амантурлиннің жазбаша арызы. ҚК-нің 287-бабы.",
        article: "ст.287 ч.3",
        articlePart: "",
        placeType: "прочие уличные",
        isPublic: true,
        oblast: "Атырау облысы",
        district: "Атырау",
        city: "ЖҰМЫСКЕР",
        street: "№16",
        house: "4",
        building: "",
        apartment: ""
    },
    {
        id: 14,
        erdr: "262300041000005",
        regDate: "2026-02-19T12:36:00",
        organ: "ДКНБ по Атырауской области",
        crimeDate: "2026-02-09",
        crimeTime: "09:45",
        description: "Шетел азаматтарының ҚР шекара өткізу пункттерінен тысқары жерлерден шекараны заңсыз кесіп өтіп, РФ аумағына заңсыз енуін ұйымдастыру фактісі. ҚК-нің 394-бабы.",
        article: "ст.394 ч.2",
        articlePart: "",
        placeType: "берег реки",
        isPublic: false,
        oblast: "Атырау облысы",
        district: "Құрманғазы ауданы",
        city: "КОПТОГАЙ",
        street: "Шайхы Әбішев",
        house: "1",
        building: "",
        apartment: ""
    },
    {
        id: 15,
        erdr: "262300041000004",
        regDate: "2026-02-04T17:03:00",
        organ: "ДКНБ по Атырауской области",
        crimeDate: "2025-05-15",
        crimeTime: "10:00",
        description: "РФ қарулы күштерінің құрамында Украина территориясында соғысқа қатысқан ҚР азаматы О.Слушаков туралы мәлімет. ҚК-нің 172-бабы — наемничество.",
        article: "ст.172",
        articlePart: "",
        placeType: "прочие уличные",
        isPublic: true,
        oblast: "Атырауская область",
        district: "Атырау",
        city: "АТЫРАУ",
        street: "ӘБДІРЕШ ДӘУЛЕТОВ",
        house: "5",
        building: "",
        apartment: ""
    },
    {
        id: 16,
        erdr: "262300041000003",
        regDate: "2026-01-15T16:43:00",
        organ: "ДКНБ по Атырауской области",
        crimeDate: "2026-01-15",
        crimeTime: "16:30",
        description: "«Мәскеу — Астана» рейсін рәсімдеу барысында мүрдесі салынған мырыш табыт анықталған. Туремуратов Данат (08.07.2005 ж.т.). ҚК-нің 172-бабы.",
        article: "ст.172",
        articlePart: "",
        placeType: "другие помещения",
        isPublic: false,
        oblast: "Атырау облысы",
        district: "Атырау",
        city: "АТЫРАУ",
        street: "",
        house: "",
        building: "",
        apartment: ""
    }
];

// ══════════════════════════════════════════════════════════════
//  Автоматическое геокодирование адресов через Nominatim
// ══════════════════════════════════════════════════════════════

var GEOCODE_CACHE_KEY = "atyrau-crime-geocode-cache";
var _geocodeCache = {};
var _crimeGeoReady = false;
var _crimeGeoCallbacks = [];

/** Вызывается когда все координаты определены */
function onCrimesGeoReady(fn) {
    if (_crimeGeoReady) { fn(); return; }
    _crimeGeoCallbacks.push(fn);
}

function _notifyCrimeGeoReady() {
    _crimeGeoReady = true;
    _crimeGeoCallbacks.forEach(function (fn) { fn(); });
}

/** Загрузить кэш из localStorage */
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
 * Построить строку запроса для Nominatim из полей адреса.
 * Пробует от конкретного (улица + дом) к общему (город).
 */
function _buildGeoQuery(crime) {
    var parts = [];

    // Улица + дом (убираем символы №)
    var street = (crime.street || "").replace(/№/g, "").trim();
    var house = (crime.house || "").trim();

    if (street && house) {
        parts.push(street + " " + house);
    } else if (street) {
        parts.push(street);
    }

    // Город / населённый пункт
    var city = (crime.city || "").trim();
    if (city) parts.push(city);

    // Район (если это не просто "Атырау")
    var district = (crime.district || "").trim();
    if (district && district.toLowerCase() !== city.toLowerCase() &&
        district !== "Атырау") {
        parts.push(district);
    }

    // Всегда добавляем Атырау область для контекста
    parts.push("Атырау");

    return parts.join(", ");
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
 * Возвращает Promise<{lat, lng} | null>.
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
 * Если улица+дом не нашлись — ищем только город/район.
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

    // 3. Только город/населённый пункт + район
    if (city && district && district !== "Атырау") {
        queries.push(city + ", " + district + ", Атырау");
    }

    // 4. Только город
    if (city) {
        queries.push(city + ", Атырау");
    }

    // 5. Атырау (самый общий fallback)
    queries.push("Атырау, Казахстан");

    // Последовательно пробуем каждый вариант
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
 * Использует кэш + делает запросы с задержкой (лимит Nominatim: 1 req/sec).
 */
function geocodeAllCrimes(callback) {
    _loadGeoCache();

    var needGeocode = [];

    // Сначала применяем кэш
    crimeIncidents.forEach(function (crime) {
        var key = _geoCacheKey(crime);
        if (_geocodeCache[key]) {
            crime.lat = _geocodeCache[key].lat;
            crime.lng = _geocodeCache[key].lng;
        } else {
            needGeocode.push(crime);
        }
    });

    if (needGeocode.length === 0) {
        console.log("[geocode] Все адреса в кэше (" + crimeIncidents.length + ")");
        if (callback) callback();
        return;
    }

    console.log("[geocode] Нужно геокодировать: " + needGeocode.length + " из " + crimeIncidents.length);

    var idx = 0;

    function processNext() {
        if (idx >= needGeocode.length) {
            _saveGeoCache();
            console.log("[geocode] Готово");
            if (callback) callback();
            return;
        }

        var crime = needGeocode[idx];
        var key = _geoCacheKey(crime);

        _geocodeWithFallback(crime).then(function (result) {
            if (result) {
                crime.lat = result.lat;
                crime.lng = result.lng;
                _geocodeCache[key] = result;
                console.log("[geocode] " + crime.erdr + " → " + result.lat.toFixed(4) + ", " + result.lng.toFixed(4));
            } else {
                // Fallback: центр Атырау
                crime.lat = 47.1067;
                crime.lng = 51.9203;
                _geocodeCache[key] = { lat: crime.lat, lng: crime.lng };
                console.warn("[geocode] " + crime.erdr + " — адрес не найден, поставлен центр Атырау");
            }

            idx++;
            // Nominatim: max 1 запрос в секунду
            setTimeout(processNext, 1100);
        });
    }

    processNext();
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
    var d = new Date(isoStr);
    var day = ("0" + d.getDate()).slice(-2);
    var month = ("0" + (d.getMonth() + 1)).slice(-2);
    var year = d.getFullYear();
    var hours = ("0" + d.getHours()).slice(-2);
    var mins = ("0" + d.getMinutes()).slice(-2);
    return day + "." + month + "." + year + " " + hours + ":" + mins;
}
