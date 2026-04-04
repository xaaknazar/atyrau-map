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
function buildAnalysisSummaryForAI(analysis) {
    var lines = [];
    lines.push("СВОДКА ПО ПРЕСТУПЛЕНИЯМ г. АТЫРАУ");
    lines.push("Всего правонарушений: " + analysis.total);
    lines.push("В общественных местах: " + analysis.publicCount + " (" + Math.round(analysis.publicCount / analysis.total * 100) + "%)");
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
        lines.push("ПРОБЛЕМНЫЕ ЗОНЫ (топ-5 по концентрации):");
        analysis.problemZones.slice(0, 5).forEach(function (z, i) {
            lines.push("  " + (i + 1) + ". Координаты: " + z.lat.toFixed(4) + ", " + z.lng.toFixed(4) +
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
