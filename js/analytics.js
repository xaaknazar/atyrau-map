/**
 * Аналитический движок преступлений — анализ данных ЕРДР.
 *
 * Вычисляет:
 *  - Проблемные зоны (кластеры по геолокации)
 *  - Распределение по статьям
 *  - Временные паттерны (час, день недели, месяц)
 *  - Анализ по типу места и общественным местам
 *  - Анализ по районам / населённым пунктам
 *  - Тренды во времени
 *  - AI-анализ через Claude API
 */

// ══════════════════════════════════════════════════════════════
//  1. РАСПРЕДЕЛЕНИЕ ПО СТАТЬЯМ
// ══════════════════════════════════════════════════════════════

/**
 * Извлечь номер статьи из полной квалификации.
 * "ст.214 ч.2" → "ст. 214"
 * "ст. 188 ч.1 п.г" → "ст. 188"
 */
function extractArticleNumber(article) {
    if (!article) return "Не указана";
    var m = article.match(/(\d{2,4})/);
    if (m) return "ст. " + m[1];
    return article;
}

function analyzeByArticle(crimes) {
    var map = {};
    crimes.forEach(function (c) {
        var key = extractArticleNumber(c.article);
        if (!map[key]) map[key] = { count: 0, label: key };
        map[key].count++;
    });
    return Object.values(map).sort(function (a, b) { return b.count - a.count; });
}

// ══════════════════════════════════════════════════════════════
//  2. ВРЕМЕННЫЕ ПАТТЕРНЫ
// ══════════════════════════════════════════════════════════════

function analyzeByHour(crimes) {
    var hours = [];
    for (var i = 0; i < 24; i++) hours[i] = 0;
    crimes.forEach(function (c) {
        if (!c.crimeTime) return;
        var m = String(c.crimeTime).match(/(\d{2}):/);
        if (m) hours[parseInt(m[1])]++;
    });
    return hours;
}

function analyzeByDayOfWeek(crimes) {
    var days = [0, 0, 0, 0, 0, 0, 0]; // Пн-Вс
    var dayNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
    crimes.forEach(function (c) {
        if (!c.crimeDate) return;
        var d = new Date(c.crimeDate);
        if (isNaN(d.getTime())) return;
        var day = d.getDay(); // 0=Вс, 1=Пн...
        var idx = day === 0 ? 6 : day - 1;
        days[idx]++;
    });
    return { counts: days, labels: dayNames };
}

function analyzeByMonth(crimes) {
    var months = {};
    crimes.forEach(function (c) {
        if (!c.regDate) return;
        var d = new Date(c.regDate);
        if (isNaN(d.getTime())) return;
        var key = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2);
        if (!months[key]) months[key] = 0;
        months[key]++;
    });
    var sorted = Object.keys(months).sort();
    return {
        labels: sorted.map(function (k) {
            var parts = k.split("-");
            var mNames = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
            return mNames[parseInt(parts[1]) - 1] + " " + parts[0];
        }),
        counts: sorted.map(function (k) { return months[k]; })
    };
}

// ══════════════════════════════════════════════════════════════
//  3. АНАЛИЗ ПО МЕСТАМ
// ══════════════════════════════════════════════════════════════

function analyzeByPlaceType(crimes) {
    var map = {};
    crimes.forEach(function (c) {
        var key = c.placeType || "Не указано";
        if (!map[key]) map[key] = { count: 0, label: key, publicCount: 0 };
        map[key].count++;
        if (c.isPublic) map[key].publicCount++;
    });
    return Object.values(map).sort(function (a, b) { return b.count - a.count; });
}

function analyzeByArea(crimes) {
    var map = {};
    crimes.forEach(function (c) {
        var area = c.city || c.district || "Не указано";
        if (!map[area]) map[area] = { count: 0, label: area, articles: {} };
        map[area].count++;
        if (c.article) {
            var artKey = extractArticleNumber(c.article);
            if (!map[area].articles[artKey]) map[area].articles[artKey] = 0;
            map[area].articles[artKey]++;
        }
    });
    return Object.values(map).sort(function (a, b) { return b.count - a.count; });
}

function analyzeByStreet(crimes) {
    var map = {};
    crimes.forEach(function (c) {
        if (!c.street) return;
        var key = c.street;
        if (!map[key]) map[key] = { count: 0, label: key, city: c.city || "", articles: {} };
        map[key].count++;
        if (c.article) {
            var artKey = extractArticleNumber(c.article);
            if (!map[key].articles[artKey]) map[key].articles[artKey] = 0;
            map[key].articles[artKey]++;
        }
    });
    return Object.values(map).sort(function (a, b) { return b.count - a.count; });
}

// Название района/улицы зоны по её преступлениям (most common район + улица)
function zoneAreaName(z) {
    if (!z || !z.crimes || !z.crimes.length) return "";
    var dC = {}, ctC = {}, sC = {};
    z.crimes.forEach(function (c) {
        if (c.district) dC[c.district] = (dC[c.district] || 0) + 1;
        if (c.city) ctC[c.city] = (ctC[c.city] || 0) + 1;
        if (c.street) sC[c.street] = (sC[c.street] || 0) + 1;
    });
    function _top(o) { var k = "", n = 0; Object.keys(o).forEach(function (x) { if (o[x] > n) { k = x; n = o[x]; } }); return k; }
    var district = _top(dC), city = _top(ctC), street = _top(sC);
    var place = district || city;
    var parts = [];
    if (place) parts.push(place);
    if (street) parts.push("ул. " + street);
    return parts.join(", ");
}

function analyzeByGeoZone(crimes, radius) {
    radius = radius || 0.005;
    var grid = {};
    crimes.forEach(function (c) {
        if (typeof c.lat !== "number" || isNaN(c.lat)) return;
        if (typeof c.lng !== "number" || isNaN(c.lng)) return;
        var cellLat = Math.floor(c.lat / radius) * radius;
        var cellLng = Math.floor(c.lng / radius) * radius;
        var key = cellLat.toFixed(4) + "," + cellLng.toFixed(4);
        if (!grid[key]) {
            grid[key] = {
                lat: cellLat + radius / 2,
                lng: cellLng + radius / 2,
                count: 0,
                crimes: [],
                streetNames: {},
                articles: {}
            };
        }
        var z = grid[key];
        z.count++;
        z.crimes.push(c);
        if (c.street) z.streetNames[c.street] = (z.streetNames[c.street] || 0) + 1;
        if (c.article) {
            var ak = extractArticleNumber(c.article);
            z.articles[ak] = (z.articles[ak] || 0) + 1;
        }
    });
    var zones = Object.values(grid).filter(function (z) { return z.count >= 2; });
    zones.forEach(function (z) {
        var bestStreet = "", bestCount = 0;
        Object.keys(z.streetNames).forEach(function (s) {
            if (z.streetNames[s] > bestCount) { bestStreet = s; bestCount = z.streetNames[s]; }
        });
        z.label = bestStreet
            ? bestStreet + " аймағы"
            : z.lat.toFixed(4) + ", " + z.lng.toFixed(4);
        z.coords = z.lat.toFixed(4) + ", " + z.lng.toFixed(4);
        var topArt = "", topC = 0;
        Object.keys(z.articles).forEach(function (a) {
            if (z.articles[a] > topC) { topArt = a; topC = z.articles[a]; }
        });
        z.topArticle = topArt;
        z.topArticleCount = topC;
    });
    return zones.sort(function (a, b) { return b.count - a.count; });
}

function analyzeByVictimType(crimes) {
    var map = {};
    crimes.forEach(function (c) {
        var key = c.victimType || "Не указано";
        if (!map[key]) map[key] = { count: 0, label: key };
        map[key].count++;
    });
    return Object.values(map).sort(function (a, b) { return b.count - a.count; });
}

function analyzeByCrimeMethod(crimes) {
    var map = {};
    crimes.forEach(function (c) {
        var key = c.crimeMethod || "Не указано";
        if (!map[key]) map[key] = { count: 0, label: key };
        map[key].count++;
    });
    return Object.values(map).sort(function (a, b) { return b.count - a.count; });
}

function analyzeBySecurity(crimes) {
    var map = {};
    crimes.forEach(function (c) {
        var key = c.security || "Не указано";
        if (!map[key]) map[key] = { count: 0, label: key };
        map[key].count++;
    });
    return Object.values(map).sort(function (a, b) { return b.count - a.count; });
}

// ══════════════════════════════════════════════════════════════
//  4. ПРОБЛЕМНЫЕ ЗОНЫ (кластеризация по координатам)
// ══════════════════════════════════════════════════════════════

/**
 * Простая grid-кластеризация: разбить карту на ячейки,
 * посчитать количество преступлений в каждой.
 * @param {Array} crimes
 * @param {number} gridSize — размер ячейки в градусах (~0.005 ≈ 500м)
 * @returns {Array} зоны отсортированные по опасности
 */
function findProblemZones(crimes, gridSize) {
    gridSize = gridSize || 0.005;
    var grid = {};

    crimes.forEach(function (c) {
        if (typeof c.lat !== "number" || typeof c.lng !== "number") return;
        if (isNaN(c.lat) || isNaN(c.lng)) return;

        var cellLat = Math.floor(c.lat / gridSize) * gridSize;
        var cellLng = Math.floor(c.lng / gridSize) * gridSize;
        var key = cellLat.toFixed(4) + "," + cellLng.toFixed(4);

        if (!grid[key]) {
            grid[key] = {
                lat: cellLat + gridSize / 2,
                lng: cellLng + gridSize / 2,
                count: 0,
                crimes: [],
                articles: {},
                hours: [],
                publicCount: 0
            };
        }

        var zone = grid[key];
        zone.count++;
        zone.crimes.push(c);
        if (c.article) {
            var zArtKey = extractArticleNumber(c.article);
            if (!zone.articles[zArtKey]) zone.articles[zArtKey] = 0;
            zone.articles[zArtKey]++;
        }
        if (c.isPublic) zone.publicCount++;

        if (c.crimeTime) {
            var m = String(c.crimeTime).match(/(\d{2}):/);
            if (m) zone.hours.push(parseInt(m[1]));
        }
    });

    var zones = Object.values(grid);

    // Вычислить дополнительные метрики для каждой зоны
    zones.forEach(function (z) {
        // Топ статья
        var topArt = "", topCount = 0;
        Object.keys(z.articles).forEach(function (a) {
            if (z.articles[a] > topCount) { topArt = a; topCount = z.articles[a]; }
        });
        z.topArticle = topArt;
        z.topArticleCount = topCount;
        z.uniqueArticles = Object.keys(z.articles).length;

        // Среднее время
        if (z.hours.length > 0) {
            var sum = z.hours.reduce(function (a, b) { return a + b; }, 0);
            z.avgHour = Math.round(sum / z.hours.length);
            // Пиковый час
            var hourBuckets = {};
            z.hours.forEach(function (h) { hourBuckets[h] = (hourBuckets[h] || 0) + 1; });
            var peakH = 0, peakC = 0;
            Object.keys(hourBuckets).forEach(function (h) {
                if (hourBuckets[h] > peakC) { peakH = parseInt(h); peakC = hourBuckets[h]; }
            });
            z.peakHour = peakH;
        }

        // Уровень опасности (1-5)
        z.dangerLevel = Math.min(5, Math.max(1, Math.ceil(z.count / 3)));
    });

    return zones.sort(function (a, b) { return b.count - a.count; });
}

// ══════════════════════════════════════════════════════════════
//  5. АНАЛИЗ ЛЮДЕЙ (Лист 2)
// ══════════════════════════════════════════════════════════════

function analyzePeopleByAge(people) {
    var groups = {
        "до 18": 0,
        "18-25": 0,
        "26-35": 0,
        "36-45": 0,
        "46-55": 0,
        "56+": 0,
        "Не указан": 0
    };
    people.forEach(function (p) {
        if (!p.age) { groups["Не указан"]++; return; }
        if (p.age < 18) groups["до 18"]++;
        else if (p.age <= 25) groups["18-25"]++;
        else if (p.age <= 35) groups["26-35"]++;
        else if (p.age <= 45) groups["36-45"]++;
        else if (p.age <= 55) groups["46-55"]++;
        else groups["56+"]++;
    });
    return Object.keys(groups).filter(function (k) { return groups[k] > 0; }).map(function (k) {
        return { label: k, count: groups[k] };
    });
}

function analyzePeopleByGender(people) {
    var map = {};
    people.forEach(function (p) {
        var key = p.gender || "Не указан";
        if (!map[key]) map[key] = { count: 0, label: key };
        map[key].count++;
    });
    return Object.values(map).sort(function (a, b) { return b.count - a.count; });
}

function analyzePeopleByEducation(people) {
    var map = {};
    people.forEach(function (p) {
        var key = p.education || "Не указано";
        if (!map[key]) map[key] = { count: 0, label: key };
        map[key].count++;
    });
    return Object.values(map).sort(function (a, b) { return b.count - a.count; });
}

function analyzePeopleByOccupation(people) {
    var map = {};
    people.forEach(function (p) {
        var key = p.occupation || "Не указан";
        if (!map[key]) map[key] = { count: 0, label: key };
        map[key].count++;
    });
    return Object.values(map).sort(function (a, b) { return b.count - a.count; });
}

function analyzePeopleByNationality(people) {
    var map = {};
    people.forEach(function (p) {
        var key = p.nationality || "Не указана";
        if (!map[key]) map[key] = { count: 0, label: key };
        map[key].count++;
    });
    return Object.values(map).sort(function (a, b) { return b.count - a.count; });
}

function analyzePeopleByMaritalStatus(people) {
    var map = {};
    people.forEach(function (p) {
        var key = p.maritalStatus || "Не указано";
        if (!map[key]) map[key] = { count: 0, label: key };
        map[key].count++;
    });
    return Object.values(map).sort(function (a, b) { return b.count - a.count; });
}

function runPeopleAnalysis(people) {
    var minorsCount = people.filter(function (p) {
        // Считаем по возрасту < 18 (надёжнее чем поле "Несовершеннолетний")
        return p.age !== null && p.age < 18;
    }).length;

    return {
        total: people.length,
        minors: minorsCount,
        byAge: analyzePeopleByAge(people),
        byGender: analyzePeopleByGender(people),
        byEducation: analyzePeopleByEducation(people),
        byOccupation: analyzePeopleByOccupation(people),
        byNationality: analyzePeopleByNationality(people),
        byMaritalStatus: analyzePeopleByMaritalStatus(people)
    };
}

// ══════════════════════════════════════════════════════════════
//  6. ПОЛНЫЙ АНАЛИЗ — собрать все данные
// ══════════════════════════════════════════════════════════════

function runFullAnalysis(crimes, people) {
    var ppl = people || crimePeople;
    var peopleAnalysis = ppl.length > 0 ? runPeopleAnalysis(ppl) : null;

    return {
        total: crimes.length,
        publicCount: crimes.filter(function (c) { return c.isPublic; }).length,
        withCoords: crimes.filter(function (c) { return typeof c.lat === "number" && !isNaN(c.lat); }).length,
        byArticle: analyzeByArticle(crimes),
        byHour: analyzeByHour(crimes),
        byDayOfWeek: analyzeByDayOfWeek(crimes),
        byMonth: analyzeByMonth(crimes),
        byPlaceType: analyzeByPlaceType(crimes),
        byArea: analyzeByArea(crimes),
        byStreet: analyzeByStreet(crimes),
        byGeoZone: analyzeByGeoZone(crimes),
        byVictimType: analyzeByVictimType(crimes),
        byCrimeMethod: analyzeByCrimeMethod(crimes),
        bySecurity: analyzeBySecurity(crimes),
        problemZones: findProblemZones(crimes),
        people: peopleAnalysis
    };
}

// ══════════════════════════════════════════════════════════════
//  6. ТЕКСТОВАЯ СВОДКА ДЛЯ AI
// ══════════════════════════════════════════════════════════════

/**
 * Сформировать текстовую сводку данных для отправки в AI.
 */
function buildAnalysisSummaryForAI(analysis, crimes) {
    var lines = [];
    lines.push("СВОДКА ПО ПРЕСТУПЛЕНИЯМ г. АТЫРАУ (данные ЕРДР, полная выборка)");
    lines.push("Всего правонарушений: " + analysis.total);
    if (analysis.total > 0) {
        lines.push("В общественных местах: " + analysis.publicCount + " (" + Math.round(analysis.publicCount / analysis.total * 100) + "%)");
        if (typeof analysis.withCoords === "number") {
            lines.push("С координатами на карте: " + analysis.withCoords + " (" + Math.round(analysis.withCoords / analysis.total * 100) + "%)");
        }
    }
    // Свежесть данных: период регистрации
    if (crimes && crimes.length) {
        var _minD = null, _maxD = null;
        crimes.forEach(function (c) {
            if (!c.regDate) return;
            var d = new Date(c.regDate);
            if (isNaN(d.getTime())) return;
            if (!_minD || d < _minD) _minD = d;
            if (!_maxD || d > _maxD) _maxD = d;
        });
        function _fd(d) { return ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + d.getFullYear(); }
        if (_minD && _maxD) lines.push("Период регистрации в данных: " + _fd(_minD) + " — " + _fd(_maxD));
    }
    // Инфраструктура города (отметки на карте)
    if (typeof _getMapCounts === "function") {
        var _mc = _getMapCounts();
        lines.push("Инфраструктура (отметки на карте): камеры — " + _mc.cameras + ", слепые зоны без камер — " + _mc.blindSpots + ", неосвещённые улицы — " + _mc.unlit + ", заброшенные здания — " + _mc.abandoned);
    }
    lines.push("");

    lines.push("ТОП-10 СТАТЕЙ:");
    analysis.byArticle.slice(0, 10).forEach(function (a, i) {
        lines.push("  " + (i + 1) + ". " + a.label + " — " + a.count + " случаев");
    });
    lines.push("");

    lines.push("ПО ВРЕМЕНИ СУТОК (час → кол-во):");
    analysis.byHour.forEach(function (count, h) {
        if (count > 0) lines.push("  " + ("0" + h).slice(-2) + ":00 — " + count);
    });
    lines.push("");

    lines.push("ПО ДНЯМ НЕДЕЛИ:");
    analysis.byDayOfWeek.labels.forEach(function (day, i) {
        lines.push("  " + day + " — " + analysis.byDayOfWeek.counts[i]);
    });
    lines.push("");

    lines.push("ПО МЕСЯЦАМ:");
    analysis.byMonth.labels.forEach(function (m, i) {
        lines.push("  " + m + " — " + analysis.byMonth.counts[i]);
    });
    lines.push("");

    lines.push("ТОП-10 РАЙОНОВ/НАСЕЛЁННЫХ ПУНКТОВ:");
    analysis.byArea.slice(0, 10).forEach(function (a, i) {
        var topArt = Object.keys(a.articles).sort(function (x, y) { return a.articles[y] - a.articles[x]; })[0] || "";
        lines.push("  " + (i + 1) + ". " + a.label + " — " + a.count + " (основная статья: " + topArt + ")");
    });
    lines.push("");

    lines.push("ТОП-10 УЛИЦ:");
    analysis.byStreet.slice(0, 10).forEach(function (s, i) {
        lines.push("  " + (i + 1) + ". " + s.label + " — " + s.count + " случаев");
    });
    lines.push("");

    lines.push("ПО ТИПУ МЕСТА:");
    analysis.byPlaceType.forEach(function (p) {
        lines.push("  " + p.label + " — " + p.count + " (из них в общественных: " + p.publicCount + ")");
    });
    lines.push("");

    lines.push("СОВЕРШЕНО В ОТНОШЕНИИ:");
    analysis.byVictimType.slice(0, 10).forEach(function (v) {
        lines.push("  " + v.label + " — " + v.count);
    });
    lines.push("");

    lines.push("СПОСОБ СОВЕРШЕНИЯ:");
    analysis.byCrimeMethod.slice(0, 10).forEach(function (m) {
        lines.push("  " + m.label + " — " + m.count);
    });
    lines.push("");

    lines.push("ОХРАНА ОБЪЕКТА:");
    analysis.bySecurity.forEach(function (s) {
        lines.push("  " + s.label + " — " + s.count);
    });
    lines.push("");

    if (analysis.problemZones.length > 0) {
        lines.push("ПРОБЛЕМНЫЕ ЗОНЫ (топ-8 по концентрации):");
        analysis.problemZones.slice(0, 8).forEach(function (z, i) {
            var _nm = (typeof zoneAreaName === "function") ? zoneAreaName(z) : "";
            lines.push("  " + (i + 1) + ". " + (_nm ? _nm + " " : "") + "(" + z.lat.toFixed(4) + ", " + z.lng.toFixed(4) + ")" +
                " — " + z.count + " преступлений" +
                ", основная статья: " + z.topArticle +
                ", пик: " + (z.peakHour !== undefined ? z.peakHour + ":00" : "нет данных"));
        });
    }
    lines.push("");

    // Данные о лицах (Лист 2)
    if (analysis.people) {
        var pa = analysis.people;
        lines.push("ДАННЫЕ О ЛИЦАХ (подозреваемые):");
        lines.push("Всего лиц: " + pa.total);
        lines.push("Несовершеннолетних: " + pa.minors);
        lines.push("");

        lines.push("ПО ВОЗРАСТУ:");
        pa.byAge.forEach(function (a) {
            lines.push("  " + a.label + " — " + a.count);
        });
        lines.push("");

        lines.push("ПО ПОЛУ:");
        pa.byGender.forEach(function (g) {
            lines.push("  " + g.label + " — " + g.count);
        });
        lines.push("");

        lines.push("ПО ОБРАЗОВАНИЮ:");
        pa.byEducation.forEach(function (e) {
            lines.push("  " + e.label + " — " + e.count);
        });
        lines.push("");

        lines.push("ПО РОДУ ЗАНЯТИЙ:");
        pa.byOccupation.slice(0, 10).forEach(function (o) {
            lines.push("  " + o.label + " — " + o.count);
        });
        lines.push("");

        lines.push("ПО СЕМЕЙНОМУ ПОЛОЖЕНИЮ:");
        pa.byMaritalStatus.forEach(function (m) {
            lines.push("  " + m.label + " — " + m.count);
        });
    }

    return lines.join("\n");
}

/**
 * Отправить данные в OpenAI API для ИИ-анализа.
 * @param {string} summaryText — текстовая сводка
 * @param {string} apiKey — ключ OpenAI API (sk-...)
 * @param {function} callback — function(error, analysisText)
 */
function requestAIAnalysis(summaryText, apiKey, callback) {
    var systemPrompt =
        "Ты — старший аналитик по безопасности города Атырау, Казахстан. " +
        "Работаешь в прокуратуре Атырауской области. " +
        "Твоя задача — на основе статистических данных о преступлениях подготовить " +
        "профессиональный аналитический отчёт для руководства прокуратуры. " +
        "Отвечай только на русском языке. Будь конкретен, указывай числа и факты из данных. " +
        "Формат: структурированный отчёт с разделами и подпунктами.";

    var userPrompt =
        "Проведи глубокий анализ криминогенной обстановки в городе Атырау на основе данных ЕРДР " +
        "(Единый реестр досудебных расследований). Подготовь отчёт по следующей структуре:\n\n" +

        "═══ 1. ОБЩАЯ ОЦЕНКА КРИМИНОГЕННОЙ ОБСТАНОВКИ ═══\n" +
        "- Общая характеристика ситуации\n" +
        "- Ключевые цифры и индикаторы\n\n" +

        "═══ 2. ПРОБЛЕМНЫЕ ЗОНЫ ═══\n" +
        "- Где концентрация преступлений максимальна\n" +
        "- Какие районы/улицы наиболее криминогенны\n" +
        "- Почему именно эти зоны проблемные (анализ причин)\n\n" +

        "═══ 3. ВРЕМЕННЫЕ ПАТТЕРНЫ ═══\n" +
        "- В какое время суток чаще совершаются преступления и почему\n" +
        "- Какие дни недели наиболее опасны\n" +
        "- Сезонные/месячные тренды\n\n" +

        "═══ 4. АНАЛИЗ ПО ТИПАМ ПРЕСТУПЛЕНИЙ ═══\n" +
        "- Какие статьи УК РК лидируют\n" +
        "- Что означает каждая ведущая статья (расшифровка)\n" +
        "- Связь между типом преступления и местом/временем\n\n" +

        "═══ 5. АНАЛИЗ ЖЕРТВ И СПОСОБОВ СОВЕРШЕНИЯ ═══\n" +
        "- В отношении кого совершаются преступления (физ. лица, юр. лица и т.д.)\n" +
        "- Какими способами совершаются преступления\n" +
        "- Наличие охраны на объектах — влияет ли на преступность\n\n" +

        "═══ 6. ПОРТРЕТ ПОДОЗРЕВАЕМОГО ═══\n" +
        "- Возрастные группы (какие доминируют)\n" +
        "- Пол, образование, род занятий\n" +
        "- Доля несовершеннолетних\n" +
        "- Семейное положение — есть ли корреляция\n\n" +

        "═══ 7. КОРНЕВЫЕ ПРИЧИНЫ ═══\n" +
        "- Социально-экономические факторы\n" +
        "- Инфраструктурные проблемы (освещение, камеры, патрулирование)\n" +
        "- Специфика города Атырау (нефтяной город, вахтовые работники и т.д.)\n\n" +

        "═══ 8. РЕКОМЕНДАЦИИ ПО СНИЖЕНИЮ ПРЕСТУПНОСТИ ═══\n" +
        "Конкретные, адресные меры:\n" +
        "8.1. Патрулирование — где именно и в какое время усилить\n" +
        "8.2. Видеонаблюдение — конкретные локации для установки камер\n" +
        "8.3. Освещение — где улучшить уличное освещение\n" +
        "8.4. Социальные программы — какие именно и для кого\n" +
        "8.5. Работа с населением — профилактика, правовое просвещение\n" +
        "8.6. Межведомственное взаимодействие — какие органы подключить\n\n" +

        "═══ 9. ПРОГНОЗ И ТРЕНДЫ ═══\n" +
        "- Растёт или снижается преступность\n" +
        "- Прогноз на ближайшие месяцы\n" +
        "- Какие виды преступлений могут вырасти\n\n" +

        "═══ 10. ПРИОРИТЕТНЫЕ ДЕЙСТВИЯ (ТОП-5) ═══\n" +
        "Самые важные и срочные меры, которые нужно предпринять прямо сейчас.\n\n" +

        "ДАННЫЕ ДЛЯ АНАЛИЗА:\n" + summaryText;

    fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + apiKey
        },
        body: JSON.stringify({
            model: "gpt-4o",
            max_tokens: 4000,
            temperature: 0.3,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ]
        })
    })
    .then(function (resp) {
        if (!resp.ok) return resp.text().then(function (t) { throw new Error("API " + resp.status + ": " + t); });
        return resp.json();
    })
    .then(function (data) {
        var text = data.choices && data.choices[0] && data.choices[0].message
            ? data.choices[0].message.content
            : "Нет ответа от AI";
        callback(null, text);
    })
    .catch(function (err) {
        callback(err, null);
    });
}

// ══════════════════════════════════════════════════════════════
//  7. ИИ ПОМОЩНИК ПРОКУРОРА (offline rule-based briefing)
// ══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
//  SMART FINDINGS ENGINE — prioritized prosecutorial findings
// ═══════════════════════════════════════════════════════════════

function buildSmartFindings(analysis, allCrimes) {
    var findings = [];
    var m = _getMapCounts();
    var total = analysis.total || 0;
    if (total === 0) return findings;

    var geoZones = (analysis.byGeoZone || []).slice(0, 15);
    var zones = (analysis.problemZones || []).filter(function (z) { return z.count <= 50; });
    var publicPct = Math.round((analysis.publicCount || 0) / total * 100);
    var minors = (analysis.people && analysis.people.minors) || 0;
    var minorsPct = analysis.people ? Math.round(minors / (analysis.people.total || 1) * 100) : 0;

    // Пиковые часы
    var hourPeaks = [];
    if (analysis.byHour) analysis.byHour.forEach(function (c, i) { hourPeaks.push({ h: i, c: c }); });
    hourPeaks.sort(function (a, b) { return b.c - a.c; });
    var top3h = hourPeaks.slice(0, 3).filter(function (x) { return x.c > 0; });

    // ── 1. Камеры / слепые зоны ──
    if (m.blindSpots > 0) {
        var camSeverity = Math.min(100, Math.round(m.blindSpots / (m.blindSpots + m.cameras + 1) * 100) + zones.length * 5);
        findings.push({
            type: "cameras",
            severity: camSeverity,
            title: "Бейнебақылау камераларының тапшылығы",
            subtitle: m.blindSpots + " соқыр нүкте, " + m.cameras + " камера орнатылған",
            facts: [
                "Бейнебақылау камераларымен қамтылмаған " + m.blindSpots + " нүкте анықталды",
                "Қазіргі таңда " + m.cameras + " камера орнатылған — бұл жеткіліксіз",
                zones.length > 0 ? "Қылмыс кластері бар " + zones.length + " аймақта камера жоқ" : null
            ].filter(Boolean),
            data: { blindSpots: m.blindSpots, cameras: m.cameras, zones: zones, geoZones: geoZones }
        });
    }

    // ── 2. Қараусыз ғимараттар ──
    if (m.abandoned > 0) {
        var abSeverity = Math.min(100, m.abandoned * 3 + (zones.length > 0 ? 20 : 0));
        findings.push({
            type: "abandoned",
            severity: abSeverity,
            title: "Қараусыз қалған ғимараттар",
            subtitle: m.abandoned + " ғимарат анықталды",
            facts: [
                m.abandoned + " қараусыз қалған ғимарат тіркелген",
                "Балалардың өмірі мен денсаулығына тікелей қауіп бар",
                "Маргиналды топтардың жиналу орнына айналу қаупі жоққа шығарылмайды"
            ],
            data: { count: m.abandoned }
        });
    }

    // ── 3. Жарықтандырылмаған аумақтар ──
    if (m.unlit > 0) {
        var nightCrimes = 0;
        if (analysis.byHour) {
            for (var h = 20; h < 24; h++) nightCrimes += (analysis.byHour[h] || 0);
            for (var h2 = 0; h2 < 6; h2++) nightCrimes += (analysis.byHour[h2] || 0);
        }
        var nightPct = Math.round(nightCrimes / total * 100);
        var ulSeverity = Math.min(100, m.unlit * 4 + nightPct);
        findings.push({
            type: "unlit",
            severity: ulSeverity,
            title: "Жарықтандырылмаған аумақтар",
            subtitle: m.unlit + " нүкте, түнгі қылмыс " + nightPct + "%",
            facts: [
                m.unlit + " жарықтандырылмаған нүкте анықталды",
                "Түнгі уақытта (20:00–06:00) " + nightCrimes + " қылмыс (" + nightPct + "%) тіркелген",
                "Жарықтандырудың болмауы қылмыс орын алуын тікелей арттырады"
            ],
            data: { count: m.unlit, nightCrimes: nightCrimes, nightPct: nightPct }
        });
    }

    // ── 4. Қауіпті аймақтар / патрульдеу ──
    if (geoZones.length > 0 && top3h.length > 0) {
        var topZone = geoZones[0];
        var patrolSeverity = Math.min(100, topZone.count * 2 + top3h[0].c);
        findings.push({
            type: "patrol",
            severity: patrolSeverity,
            title: "Қауіпті аймақтар мен патрульдеу",
            subtitle: geoZones.length + " аймақ, пик: " + top3h.map(function (x) { return ("0" + x.h).slice(-2) + ":00"; }).join(", "),
            facts: [
                "Ең қауіпті аймақ: " + topZone.label + " [" + topZone.coords + "] (" + topZone.count + " жағдай)",
                "Пик уақыт: " + top3h.map(function (x) { return ("0" + x.h).slice(-2) + ":00 (" + x.c + ")"; }).join(", "),
                zones.length > 0 ? zones.length + " қылмыс кластері анықталды" : null
            ].filter(Boolean),
            data: { geoZones: geoZones, hours: top3h, zones: zones }
        });
    }

    // ── 5. Қоғамдық орындар ──
    if (publicPct >= 30) {
        findings.push({
            type: "public",
            severity: Math.min(100, publicPct + 20),
            title: "Қоғамдық орындардағы қылмыс деңгейі",
            subtitle: analysis.publicCount + " жағдай (" + publicPct + "%)",
            facts: [
                total + " қылмыстың " + analysis.publicCount + "-і (" + publicPct + "%) қоғамдық орындарда орын алған",
                "Ведомствоаралық өзара іс-қимыл тиісті деңгейде жолға қойылмаған",
                publicPct >= 50 ? "50%-дан асуы — шұғыл шаралар қабылдау қажет" : null
            ].filter(Boolean),
            data: { count: analysis.publicCount, pct: publicPct }
        });
    }

    // ── 6. Кәмелетке толмағандар ──
    if (minors > 0) {
        findings.push({
            type: "minors",
            severity: Math.min(100, minors * 8 + minorsPct * 2),
            title: "Кәмелетке толмағандар арасындағы қылмыс",
            subtitle: minors + " тұлға (" + minorsPct + "%)",
            facts: [
                "Құқық бұзушылар арасында " + minors + " кәмелетке толмаған (" + minorsPct + "%)",
                "NEET санатындағы жастармен жұмыс жеткіліксіз",
                "Отбасын қолдау орталығының мүмкіндіктері кеңінен қолданылмауда"
            ],
            data: { minors: minors, pct: minorsPct, total: (analysis.people || {}).total || 0 }
        });
    }

    // Сортировка по severity (высокий → низкий)
    findings.sort(function (a, b) { return b.severity - a.severity; });
    return findings;
}

/**
 * Generate a structured analytical briefing for the Prosecutor.
 * Pure function — no external API.
 * Returns HTML string ready to inject.
 */
function buildProsecutorBriefing(analysis, allCrimes, lang) {
    lang = lang || "ru";
    var T = (typeof I18N !== "undefined" && I18N[lang]) ? I18N[lang] : {};
    function tr(key, ru) { return T[key] || ru; }
    function pct(n, total) { return total > 0 ? Math.round(n / total * 100) : 0; }
    function escH(s) { var d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }

    if (!analysis || analysis.total === 0) {
        return '<div class="assistant-empty">' + tr("assistant_no_data", "Нет данных за выбранный период.") + '</div>';
    }

    function sec(id, title, hint, inner, extraClass) {
        return '<div class="assistant-section' + (extraClass ? ' ' + extraClass : '') + '" id="' + id + '">'
            + '<div class="assistant-section-title">' + title + '</div>'
            + (hint ? '<div class="assistant-hint">' + hint + '</div>' : '')
            + inner + '</div>';
    }

    var nav = [];
    var blocks = [];

    var publicPct = pct(analysis.publicCount, analysis.total);
    var coordsPct = pct(analysis.withCoords, analysis.total);

    // период данных
    var periodStr = "";
    if (allCrimes && allCrimes.length) {
        var _minD = null, _maxD = null;
        allCrimes.forEach(function (c) {
            if (!c.regDate) return;
            var d = new Date(c.regDate);
            if (isNaN(d.getTime())) return;
            if (!_minD || d < _minD) _minD = d;
            if (!_maxD || d > _maxD) _maxD = d;
        });
        var _fd = function (d) { return ("0" + d.getDate()).slice(-2) + "." + ("0" + (d.getMonth() + 1)).slice(-2) + "." + d.getFullYear(); };
        if (_minD && _maxD) periodStr = _fd(_minD) + " — " + _fd(_maxD);
    }

    // подготовка данных
    var topArt = analysis.byArticle.slice(0, 10);
    var topGeoZones = (analysis.byGeoZone || []).slice(0, 10);
    var validZones = (analysis.problemZones || []).filter(function (z) { return z.count <= 50; });
    var hourPeaks = [];
    analysis.byHour.forEach(function (count, h) { hourPeaks.push({ h: h, c: count }); });
    hourPeaks.sort(function (a, b) { return b.c - a.c; });
    var top3Hours = hourPeaks.slice(0, 3).filter(function (x) { return x.c > 0; });
    var dayPeaks = analysis.byDayOfWeek.labels.map(function (d, i) { return { d: d, c: analysis.byDayOfWeek.counts[i] }; })
        .sort(function (a, b) { return b.c - a.c; });

    // ── Сводка (KPI) ─────────────────────────────────
    var kpi = '<div class="assistant-summary-grid">';
    kpi += '<div class="assistant-stat"><div class="assistant-stat-value">' + analysis.total + '</div><div class="assistant-stat-label">' + tr("brief_total", "Всего") + '</div></div>';
    kpi += '<div class="assistant-stat"><div class="assistant-stat-value">' + analysis.byArticle.length + '</div><div class="assistant-stat-label">' + tr("brief_articles", "Статей") + '</div></div>';
    kpi += '<div class="assistant-stat"><div class="assistant-stat-value">' + analysis.problemZones.length + '</div><div class="assistant-stat-label">' + tr("brief_zones", "Зон") + '</div></div>';
    kpi += '<div class="assistant-stat"><div class="assistant-stat-value">' + publicPct + '%</div><div class="assistant-stat-label">' + tr("brief_public_short", "Общ. места") + '</div></div>';
    kpi += '<div class="assistant-stat"><div class="assistant-stat-value">' + coordsPct + '%</div><div class="assistant-stat-label">' + tr("brief_coords_short", "С коорд.") + '</div></div>';
    kpi += '</div>';
    if (periodStr) kpi += '<div class="assistant-period">' + tr("brief_period", "Период данных") + ': <strong>' + escH(periodStr) + '</strong></div>';
    blocks.push(sec("sec-summary", tr("brief_summary_ru", "Сводка"), "", kpi, "assistant-summary"));

    // ── Приоритетные проблемы (smart findings) ───────
    var smartFindings = buildSmartFindings(analysis, allCrimes);
    if (smartFindings.length > 0) {
        var pf = '<div class="usynu-findings-list">';
        smartFindings.forEach(function (f) {
            var sevCls = f.severity >= 70 ? "sev-high" : (f.severity >= 40 ? "sev-med" : "sev-low");
            pf += '<div class="usynu-finding ' + sevCls + '">';
            pf += '<div class="usynu-finding-head">';
            pf += '<div class="usynu-finding-sev"><div class="sev-bar" style="width:' + f.severity + '%;"></div></div>';
            pf += '<span class="usynu-finding-score">' + f.severity + '</span>';
            pf += '</div>';
            pf += '<div class="usynu-finding-title">' + escH(f.title) + '</div>';
            pf += '<div class="usynu-finding-sub">' + escH(f.subtitle) + '</div>';
            pf += '<ul class="usynu-finding-facts">';
            f.facts.forEach(function (fact) { pf += '<li>' + escH(fact) + '</li>'; });
            pf += '</ul>';
            pf += '<button class="usynu-download-btn" data-usynu-type="' + f.type + '">' + tr("brief_download_usynu", "ҰСЫНУ жүктеу") + '</button>';
            pf += '</div>';
        });
        pf += '</div>';
        nav.push({ id: "sec-priority", label: tr("nav_priority", "Приоритеты") });
        blocks.push(sec("sec-priority", tr("brief_priority", "Приоритетные проблемы"), tr("brief_priority_hint", "Система выделила самые значимые проблемы. По каждой можно сформировать акт надзора."), pf, "assistant-priority"));
    }

    // ── Рекомендации ────────────────────────────────
    var recs = [];
    if (top3Hours.length > 0) {
        recs.push(tr("rec_patrol", "Усилить патрулирование в пиковые часы:") + " " + top3Hours.map(function (x) { return ("0" + x.h).slice(-2) + ":00"; }).join(", "));
    }
    if (topGeoZones.length > 0) {
        recs.push(tr("rec_zones", "Установить надзор в районах:") + " " + topGeoZones.slice(0, 3).map(function (z) { return z.label + " [" + z.coords + "]"; }).join(", "));
    }
    if (validZones.length > 0) {
        recs.push(tr("rec_cameras", "Рассмотреть установку камер в горячих зонах #1–#") + Math.min(3, validZones.length));
    }
    if (publicPct >= 50) {
        recs.push(tr("rec_public", "Доля преступлений в общественных местах превышает 50% — требуется межведомственное взаимодействие с акиматом и полицией"));
    }
    if (topArt.length > 0) {
        recs.push(tr("rec_article", "Приоритетная статья УК — ") + topArt[0].label + " (" + topArt[0].count + " " + tr("brief_cases", "случаев") + "). " + tr("rec_article_action", "Провести анализ причин и условий."));
    }
    if (analysis.people && analysis.people.minors && analysis.people.minors > 0) {
        recs.push(tr("rec_minors", "Среди правонарушителей выявлено") + " " + analysis.people.minors + " " + tr("rec_minors_end", "несовершеннолетних — направить материалы в комиссию по делам несовершеннолетних"));
    }
    if (recs.length > 0) {
        var ri = '<ol class="assistant-rec-list">';
        recs.forEach(function (r) { ri += '<li>' + escH(r) + '</li>'; });
        ri += '</ol>';
        nav.push({ id: "sec-recs", label: tr("nav_recs", "Рекомендации") });
        blocks.push(sec("sec-recs", tr("brief_recommendations", "Рекомендации прокурору"), "", ri, "assistant-recommendations"));
    }

    // ── Топ статей ──────────────────────────────────
    var ai = '<div class="assistant-table-wrap"><table class="assistant-table"><thead><tr>';
    ai += '<th class="col-num">#</th><th>' + tr("brief_article", "Статья") + '</th>';
    ai += '<th class="col-num">' + tr("brief_count", "Кол-во") + '</th>';
    ai += '<th class="col-num">' + tr("brief_share", "Доля") + '</th>';
    ai += '<th>' + tr("brief_main_zone", "Основной район") + '</th>';
    ai += '</tr></thead><tbody>';
    topArt.forEach(function (a, i) {
        var streetCounter = {};
        allCrimes.forEach(function (c) {
            if (c.article === a.label && c.street) {
                streetCounter[c.street] = (streetCounter[c.street] || 0) + 1;
            }
        });
        var topStreet = Object.keys(streetCounter).sort(function (x, y) { return streetCounter[y] - streetCounter[x]; })[0];
        var streetText = topStreet ? (topStreet + " (" + streetCounter[topStreet] + ")") : "—";
        ai += '<tr>';
        ai += '<td class="col-num"><span class="rank-badge">' + (i + 1) + '</span></td>';
        ai += '<td><strong>' + escH(a.label) + '</strong></td>';
        ai += '<td class="col-num">' + a.count + '</td>';
        ai += '<td class="col-num">' + pct(a.count, analysis.total) + '%</td>';
        ai += '<td class="muted">' + escH(streetText) + '</td>';
        ai += '</tr>';
    });
    ai += '</tbody></table></div>';
    ai += '<button class="brief-export-btn" data-export="articles">Excel</button>';
    nav.push({ id: "sec-articles", label: tr("nav_articles", "Статьи") });
    blocks.push(sec("sec-articles", tr("brief_top_articles", "Топ статей УК — структура преступности"), "", ai));

    // ── Топ зон по координатам ──────────────────────
    var gi = '<div class="assistant-table-wrap"><table class="assistant-table"><thead><tr>';
    gi += '<th class="col-num">#</th>';
    gi += '<th>' + tr("brief_area", "Район / улица") + '</th>';
    gi += '<th>' + tr("brief_coords", "Координаты") + '</th>';
    gi += '<th class="col-num">' + tr("brief_count", "Кол-во") + '</th>';
    gi += '<th>' + tr("brief_main_art", "Осн. статья") + '</th>';
    gi += '<th></th>';
    gi += '</tr></thead><tbody>';
    topGeoZones.forEach(function (z, i) {
        var topArts = Object.keys(z.articles).sort(function (x, y) { return z.articles[y] - z.articles[x]; })
            .slice(0, 3).map(function (a) { return a + " (" + z.articles[a] + ")"; }).join(", ");
        gi += '<tr>';
        gi += '<td class="col-num"><span class="rank-badge">' + (i + 1) + '</span></td>';
        gi += '<td>' + escH(zoneAreaName(z) || z.label || "—") + '</td>';
        gi += '<td class="muted mono">' + escH(z.coords) + '</td>';
        gi += '<td class="col-num"><strong>' + z.count + '</strong></td>';
        gi += '<td class="muted">' + escH(topArts || "—") + '</td>';
        gi += '<td class="col-act"><button class="an-zone-map-btn mini-btn" data-lat="' + z.lat + '" data-lng="' + z.lng + '">' + tr("on_map", "На карте") + '</button></td>';
        gi += '</tr>';
    });
    gi += '</tbody></table></div>';
    gi += '<button class="brief-export-btn" data-export="geozones">Excel</button>';
    nav.push({ id: "sec-geo", label: tr("nav_geo", "Зоны") });
    blocks.push(sec("sec-geo", tr("brief_geo_zones", "Топ зон по координатам"), tr("brief_geo_hint", "Группировка по координатам (радиус ~500м)"), gi));

    // ── Горячие зоны ────────────────────────────────
    if (validZones.length > 0) {
        var hi = '';
        validZones.slice(0, 5).forEach(function (z, i) {
            var dangerCls = z.dangerLevel >= 3 ? "danger-high" : (z.dangerLevel >= 2 ? "danger-mid" : "danger-low");
            hi += '<div class="assistant-zone ' + dangerCls + '">';
            hi += '<div class="assistant-zone-head">';
            hi += '<span class="assistant-zone-num">#' + (i + 1) + '</span>';
            hi += '<span class="assistant-zone-count">' + z.count + ' ' + tr("brief_cases", "случаев") + '</span>';
            hi += '<span class="assistant-zone-coords">' + z.lat.toFixed(4) + ', ' + z.lng.toFixed(4) + '</span>';
            hi += '</div>';
            hi += '<div class="assistant-zone-body">';
            if (z.topArticle) hi += '<div><strong>' + tr("brief_main_article", "Основная статья") + ':</strong> ' + escH(z.topArticle) + '</div>';
            if (typeof z.peakHour === "number") hi += '<div><strong>' + tr("brief_peak_hour", "Пиковый час") + ':</strong> ' + ("0" + z.peakHour).slice(-2) + ':00</div>';
            hi += '</div>';
            hi += '</div>';
        });
        hi += '<div class="assistant-btn-row">';
        hi += '<button class="brief-export-btn" data-export="hotzones">Excel</button>';
        hi += '<button class="brief-export-btn an-zone-map-btn" data-export="showallzones">' + tr("an_show_map", "Показать на карте") + '</button>';
        hi += '</div>';
        nav.push({ id: "sec-hot", label: tr("nav_hot", "Очаги") });
        blocks.push(sec("sec-hot", tr("brief_hot_zones", "Горячие зоны (радиус ~500 м)"), tr("brief_hot_hint", "Кластеры преступности — приоритетные участки"), hi));
    }

    // ── Опасное время ───────────────────────────────
    var ti = '<div class="assistant-time-grid">';
    ti += '<div><strong>' + tr("brief_peak_hours", "Пиковые часы") + ':</strong><br>';
    ti += top3Hours.map(function (x) { return ("0" + x.h).slice(-2) + ':00 (' + x.c + ')'; }).join(" · ") + '</div>';
    ti += '<div><strong>' + tr("brief_peak_day", "Самый опасный день") + ':</strong><br>' + escH(dayPeaks[0].d) + ' (' + dayPeaks[0].c + ' ' + tr("brief_cases", "случаев") + ')</div>';
    ti += '</div>';
    nav.push({ id: "sec-time", label: tr("nav_time", "Время") });
    blocks.push(sec("sec-time", tr("brief_danger_time", "Опасное время"), "", ti));

    // ── Тренд ───────────────────────────────────────
    if (analysis.byMonth && analysis.byMonth.counts && analysis.byMonth.counts.length >= 3) {
        var c = analysis.byMonth.counts;
        var lab = analysis.byMonth.labels || [];
        var prev = c[c.length - 2];
        var prevPrev = c[c.length - 3];
        var prevLabel = lab[lab.length - 2] || "";
        var prevPrevLabel = lab[lab.length - 3] || "";
        var diff = prev - prevPrev;
        var diffPct = prevPrev > 0 ? Math.round(diff / prevPrev * 100) : 0;
        var trendIcon = diff > 0 ? "↑" : (diff < 0 ? "↓" : "→");
        var trendCls = diff > 0 ? "trend-up" : (diff < 0 ? "trend-down" : "trend-flat");
        var tri = '<div class="assistant-trend ' + trendCls + '">';
        tri += trendIcon + ' ' + (diff >= 0 ? "+" : "") + diff + ' ' + tr("brief_cases", "случаев") + ' (' + (diffPct >= 0 ? "+" : "") + diffPct + '%)';
        tri += '</div>';
        if (prevLabel && prevPrevLabel) {
            tri += '<div class="assistant-trend-detail">' + escH(prevLabel) + ': <strong>' + prev + '</strong> ' + tr("brief_vs", "против") + ' ' + escH(prevPrevLabel) + ': <strong>' + prevPrev + '</strong></div>';
        }
        nav.push({ id: "sec-trend", label: tr("nav_trend", "Тренд") });
        blocks.push(sec("sec-trend", tr("brief_trend", "Тренд между завершёнными месяцами"), "", tri));
    }

    // ── Профиль правонарушителей ────────────────────
    if (analysis.people) {
        var p = analysis.people;
        var pi = '<div class="assistant-people-grid">';
        if (p.total) pi += '<div><strong>' + tr("brief_total_persons", "Всего лиц") + ':</strong> ' + p.total + '</div>';
        if (p.minors) pi += '<div><strong>' + tr("brief_minors", "Несовершеннолетних") + ':</strong> ' + p.minors + ' (' + pct(p.minors, p.total) + '%)</div>';
        if (p.byGender && p.byGender[0]) pi += '<div><strong>' + tr("brief_gender", "Преобл. пол") + ':</strong> ' + escH(p.byGender[0].label) + ' (' + p.byGender[0].count + ')</div>';
        if (p.byAge && p.byAge[0]) pi += '<div><strong>' + tr("brief_age_group", "Возрастная группа") + ':</strong> ' + escH(p.byAge[0].label) + '</div>';
        if (p.byOccupation && p.byOccupation[0]) pi += '<div><strong>' + tr("brief_occupation", "Род занятий") + ':</strong> ' + escH(p.byOccupation[0].label) + '</div>';
        pi += '</div>';
        pi += '<div class="assistant-btn-row">';
        pi += '<button class="brief-export-btn" data-export="people">Excel</button>';
        pi += '<button class="brief-export-btn" data-export="allpeople">' + tr("brief_all_persons", "Все лица") + '</button>';
        pi += '<div class="brief-search-wrap"><input type="text" id="brief-people-search" class="brief-search-input" placeholder="' + tr("brief_search_person", "Поиск по ФИО...") + '" /></div>';
        pi += '</div>';
        nav.push({ id: "sec-people", label: tr("nav_people", "Лица") });
        blocks.push(sec("sec-people", tr("brief_offenders", "Профиль правонарушителей"), "", pi));
    }

    // ── Заведения и преступность ────────────────────
    if (typeof venuePoints !== "undefined" && venuePoints.length > 0) {
        var VENUE_RADIUS = 0.001;
        var venueStats = [];
        venuePoints.forEach(function (v) {
            var nearby = 0;
            var arts = {};
            allCrimes.forEach(function (c) {
                if (typeof c.lat !== "number" || isNaN(c.lat)) return;
                var dLat = Math.abs(c.lat - v.lat);
                var dLng = Math.abs(c.lng - v.lng);
                if (dLat <= VENUE_RADIUS && dLng <= VENUE_RADIUS) {
                    nearby++;
                    if (c.article) {
                        var num = c.article.match(/(\d{2,4})/);
                        var key = num ? "ст. " + num[1] : c.article;
                        arts[key] = (arts[key] || 0) + 1;
                    }
                }
            });
            if (nearby > 0) {
                var topArtArr = Object.keys(arts).sort(function (a, b) { return arts[b] - arts[a]; }).slice(0, 3);
                venueStats.push({ name: v.name, addr: v.addr || "", count: nearby, lat: v.lat, lng: v.lng, topArts: topArtArr.map(function (a) { return a + " (" + arts[a] + ")"; }).join(", ") });
            }
        });
        venueStats.sort(function (a, b) { return b.count - a.count; });
        if (venueStats.length > 0) {
            var vi = '<div class="assistant-table-wrap"><table class="assistant-table"><thead><tr>';
            vi += '<th class="col-num">#</th>';
            vi += '<th>' + tr("brief_venue_name", "Заведение") + '</th>';
            vi += '<th class="col-num">' + tr("brief_count", "Кол-во") + '</th>';
            vi += '<th>' + tr("brief_main_art", "Осн. статья") + '</th>';
            vi += '<th></th>';
            vi += '</tr></thead><tbody>';
            venueStats.slice(0, 15).forEach(function (v, i) {
                vi += '<tr>';
                vi += '<td class="col-num"><span class="rank-badge">' + (i + 1) + '</span></td>';
                vi += '<td><strong>' + escH(v.name) + '</strong><br><span class="muted" style="font-size:11px;">' + escH(v.addr) + '</span></td>';
                vi += '<td class="col-num"><strong>' + v.count + '</strong></td>';
                vi += '<td class="muted">' + escH(v.topArts || "—") + '</td>';
                vi += '<td class="col-act"><button class="an-venue-map-btn mini-btn" data-lat="' + v.lat + '" data-lng="' + v.lng + '" data-name="' + escH(v.name) + '">' + tr("on_map", "На карте") + '</button></td>';
                vi += '</tr>';
            });
            vi += '</tbody></table></div>';
            vi += '<button class="brief-export-btn" data-export="venues_crimes">Excel</button>';
            nav.push({ id: "sec-venues", label: tr("nav_venues", "Заведения") });
            blocks.push(sec("sec-venues", tr("brief_venues_crimes", "Заведения и преступность (радиус 100м)"), tr("brief_venues_hint", "Заведения рядом с которыми зафиксированы преступления"), vi));
        }
    }

    // ── Дополнительные возможности ──────────────────
    var ei = '<ul class="assistant-rec-list">';
    ei += '<li>' + tr("extra_predict", "Прогнозирование риска по дням и зонам на основании исторических трендов") + '</li>';
    ei += '<li>' + tr("extra_correlate", "Корреляция с инфраструктурой: освещение, камеры, заброшенные здания") + '</li>';
    ei += '<li>' + tr("extra_repeat", "Выявление повторных правонарушителей по ФИО и адресам") + '</li>';
    ei += '<li>' + tr("extra_routes", "Построение маршрутов прокурорских проверок по горячим зонам") + '</li>';
    ei += '<li>' + tr("extra_alerts", "Уведомления при резком росте преступности на конкретном районе") + '</li>';
    ei += '</ul>';
    nav.push({ id: "sec-extra", label: tr("nav_extra", "Ещё") });
    blocks.push(sec("sec-extra", tr("brief_extra", "Дополнительные возможности"), "", ei, "assistant-extra"));

    // ── Навигация по разделам ───────────────────────
    var navHtml = "";
    if (nav.length > 0) {
        navHtml = '<div class="assistant-nav">';
        nav.forEach(function (n) {
            navHtml += '<button class="assistant-nav-chip" onclick="var e=document.getElementById(\'' + n.id + '\');if(e)e.scrollIntoView({behavior:\'smooth\',block:\'start\'});">' + escH(n.label) + '</button>';
        });
        navHtml += '</div>';
    }

    return navHtml + blocks.join("");
}

// ═══════════════════════════════════════════════════════════════
//  ҰСЫНУ DOCUMENT GENERATORS (per-type)
// ═══════════════════════════════════════════════════════════════

var _usynuCSS =
    '@page{size:A4;margin:2cm 1.5cm 2cm 3cm;}' +
    'body{font-family:"Times New Roman",serif;font-size:14pt;line-height:1.5;margin:2cm 1.5cm 2cm 3cm;padding:0;color:#000;}' +
    'p{text-align:justify;text-indent:1.25cm;margin:4pt 0;}' +
    '.addr{text-align:right;margin-bottom:30pt;line-height:1.4;}' +
    '.blank{border-bottom:1px solid #000;display:inline-block;min-width:250px;height:18px;}' +
    '.title{text-align:center;font-weight:bold;font-size:14pt;margin:20pt 0 4pt;text-transform:uppercase;}' +
    '.subtitle{text-align:center;font-size:14pt;margin-bottom:20pt;}' +
    '.rec-title{text-align:center;font-weight:bold;font-size:14pt;margin:20pt 0 12pt;text-transform:uppercase;}' +
    'ol{margin-left:1.25cm;padding-left:0.5cm;}' +
    'ul{margin-left:1.25cm;padding-left:0.5cm;list-style-type:disc;}' +
    'ol li,ul li{margin-bottom:6pt;text-align:justify;}' +
    '.sign{margin-top:50pt;}' +
    '.sign-table{width:100%;border:none;}' +
    '.sign-table td{border:none;padding:4pt 0;vertical-align:bottom;}' +
    '.sign-left{text-align:left;}' +
    '.sign-right{text-align:right;}' +
    '.exec{margin-top:70pt;font-size:12pt;}' +
    '.page-break{page-break-before:always;}';

function _usynuStart() {
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' + _usynuCSS + '</style></head><body>' +
        '<div class="addr"><span class="blank">&nbsp;</span><br><span class="blank">&nbsp;</span></div>' +
        '<div class="title">ҰСЫНУ</div>' +
        '<div class="subtitle">заңдылықтың бұзылуын жою туралы</div>';
}

function _usynuEnd() {
    return '<p style="margin-top:20px;">Жоғарыдағылардың негізінде, Қазақстан Республикасы Конституциясының 83-бабын, «Прокуратура туралы» Конституциялық заңның 36-бабын басшылыққа алып,</p>' +
        '<div class="rec-title">ҰСЫНАМЫН:</div>';
}

function _usynuSignature() {
    return '<li>Ұсынуды заңда көзделген мерзімде прокурордың қатысуымен қарап, нәтижесі туралы толықтай ақпаратты дәлелді құжаттарымен қоса қала прокуратурасына жолдауды.</li></ol>' +
        '<p>Қосымша: тізім «___» парақта.</p>' +
        '<div class="sign">' +
        '<table class="sign-table"><tr>' +
        '<td class="sign-left">Қала прокуроры</td>' +
        '<td class="sign-right"><span class="blank">&nbsp;</span></td>' +
        '</tr></table>' +
        '</div>' +
        '<div class="exec">Орынд.: _________________<br>Тел.: _________________</div>' +
        '</body></html>';
}

function _usynuDownload(html, name) {
    // Word-compatible HTML with mso namespace
    var wordHtml = '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
        'xmlns:w="urn:schemas-microsoft-com:office:word" ' +
        'xmlns="http://www.w3.org/TR/REC-html40">' +
        '<head><meta charset="utf-8">' +
        '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View>' +
        '<w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->' +
        html.replace(/^<!DOCTYPE html><html><head><meta charset="utf-8">/, '')
            .replace(/<meta name="viewport"[^>]*>/, '');
    var blob = new Blob(['\ufeff' + wordHtml], { type: 'application/msword' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'Usynu_' + name + '_' + new Date().toISOString().slice(0, 10) + '.doc';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

function _getMapCounts() {
    var r = { blindSpots: 0, abandoned: 0, unlit: 0, cameras: 0 };
    if (typeof mapPoints !== "undefined") mapPoints.forEach(function (p) {
        if (p.category === "blind-spots") r.blindSpots++;
        else if (p.category === "abandoned") r.abandoned++;
        else if (p.category === "unlit") r.unlit++;
    });
    if (typeof cameraPoints !== "undefined") r.cameras = cameraPoints.length;
    return r;
}

function _peakHoursStr(analysis) {
    var h = [];
    if (analysis.byHour) analysis.byHour.forEach(function (c, i) { h.push({ h: i, c: c }); });
    h.sort(function (a, b) { return b.c - a.c; });
    return h.slice(0, 3).filter(function (x) { return x.c > 0; }).map(function (x) { return ("0" + x.h).slice(-2) + ":00"; }).join(", ");
}

// ── CAMERAS (слепые зоны / бейнебақылау) ─────────────────────
_usynuGenerators = {};
_usynuGenerators.cameras = function (a) {
    var m = _getMapCounts();
    var geoZones = (a.byGeoZone || []).slice(0, 10);
    var d = _usynuStart();
    d += '<p>Қала прокуратурасы қадағалау аумағындағы қоғамдық қауіпсіздікті қамтамасыз ету және құқық бұзушылықтың алдын алу мақсатында бейнебақылау камераларының жай-күйіне талдау жүргізді.</p>';
    d += '<p>«Құқық бұзушылық профилактикасы туралы» Қазақстан Республикасы Заңының (бұдан әрі – Заң) 6-бабының 2-тармағына сәйкес, жергілікті атқарушы органдар құқық бұзушылық профилактикасы субъектілерінің өзара іс-қимылын жергілікті деңгейде қамтамасыз етеді және құқық бұзушылық жасауға итермелейтін себептер мен жағдайларды жою жөнінде шаралар қолданады.</p>';
    d += '<p><strong>Статистикалық мәліметтер:</strong> талдау кезеңінде қала аумағында жалпы ' + a.total + ' құқық бұзушылық тіркелген.</p>';
    d += '<p>Қазіргі таңда қала аумағында ' + m.cameras + ' бейнебақылау камерасы орнатылған. Алайда, талдау барысында бейнебақылау камераларымен қамтылмаған <strong>' + m.blindSpots + ' нүкте</strong> анықталды.</p>';
    d += '<p>Бейнебақылау камераларының жоқтығы немесе істен шығуы қылмыстарды ашуға теріс ықпал тигізіп, қоғамдық қауіпсіздіктің төмендеуіне себеп болуда.</p>';
    if (geoZones.length > 0) {
        d += '<p>Қылмыс көп орын алған аймақтар (координаталар бойынша):</p><ul>';
        geoZones.forEach(function (z) { d += '<li>' + z.label + ' [' + z.coords + '] – ' + z.count + ' құқық бұзушылық;</li>'; });
        d += '</ul>';
        d += '<p>Аталған аймақтардың басым көпшілігінде бейнебақылау камералары орнатылмаған немесе істен шыққан.</p>';
    }
    d += '<p>Бұл «Автомобиль жолдары туралы» Заңының 19-4-бабына және «Құқық бұзушылық профилактикасы туралы» Заңның 6-бабына қайшы келеді.</p>';
    d += '<p>Аталған кемшіліктер жергілікті атқарушы органның ведомстволық бақылауды тиісті деңгейде жүзеге асырмауынан орын алған.</p>';
    d += _usynuEnd();
    d += '<ol>';
    d += '<li>Ұсынуды қарауды және орын алған заң бұзушылықтарға ықпал еткен себептер мен салдарды жоюға нақты шаралар қабылдауды, ол үшін:<ul>';
    d += '<li>бейнебақылау камераларымен қамтылмаған ' + m.blindSpots + ' нүктеге камераларды орнату мәселесін қарастыруды;</li>';
    d += '<li>қолда бар камераларды іске қосу және техникалық қызмет көрсетуін қамтамасыз етуді;</li>';
    d += '<li>құқық бұзушылықтар орын алатын, адамдар көп жиналатын аймақтарды талдау жүргізу арқылы анықтауды;</li>';
    d += '<li>бейнебақылау камерасын орнататын жерлерді прокуратурамен бірлесе нақтылауды;</li>';
    d += '</ul></li>';
    d += '<li>Анықталған заң бұзушылықтарға жол берген жауапты қызметкерлерді тәртіптік жауаптылыққа тарту мәселесін қарастыруды.</li>';
    d += '</ol>';
    d += _usynuSignature();
    return d;
};

// ── ABANDONED (қараусыз ғимараттар) ──────────────────────────
_usynuGenerators.abandoned = function (a) {
    var m = _getMapCounts();
    var d = _usynuStart();
    d += '<p>Қала прокуратурасы қадағалау аумағындағы қараусыз қалған ғимараттар мен тұрғын үйлердің жай-күйіне талдау жүргізді.</p>';
    d += '<p>«Жергілікті мемлекеттік басқару және өзін-өзі басқару туралы» Заңының 30-бабының 16-тармағына сәйкес, аудандық (облыстық маңызы бар қалалық) әкімдік қоғамдық орындарды абаттандыру және сыртқы безендіру мәселелерін шешеді.</p>';
    d += '<p>Азаматтық кодекстің 242-бабының 1-бөлігіне сәйкес, иесі жоқ жылжымайтын заттарды олар табылған аумақтағы жергілікті атқарушы органдардың өтініші бойынша жылжымайтын мүлікті мемлекеттік тіркеуді жүзеге асыратын орган есепке алады.</p>';
    d += '<p><strong>Статистикалық мәліметтер:</strong> талдау кезеңінде қала аумағында ' + a.total + ' құқық бұзушылық тіркелген.</p>';
    d += '<p>Талдаумен қала аумағында <strong>' + m.abandoned + ' қараусыз қалған ғимарат</strong> анықталды.</p>';
    d += '<p>Қараусыз қалған ғимараттар балалардың өмірі мен денсаулығына тікелей қауіп төндіреді және жазатайым оқиғалардың орын алуына себеп болуы мүмкін. Аталған ғимараттар тұрақты мекенжайы жоқ, есірткі не алкогольді масаң күйдегі адамдардың панасына, маргиналды топтардың жиналу аумағына айналуы, қылмыс жасауға қолайлы «соқыр аймақ» ретінде пайдалану қауіптілігі жоққа шығарылмайды.</p>';
    d += '<p>Дегенмен, жергілікті атқарушы органмен мемлекет мұқтажына алуға тиісті шаралар қабылданбауда.</p>';
    d += '<p>Коммуналдық меншікке түскен мүлікті есепке алу, сақтау, бағалау, одан әрі пайдалану және өткізу жөніндегі жұмыстарды ұйымдастыруды жергілікті атқарушы орган жүзеге асырады.</p>';
    d += _usynuEnd();
    d += '<ol>';
    d += '<li>Ұсынуды қарауды және нақты шаралар қабылдауды, ол үшін:<ul>';
    d += '<li>қараусыз қалған ' + m.abandoned + ' ғимаратты заңдастыру бойынша шаралар қабылдауды;</li>';
    d += '<li>аталған ғимараттарды қоршау немесе жою бойынша жұмыстар жүргізуді;</li>';
    d += '<li>иесіз қалған мүлікті мемлекеттік мұқтажға алу үшін сотқа жүгінуді;</li>';
    d += '</ul></li>';
    d += '<li>Жауапты қызметкерлерді тәртіптік жауаптылыққа тарту мәселесін қарастыруды.</li>';
    d += '</ol>';
    d += _usynuSignature();
    return d;
};

// ── UNLIT (жарықтандырылмаған аумақтар) ──────────────────────
_usynuGenerators.unlit = function (a) {
    var m = _getMapCounts();
    var pk = _peakHoursStr(a);
    var d = _usynuStart();
    d += '<p>Қала прокуратурасы қадағалау аумағындағы көше жарықтандыруының жай-күйіне талдау жүргізді.</p>';
    d += '<p>«Автомобиль жолдары туралы» Заңының 19-4-бабының 2-бөлігіне сәйкес, автомобиль жолдарының және елді мекендер көшелерінің жүргіншілер бөлігі, жаяу жүргіншілер мен велосипед жолдары тротуарларының жабыны жол жүрісі қауіпсіздігін қамтамасыз ететін жағдайда болуға тиіс.</p>';
    d += '<p><strong>Статистикалық мәліметтер:</strong> талдау кезеңінде ' + a.total + ' құқық бұзушылық тіркелген.</p>';
    d += '<p>Талдаумен қала аумағында жарық жүргізілмеген <strong>' + m.unlit + ' нүкте</strong> анықталды.</p>';
    if (pk) d += '<p>Құқық бұзушылықтардың пик уақыты: ' + pk + ' сағат аралығында, яғни қараңғы уақытта қылмыс көп орын алуда.</p>';
    d += '<p>Жарықтандырудың болмауы түнгі уақытта құқық бұзушылықтардың орын алу ықтималдылығын арттырып, тұрғындардың өміріне қауіп төндіруде.</p>';
    d += _usynuEnd();
    d += '<ol>';
    d += '<li>Нақты шаралар қабылдауды, ол үшін:<ul>';
    d += '<li>жарықтандырылмаған ' + m.unlit + ' аумақты жарық шамдарымен жабдықтауды;</li>';
    d += '<li>қараңғы аймақтарды қосымша жарық шамдарымен жабдықтауды;</li>';
    d += '</ul></li>';
    d += '<li>Жауапты қызметкерлерді тәртіптік жауаптылыққа тарту мәселесін қарастыруды.</li>';
    d += '</ol>';
    d += _usynuSignature();
    return d;
};

// ── PATROL (патрульдеу / қауіпті аймақтар) ───────────────────
_usynuGenerators.patrol = function (a) {
    var geoZones = (a.byGeoZone || []).slice(0, 10);
    var pk = _peakHoursStr(a);
    var zones = (a.problemZones || []).filter(function (z) { return z.count <= 50; }).slice(0, 5);
    var d = _usynuStart();
    d += '<p>Қала прокуратурасы қадағалау аумағындағы құқық бұзушылықтардың орын алу жиілігі мен аумақтық таралуына талдау жүргізді.</p>';
    d += '<p>«Құқық бұзушылық профилактикасы туралы» Заңның 6-бабына сәйкес, жергілікті атқарушы органдар құқық бұзушылық жасауға итермелейтін себептер мен жағдайларды жою жөнінде шаралар қолданады, азаматтардың құқықтық тәрбиесін ұйымдастыруды қамтамасыз етеді.</p>';
    d += '<p><strong>Статистикалық мәліметтер:</strong> талдау кезеңінде ' + a.total + ' құқық бұзушылық тіркелген.</p>';
    if (pk) d += '<p>Құқық бұзушылықтардың пик уақыты: <strong>' + pk + '</strong> сағат аралығында.</p>';
    if (geoZones.length > 0) {
        d += '<p>Ең көп құқық бұзушылық орын алған аймақтар (координаталар бойынша):</p><ul>';
        geoZones.forEach(function (z) { d += '<li>' + z.label + ' [' + z.coords + '] – ' + z.count + ' жағдай;</li>'; });
        d += '</ul>';
    }
    if (zones.length > 0) {
        d += '<p>Анықталған қауіпті аймақтар (кластерлер): <strong>' + zones.length + '</strong>.</p>';
    }
    d += '<p>Профилактикалық жұмыстардың тиісті түрде жүргізілмеуі салдарынан аталған аймақтарда құқық бұзушылық деңгейі жоғары болып қалуда.</p>';
    d += _usynuEnd();
    d += '<ol>';
    d += '<li>Нақты шаралар қабылдауды, ол үшін:<ul>';
    if (pk) d += '<li>пик уақытта (' + pk + ') патрульдеу жұмыстарын күшейтуді;</li>';
    d += '<li>қылмыс көп орын алатын аймақтарда тұрақты бақылау орнатуды;</li>';
    d += '<li>құқық бұзушылық динамикасына терең талдау мен мониторинг жүргізуді;</li>';
    d += '</ul></li>';
    d += '<li>Жауапты қызметкерлерді тәртіптік жауаптылыққа тарту мәселесін қарастыруды.</li>';
    d += '</ol>';
    d += _usynuSignature();
    return d;
};

// ── PUBLIC (қоғамдық орындардағы қылмыс) ─────────────────────
_usynuGenerators.public = function (a) {
    var pct = a.total > 0 ? Math.round(a.publicCount / a.total * 100) : 0;
    var d = _usynuStart();
    d += '<p>Қала прокуратурасы қоғамдық орындарда орын алған құқық бұзушылықтарға талдау жүргізді.</p>';
    d += '<p>«Құқық бұзушылық профилактикасы туралы» Заңның 6-бабына сәйкес, жергілікті атқарушы органдар профилактикаға қатысатын азаматтардың және ұйымдардың есебін жүргізеді, азаматтарды қоғамдық тәртіпті сақтауға тарту жөнінде шаралар қолданады.</p>';
    d += '<p><strong>Статистикалық мәліметтер:</strong> ' + a.total + ' құқық бұзушылықтың ' + a.publicCount + '-і (<strong>' + pct + '%</strong>) қоғамдық орындарда орын алған.</p>';
    d += '<p>Қоғамдық орындардағы қылмыстардың жоғары үлесі ведомствоаралық өзара іс-қимылдың тиісті деңгейде жолға қойылмағанын, профилактикалық шаралардың жеткіліксіз деңгейде өткізілгенін көрсетеді.</p>';
    d += _usynuEnd();
    d += '<ol>';
    d += '<li>Нақты шаралар қабылдауды, ол үшін:<ul>';
    d += '<li>полиция, әкімдік және ЖКХ бөлімімен ведомствоаралық өзара іс-қимылды қалыптастыруды;</li>';
    d += '<li>қоғамдық орындарда патрульдеу мен бейнебақылауды күшейтуді;</li>';
    d += '<li>тұрғындарды қоғамдық тәртіпті белсенді қамтамасыз етуге шақыратын үгіт-насихат жұмыстарын жүргізуді;</li>';
    d += '</ul></li>';
    d += '<li>Жауапты қызметкерлерді тәртіптік жауаптылыққа тарту мәселесін қарастыруды.</li>';
    d += '</ol>';
    d += _usynuSignature();
    return d;
};

// ── MINORS (кәмелетке толмағандар) ───────────────────────────
_usynuGenerators.minors = function (a) {
    var p = a.people || {};
    var d = _usynuStart();
    d += '<p>Қала прокуратурасы кәмелетке толмағандардың құқық бұзушылықтарға қатысуына талдау жүргізді.</p>';
    d += '<p>«Құқық бұзушылық профилактикасы туралы» Заңның 6-бабына сәйкес, жергілікті атқарушы органдар білім беру ұйымдарының білім алушылары мен тәрбиеленушілерінде заңға мойынсынушылық мінез-құлықты қалыптастыруға бағытталған бағдарламалар мен әдістемелерді ендіреді және іске асырады.</p>';
    d += '<p><strong>Статистикалық мәліметтер:</strong> ' + a.total + ' құқық бұзушылық тіркелген, құқық бұзушылар арасында <strong>' + (p.minors || 0) + ' кәмелетке толмаған</strong> тұлға анықталды.</p>';
    if (p.total) d += '<p>Жалпы тіркелген тұлғалар саны: ' + p.total + '.</p>';
    d += '<p>Кәмелетке толмағандардың құқық бұзушылыққа тартылуы отбасын қолдау орталығының мүмкіндіктерінің кеңінен қолданылмауынан, NEET санатындағы жастармен жұмыстың жеткіліксіздігінен орын алуда.</p>';
    d += _usynuEnd();
    d += '<ol>';
    d += '<li>Нақты шаралар қабылдауды, ол үшін:<ul>';
    d += '<li>кәмелетке толмағандар істері жөніндегі комиссияға материалдар жолдауды;</li>';
    d += '<li>NEET санатындағы жастармен жұмысты шынайы жүргізуді;</li>';
    d += '<li>отбасын қолдау орталығының мүмкіндіктерін кеңінен қолдануды;</li>';
    d += '<li>білім беру ұйымдарында құқықтық тәрбие жұмыстарын жандандыруды;</li>';
    d += '</ul></li>';
    d += '<li>Жауапты қызметкерлерді тәртіптік жауаптылыққа тарту мәселесін қарастыруды.</li>';
    d += '</ol>';
    d += _usynuSignature();
    return d;
};

// ── Download dispatcher ─────────────────────────────────────
function downloadUsynuByType(type, analysis) {
    var gen = _usynuGenerators[type];
    if (!gen) { alert("Белгісіз тип: " + type); return; }
    var html = gen(analysis);
    _usynuDownload(html, type);
}