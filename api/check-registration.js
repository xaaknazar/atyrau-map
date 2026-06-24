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
            "Ты — помощник прокуратуры города Атырау (Казахстан) по контролю качества регистрации правонарушений.",
            "Тебе дают список зарегистрированных карточек: для каждой указана СТАТЬЯ (квалификация по КоАП или УК РК) и ФАБУЛА (описание деяния).",
            "Описание может быть на русском или на казахском языке — понимай оба.",
            "Задача: оценить, СООТВЕТСТВУЕТ ли фабула указанной статье.",
            "Вердикт по каждой записи:",
            "- \"match\"    — описание явно соответствует составу статьи;",
            "- \"partial\"  — соответствует частично/неоднозначно, есть сомнения или нехватка деталей;",
            "- \"mismatch\" — описание не соответствует статье (вероятно неверная квалификация);",
            "- \"unknown\"  — невозможно оценить (нет описания или нет статьи).",
            "Правила:",
            "1. Опирайся только на текст. Не выдумывай обстоятельства.",
            "2. comment — кратко (1–2 предложения) на русском языке: чем обосновано, и какая статья уместнее, если mismatch.",
            "3. Верни СТРОГО JSON-объект вида {\"results\":[{\"id\":<id>,\"verdict\":\"match|partial|mismatch|unknown\",\"comment\":\"...\"}]} без пояснений вне JSON.",
            "4. Сохрани тот же id, что во входных данных. Обработай ВСЕ записи."
        ].join("\n");

        var userPrompt = "Проверь записи:\n" + JSON.stringify(list, null, 0);

        var aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + apiKey
            },
            body: JSON.stringify({
                model: "gpt-4o",
                max_tokens: 3000,
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
            res.status(502).json({ error: "OpenAI API " + aiResp.status + ": " + errText.slice(0, 600) });
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
