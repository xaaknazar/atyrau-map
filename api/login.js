// Серверный вход: проверка пароля и выдача подписанной сессии-cookie.
// Пароли хранятся ТОЛЬКО в переменных окружения Vercel, не в клиенте.
var auth = require("./_auth");

module.exports = async function handler(req, res) {
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }
    if (!process.env.SESSION_SECRET) {
        res.status(500).json({ error: "Сервер не настроен: добавьте SESSION_SECRET в переменные окружения Vercel." });
        return;
    }

    var body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    body = body || {};
    var pwd = (body.password || "").toString();

    if (!pwd) { res.status(400).json({ error: "Введите пароль." }); return; }

    // Постоянное по времени сравнение, чтобы исключить тайминг-атаки
    function eq(a, b) {
        if (!a || !b) return false;
        var ba = Buffer.from(String(a));
        var bb = Buffer.from(String(b));
        if (ba.length !== bb.length) return false;
        try { return require("crypto").timingSafeEqual(ba, bb); } catch (e) { return false; }
    }

    var role = null;
    if (process.env.APP_PASSWORD_ADMIN && eq(pwd, process.env.APP_PASSWORD_ADMIN)) role = "admin";
    else if (process.env.APP_PASSWORD_STAFF && eq(pwd, process.env.APP_PASSWORD_STAFF)) role = "staff";
    else if (process.env.APP_PASSWORD_AKIMAT && eq(pwd, process.env.APP_PASSWORD_AKIMAT)) role = "akimat";

    if (!role) {
        res.status(401).json({ error: "Неверный пароль." });
        return;
    }

    res.setHeader("Set-Cookie", auth.makeSessionCookie(role));
    res.status(200).json({ ok: true, role: role });
};
