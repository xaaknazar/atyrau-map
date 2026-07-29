// Прокси данных ЕРДР (Apps Script) через наш сервер.
// Причина: браузер Safari блокирует прямой запрос к script.google.com из-за
// CORS на редиректе. Same-origin запрос к /api/crimes этого не имеет.
// URL берётся из env CRIMES_API_URL, иначе — запасной (тот же, что был в клиенте).
module.exports = async function handler(req, res) {
    var url = process.env.CRIMES_API_URL ||
        "https://script.google.com/macros/s/AKfycbxUXN9_fzNGhlgygTgT432q05-_go_Tj_8pgP3KrpnTi2Ee9OIvCop8caNpRfqxzmPf/exec";
    try {
        var r = await fetch(url, {
            redirect: "follow",
            headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
                "Accept": "application/json,text/plain,*/*"
            }
        });
        if (!r.ok) {
            var body = "";
            try { body = (await r.text()).slice(0, 200); } catch (e) {}
            res.status(502).json({ error: "Источник ЕРДР недоступен (" + r.status + "). " + body });
            return;
        }
        var text = await r.text();
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=60");
        res.status(200).send(text);
    } catch (e) {
        res.status(502).json({ error: (e && e.message) ? e.message : "Ошибка прокси ЕРДР." });
    }
};
