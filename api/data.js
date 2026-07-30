// ══════════════════════════════════════════════════════════════
//  Защищённый прокси данных.
//  Клиент запрашивает /api/data?source=XXX, сервер проверяет сессию
//  и сам читает Google Sheets — прямые ссылки на таблицы в браузер
//  не попадают. Идентификатор таблицы хранится в env (DATA_SHEET_ID),
//  а не в публичном коде.
//
//  Требуемые env:
//   DATA_SHEET_ID   — id таблицы (общий для большинства слоёв)
//   CRIMES_API_URL  — URL Apps Script для ЕРДР (source=crimes)
//   AUTH_ENFORCE=1  — включить обязательный вход
// ══════════════════════════════════════════════════════════════
var auth = require("./_auth");

// Значения по умолчанию (server-side): не секреты, в браузер не попадают.
// Позволяют сайту работать до настройки env; env их переопределяет.
var DEFAULT_SHEET_ID = "1W7J6c7rM3Skd5cJbv_95J3d5fM_6X5mBNQBvhxhLkBU";
var DEFAULT_CRIMES_URL =
    "https://script.google.com/macros/s/" +
    "AKfycbxUXN9_fzNGhlgygTgT432q05-_go_Tj_8pgP3KrpnTi2Ee9OIvCop8caNpRfqxzmPf/exec";

// gid листов внутри таблицы (сами по себе, без id таблицы, бесполезны)
var GIDS = {
    admin: "121213149",
    people: "187886123",
    cameras: "2044322486",
    police: "538301573",
    schools: "531851649",
    venues: "1361292445",
    alkomarkets: "1627911552"
};

module.exports = async function handler(req, res) {
    var session = auth.requireAuth(req, res);
    if (!session) return; // 401 уже отправлен

    var source = ((req.query && req.query.source) || "").toString();

    try {
        var url;
        if (source === "crimes") {
            url = process.env.CRIMES_API_URL || DEFAULT_CRIMES_URL;
        } else if (GIDS[source]) {
            var sheetId = process.env.DATA_SHEET_ID || DEFAULT_SHEET_ID;
            url = "https://docs.google.com/spreadsheets/d/" + sheetId +
                "/export?format=csv&gid=" + GIDS[source] + "&_=" + Date.now();
        } else {
            res.status(400).json({ error: "Неизвестный источник: " + source });
            return;
        }

        var r = await fetch(url, {
            redirect: "follow",
            headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
                "Accept": "application/json,text/csv,text/plain,*/*"
            }
        });
        if (!r.ok) {
            res.status(502).json({ error: "Источник недоступен (" + r.status + ")." });
            return;
        }
        var text = await r.text();

        // Отдаём как есть (CSV или JSON от Apps Script)
        var ct = source === "crimes" ? "application/json; charset=utf-8" : "text/csv; charset=utf-8";
        res.setHeader("Content-Type", ct);
        // Приватный кэш только на короткое время
        res.setHeader("Cache-Control", "private, max-age=30");
        res.status(200).send(text);
    } catch (e) {
        res.status(500).json({ error: (e && e.message) ? e.message : "Ошибка прокси данных." });
    }
};
