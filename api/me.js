// Проверка текущей сессии для клиента.
var auth = require("./_auth");

module.exports = async function handler(req, res) {
    var enforce = process.env.AUTH_ENFORCE === "1";
    var s = auth.getSession(req);
    res.status(200).json({
        enforce: enforce,
        authenticated: !!s,
        role: s ? s.role : null
    });
};
