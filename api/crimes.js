// Совместимость: алиас для /api/data?source=crimes.
// Нужен, чтобы (а) не падала сборка Vercel (ссылка в vercel.json) и
// (б) старые кэшированные клиенты, которые ещё стучатся в /api/crimes,
// продолжали работать. Защита — та же, что у /api/data (requireAuth).
var auth = require("./_auth");

var DEFAULT_CRIMES_URL =
    "https://script.google.com/macros/s/" +
    "AKfycbxUXN9_fzNGhlgygTgT432q05-_go_Tj_8pgP3KrpnTi2Ee9OIvCop8caNpRfqxzmPf/exec";

module.exports = async function handler(req, res) {
    if (!auth.requireAuth(req, res)) return; // при AUTH_ENFORCE=1 — 401 без сессии

    var url = process.env.CRIMES_API_URL || DEFAULT_CRIMES_URL;
    try {
        var r = await fetch(url, {
            redirect: "follow",
            headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
                "Accept": "application/json,text/plain,*/*"
            }
        });
        if (!r.ok) {
            res.status(502).json({ error: "Источник ЕРДР недоступен (" + r.status + ")." });
            return;
        }
        var text = await r.text();
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "private, max-age=30");
        res.status(200).send(text);
    } catch (e) {
        res.status(502).json({ error: (e && e.message) ? e.message : "Ошибка прокси ЕРДР." });
    }
};
