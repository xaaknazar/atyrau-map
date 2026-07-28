// ══════════════════════════════════════════════════════════════
//  Серверная аутентификация — подписанная сессия-cookie (HMAC).
//  Никаких паролей в клиенте: проверка только на сервере.
//
//  Требуемые переменные окружения (Vercel → Settings → Environment):
//   SESSION_SECRET       — длинная случайная строка для подписи cookie
//   APP_PASSWORD_STAFF   — пароль сотрудника (прокуратура)
//   APP_PASSWORD_ADMIN   — пароль администратора (необязательно)
//   APP_PASSWORD_AKIMAT  — пароль акимата (необязательно)
//   AUTH_ENFORCE=1       — включает жёсткую проверку (для поэтапного внедрения)
// ══════════════════════════════════════════════════════════════
var crypto = require("crypto");

var COOKIE_NAME = "av_session";
var TTL_MS = 12 * 60 * 60 * 1000; // 12 часов

function _secret() {
    return process.env.SESSION_SECRET || "";
}

// Подписать полезную нагрузку → "<base64url payload>.<base64url hmac>"
function sign(payload) {
    var body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    var mac = crypto.createHmac("sha256", _secret()).update(body).digest("base64url");
    return body + "." + mac;
}

// Проверить токен → payload или null
function verify(token) {
    if (!token || !_secret()) return null;
    var parts = String(token).split(".");
    if (parts.length !== 2) return null;
    var expected = crypto.createHmac("sha256", _secret()).update(parts[0]).digest("base64url");
    var a = Buffer.from(parts[1]);
    var b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
        var p = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
        if (!p || (p.exp && Date.now() > p.exp)) return null;
        return p;
    } catch (e) { return null; }
}

function parseCookies(req) {
    var h = (req && req.headers && req.headers.cookie) || "";
    var out = {};
    h.split(";").forEach(function (c) {
        var i = c.indexOf("=");
        if (i > 0) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
    });
    return out;
}

function getSession(req) {
    return verify(parseCookies(req)[COOKIE_NAME]);
}

function makeSessionCookie(role) {
    var token = sign({ role: role, exp: Date.now() + TTL_MS });
    return COOKIE_NAME + "=" + token +
        "; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=" + Math.floor(TTL_MS / 1000);
}

function clearCookie() {
    return COOKIE_NAME + "=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0";
}

/**
 * Проверка доступа. Если AUTH_ENFORCE != "1" — пропускаем (поэтапное внедрение,
 * чтобы не сломать рабочий сайт до полной настройки). Когда всё готово —
 * выставить AUTH_ENFORCE=1, и без валидной сессии будет 401.
 */
function requireAuth(req, res) {
    if (process.env.AUTH_ENFORCE !== "1") {
        return { role: "public", _bypass: true };
    }
    var s = getSession(req);
    if (!s) {
        res.status(401).json({ error: "Требуется вход", code: "NO_SESSION" });
        return null;
    }
    return s;
}

module.exports = {
    COOKIE_NAME: COOKIE_NAME,
    sign: sign,
    verify: verify,
    parseCookies: parseCookies,
    getSession: getSession,
    makeSessionCookie: makeSessionCookie,
    clearCookie: clearCookie,
    requireAuth: requireAuth
};
