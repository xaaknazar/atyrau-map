// Vercel serverless function — пакетная AI-проверка соответствия фабулы (описания)
// указанной статье. Прокси к OpenAI; ключ — в переменной окружения OPENAI_API_KEY.
//
// Запрос (POST):
//   { items: [ { id, article, description }, ... ] }   // до ~20 записей за раз
// Ответ:
//   { results: [ { id, verdict: "match"|"partial"|"mismatch"|"unknown", comment }, ... ] }
module.exports = async function handler(req, res) {
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }

    var apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        res.status(500).json({ error: "Сервер не настроен: добавьте OPENAI_API_KEY в настройках Vercel." });
        return;
    }

    try {
        var body = req.body;
        if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
        body = body || {};

        var items = Array.isArray(body.items) ? body.items : [];
        if (items.length === 0) {
            res.status(400).json({ error: "Нет записей для проверки." });
            return;
        }
        // Ограничение размера пакета на стороне сервера
        if (items.length > 25) items = items.slice(0, 25);

        // Готовим компактный список для модели
        var list = items.map(function (it, i) {
            var article = (it.article || "").toString().slice(0, 200);
            var description = (it.description || "").toString().slice(0, 2000);
            var id = (it.id != null ? it.id : i);
            return { id: id, article: article, description: description };
        });

        var systemPrompt = [
            "Ты — опытный юрист-аналитик прокуратуры города Атырау (Казахстан) по контролю качества квалификации уголовных правонарушений (ЕРДР). Твоя оценка должна быть точной и юридически выверенной.",
            "Тебе дают список карточек: для каждой указаны СТАТЬЯ (квалификация: номер статьи и часть) и ФАБУЛА (описание деяния).",
            "",
            "ЯЗЫК: фабула может быть на РУССКОМ или КАЗАХСКОМ. Казахский язык понимай точно, включая юридические термины и бытовые формулировки:",
            "- ұрлық = кража; тонау = грабёж; қарақшылық = разбой; алаяқтық = мошенничество; бұзақылық = хулиганство;",
            "- денсаулыққа зиян келтіру = причинение вреда здоровью; кісі өлтіру = убийство; зорлау = изнасилование;",
            "- есірткі = наркотики; пара = взятка; жасырын = тайно; ашық = открыто; қаруды қолданып = с применением оружия;",
            "- автокөлік/көлік = автомобиль/транспорт; жол-көлік оқиғасы = ДТП.",
            "Сначала при необходимости мысленно переведи казахскую фабулу на русский, затем делай юридический анализ.",
            "",
            "ОСНОВА ОЦЕНКИ — Уголовный кодекс Республики Казахстан от 3 июля 2014 года № 226-V (adilet.zan.kz, K1400000226).",
            "Тексты: рус — https://adilet.zan.kz/rus/docs/K1400000226 ; қаз — https://adilet.zan.kz/kaz/docs/K1400000226 .",
            "",
            "МЕТОДИКА (применяй к КАЖДОЙ записи отдельно, не смешивай записи между собой):",
            "1) Вспомни диспозицию указанной статьи и её части по УК РК: объект, объективную сторону (деяние), и квалифицирующие признаки именно этой части.",
            "2) Выдели из фабулы ключевые признаки деяния (что, как, чем, в отношении кого, размер ущерба, способ).",
            "3) Сопоставь признаки фабулы с составом статьи и конкретной части.",
            "4) Сделай вывод. Будь точен с ЧАСТЬЮ статьи — если деяние подпадает под статью, но под другую часть, это partial с указанием верной части.",
            "",
            "ВЕРДИКТ:",
            "- \"match\"    — деяние из фабулы прямо охватывается составом указанной статьи И части;",
            "- \"partial\"  — статья верна, но неверна/сомнительна часть, либо не хватает признаков/данных для уверенности;",
            "- \"mismatch\" — фабула не образует состава указанной статьи (ошибочная квалификация);",
            "- \"unknown\"  — оценить невозможно (нет описания, нет статьи, либо статья не из УК РК).",
            "",
            "ПРАВИЛА:",
            "1. Опирайся ТОЛЬКО на УК РК и текст фабулы. Не домысливай обстоятельств, которых нет в фабуле; если данных мало — ставь partial, а не match.",
            "2. comment — на русском, по структуре: «Диспозиция: <что криминализирует статья/часть>. Фабула: <ключевые признаки>. Вывод: <почему совпадает/нет; при mismatch/partial — верная статья/часть УК РК>». До 3 предложений.",
            "3. Верни СТРОГО JSON: {\"results\":[{\"id\":<id>,\"verdict\":\"match|partial|mismatch|unknown\",\"comment\":\"...\"}]} без текста вне JSON.",
            "4. Сохрани тот же id, что во входных данных. Обработай ВСЕ записи независимо друг от друга."
        ].join("\n");

        var userPrompt = [
            "Проверь соответствие каждой фабулы указанной статье и части по Уголовному кодексу РК (K1400000226). Анализируй записи по отдельности.",
            "Записи (JSON):",
            JSON.stringify(list, null, 0)
        ].join("\n");

        var aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + apiKey
            },
            body: JSON.stringify({
                model: "gpt-4o",
                max_tokens: 3500,
                temperature: 0,
                response_format: { type: "json_object" },
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ]
            })
        });

        if (!aiResp.ok) {
            var errText = await aiResp.text();
            var low = (errText || "").toLowerCase();
            // Понятное сообщение при исчерпании квоты/средств OpenAI
            if (aiResp.status === 429 || low.indexOf("insufficient_quota") !== -1 || low.indexOf("exceeded your current quota") !== -1) {
                res.status(402).json({ error: "Закончились средства или квота OpenAI. Пополните баланс / проверьте биллинг на platform.openai.com (раздел Billing)." });
                return;
            }
            if (aiResp.status === 401) {
                res.status(401).json({ error: "Неверный или отсутствует ключ OpenAI (OPENAI_API_KEY) в настройках Vercel." });
                return;
            }
            res.status(502).json({ error: "OpenAI API " + aiResp.status + ": " + errText.slice(0, 400) });
            return;
        }

        var data = await aiResp.json();
        var content = data && data.choices && data.choices[0] && data.choices[0].message
            ? data.choices[0].message.content : "";

        var parsed = {};
        try { parsed = JSON.parse(content); } catch (e) { parsed = {}; }
        var results = Array.isArray(parsed.results) ? parsed.results : [];

        // Нормализуем вердикты
        var allowed = { match: 1, partial: 1, mismatch: 1, unknown: 1 };
        results = results.map(function (r) {
            var v = (r && r.verdict || "unknown").toString().toLowerCase();
            if (!allowed[v]) v = "unknown";
            return {
                id: r ? r.id : null,
                verdict: v,
                comment: (r && r.comment ? r.comment.toString() : "").slice(0, 500)
            };
        });

        res.status(200).json({ results: results });
    } catch (e) {
        res.status(500).json({ error: (e && e.message) ? e.message : "Внутренняя ошибка функции." });
    }
};
