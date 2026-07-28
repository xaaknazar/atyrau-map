// Выход: очистка сессии-cookie.
var auth = require("./_auth");

module.exports = async function handler(req, res) {
    res.setHeader("Set-Cookie", auth.clearCookie());
    res.status(200).json({ ok: true });
};
