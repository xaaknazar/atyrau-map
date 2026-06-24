// ══════════════════════════════════════════════════════════════
//  КОНТРОЛЬ РЕГИСТРАЦИЙ — прокурорский надзор за качеством регистрации
//  правонарушений (уголовные/ЕРДР + административные).
//
//  Мгновенные проверки (без AI): полнота полей, логика дат, дубликаты,
//  язык описания. AI-проверка соответствия фабулы статье — по кнопке,
//  пакетно (эндпоинт /api/check-registration).
//
//  Зависит от глобалей: crimeIncidents, adminViolations, getPeriodCutoff.
// ══════════════════════════════════════════════════════════════

var REG_aiResults = {};      // uid -> { verdict, comment }
var REG_allItems = [];       // все нормализованные записи
var REG_currentItems = [];   // источник+период, пригодные для AI (есть статья и описание)
var REG_state = { source: "all", period: "all", filter: "issues", search: "", limit: 100 };
var REG_wired = false;
var REG_aiRunning = false;

// ── Утилиты ──────────────────────────────────────────────────
function _regStr(v) { return (v == null ? "" : String(v)).trim(); }

function _regEsc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
        return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
}

function _regParseDate(val) {
    if (!val) return null;
    val = String(val).trim();
    var m = val.match(/^(\d{4})-(\d{2})-(\d{2})/);          // ISO YYYY-MM-DD
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = val.match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);   // DD.MM.YYYY
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    var d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
}

function _regArtNum(a) {
    var m = String(a || "").match(/(\d{2,4})/);
    return m ? m[1] : "";
}

function _regDetectLang(text) {
    if (!text) return "—";
    if (/[әғқңөұүһіӘҒҚҢӨҰҮҺІ]/.test(text)) return "Казахский";
    if (/[а-яА-ЯёЁ]/.test(text)) return "Русский";
    if (/[a-zA-Z]/.test(text)) return "Латиница";
    return "—";
}

function _regVerdict(v) {
    return ({ match: "Соответствует", partial: "Частично", mismatch: "Не соответствует", unknown: "Не определено" })[v] || "—";
}

// ── Нормализация + мгновенные проверки ───────────────────────
function _regNorm(it, today) {
    it.flags = [];
    it.lang = _regDetectLang(it.description);

    // Полнота полей
    if (!it.articleRaw) it.flags.push({ cat: "complete", sev: "high", label: "Не указана статья" });
    if (!it.description) it.flags.push({ cat: "complete", sev: "high", label: "Нет описания/фабулы" });
    else if (it.description.length < 15) it.flags.push({ cat: "lang", sev: "low", label: "Слишком короткое описание" });
    if (!_regStr(it.regDateRaw)) it.flags.push({ cat: "date", sev: "med", label: "Нет даты регистрации" });
    if (!_regStr(it.crimeDateRaw)) it.flags.push({ cat: "complete", sev: "low", label: "Нет даты совершения" });
    if (!it.fio) it.flags.push({ cat: "complete", sev: "low", label: "Нет данных о лице" });
    if (it.lat == null || it.lng == null) it.flags.push({ cat: "complete", sev: "low", label: "Нет координат" });

    // Логика дат
    var reg = _regParseDate(it.regDateRaw);
    var cr = _regParseDate(it.crimeDateRaw);
    if (it.regDateRaw && !reg) it.flags.push({ cat: "date", sev: "med", label: "Некорректная дата регистрации" });
    if (it.crimeDateRaw && !cr) it.flags.push({ cat: "date", sev: "med", label: "Некорректная дата совершения" });
    if (reg && cr && cr > reg) it.flags.push({ cat: "date", sev: "high", label: "Совершение позже регистрации" });
    if (reg && reg > today) it.flags.push({ cat: "date", sev: "high", label: "Дата регистрации в будущем" });
    if (cr && cr > today) it.flags.push({ cat: "date", sev: "high", label: "Дата совершения в будущем" });

    // Язык описания
    if (it.description && it.lang === "Латиница") it.flags.push({ cat: "lang", sev: "low", label: "Описание не на гос/рус языке" });

    it._dupKey = (it.fio + "|" + _regArtNum(it.articleRaw) + "|" + (it.crimeDateRaw || "")).toLowerCase();
    return it;
}

function _regMarkDuplicates(items) {
    var byKey = {}, byNum = {};
    items.forEach(function (it) {
        if (it.fio && it.articleRaw) { (byKey[it._dupKey] = byKey[it._dupKey] || []).push(it); }
        if (it.number) { var nk = it.source + "|" + it.number.toLowerCase(); (byNum[nk] = byNum[nk] || []).push(it); }
    });
    Object.keys(byKey).forEach(function (k) {
        if (byKey[k].length > 1) byKey[k].forEach(function (it) {
            it.flags.push({ cat: "dup", sev: "med", label: "Возможный дубликат (лицо+статья+дата)" });
        });
    });
    Object.keys(byNum).forEach(function (k) {
        if (byNum[k].length > 1) byNum[k].forEach(function (it) {
            it.flags.push({ cat: "dup", sev: "med", label: "Дублируется номер" });
        });
    });
}

function REG_buildItems() {
    var items = [];
    var today = new Date(); today.setHours(23, 59, 59, 999);

    var crimes = (typeof crimeIncidents !== "undefined" && crimeIncidents) ? crimeIncidents : [];
    crimes.forEach(function (c) {
        items.push(_regNorm({
            uid: "C-" + c.id,
            source: "crime",
            sourceLabel: "Уголовные / ЕРДР",
            number: _regStr(c.erdr),
            organ: _regStr(c.organ),
            regDateRaw: c.regDate,
            crimeDateRaw: c.crimeDate,
            article: _regStr(c.article) + (c.articlePart ? " " + c.articlePart : ""),
            articleRaw: _regStr(c.article),
            description: _regStr(c.description || c.crimeDescription),
            fio: [c.lastName, c.firstName, c.patronymic].map(_regStr).filter(Boolean).join(" "),
            lat: (c.lat != null ? c.lat : null), lng: (c.lng != null ? c.lng : null)
        }, today));
    });

    // Административные правонарушения исключены — контроль только по ЕРДР (уголовные).

    _regMarkDuplicates(items);
    return items;
}

function REG_filterByPeriod(items, period) {
    if (typeof getPeriodCutoff !== "function") return items;
    var cutoff = getPeriodCutoff(period);
    if (!cutoff) return items;
    return items.filter(function (it) {
        var d = _regParseDate(it.regDateRaw);
        return d && d >= cutoff;
    });
}

// Высший уровень критичности записи (с учётом AI)
function _regSev(it) {
    var has = {};
    it.flags.forEach(function (f) { has[f.sev] = 1; });
    var ai = REG_aiResults[it.uid];
    if (ai && ai.verdict === "mismatch") has.high = 1;
    if (ai && ai.verdict === "partial") has.med = 1;
    if (has.high) return "high";
    if (has.med) return "med";
    if (has.low) return "low";
    return "none";
}

// ── Рендеринг ────────────────────────────────────────────────
function _regStatCard(num, label, tone) {
    return '<div class="reg-stat' + (tone ? " reg-stat-" + tone : "") + '">' +
        '<div class="reg-stat-num">' + num + '</div>' +
        '<div class="reg-stat-label">' + label + '</div></div>';
}

function REG_renderStats(items) {
    var el = document.getElementById("reg-stats");
    if (!el) return;
    var total = items.length;
    var issues = items.filter(function (it) { return it.flags.length > 0; }).length;
    var high = items.filter(function (it) { return _regSev(it) === "high"; }).length;
    var dup = items.filter(function (it) { return it.flags.some(function (f) { return f.cat === "dup"; }); }).length;
    var aiChecked = items.filter(function (it) { return REG_aiResults[it.uid]; }).length;
    var aiMis = items.filter(function (it) { var a = REG_aiResults[it.uid]; return a && a.verdict === "mismatch"; }).length;
    el.innerHTML =
        _regStatCard(total, "Записей") +
        _regStatCard(issues, "С замечаниями") +
        _regStatCard(high, "Критичных", "high") +
        _regStatCard(dup, "Дубликаты") +
        _regStatCard(aiChecked, "Проверено AI") +
        _regStatCard(aiMis, "AI: несоответствий", "high");
}

function _regKV(k, v) {
    return '<div class="reg-kv"><div class="reg-kv-k">' + _regEsc(k) + '</div><div class="reg-kv-v">' + _regEsc(v) + '</div></div>';
}

function _regRowHTML(it) {
    var sev = _regSev(it);
    var ai = REG_aiResults[it.uid];
    var srcCls = it.source === "crime" ? "reg-src-crime" : "reg-src-admin";
    var html = '<div class="reg-row sev-' + sev + '">';
    html += '<div class="reg-row-main">';
    html += '<span class="reg-badge ' + srcCls + '">' + (it.source === "crime" ? "УГОЛ" : "АДМ") + '</span>';
    html += '<div class="reg-row-info">';
    html += '<div class="reg-row-top">';
    html += '<span class="reg-row-article">' + _regEsc(it.article || "— статья не указана") + '</span>';
    if (it.number) html += '<span class="reg-row-num">№ ' + _regEsc(it.number) + '</span>';
    html += '</div>';
    var desc = it.description ? (it.description.length > 130 ? it.description.slice(0, 130) + "…" : it.description) : "— нет описания";
    html += '<div class="reg-row-desc">' + _regEsc(desc) + '</div>';
    if (it.flags.length || ai) {
        html += '<div class="reg-row-flags">';
        it.flags.forEach(function (f) { html += '<span class="reg-flag sev-' + f.sev + '">' + _regEsc(f.label) + '</span>'; });
        if (ai) html += '<span class="reg-flag reg-ai ai-' + ai.verdict + '">AI: ' + _regVerdict(ai.verdict) + '</span>';
        html += '</div>';
    }
    html += '</div>'; // info
    html += '<svg class="reg-row-arrow" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    html += '</div>'; // main

    html += '<div class="reg-row-details">';
    html += _regKV("Источник", it.sourceLabel);
    if (it.organ) html += _regKV("Орган регистрации", it.organ);
    html += _regKV("Статья", it.article || "—");
    html += _regKV("Дата регистрации", _regStr(it.regDateRaw) || "—");
    html += _regKV("Дата совершения", _regStr(it.crimeDateRaw) || "—");
    if (it.fio) html += _regKV("Лицо", it.fio);
    html += _regKV("Язык описания", it.lang);
    html += '<div class="reg-kv"><div class="reg-kv-k">Описание / фабула</div><div class="reg-kv-v reg-kv-desc">' + _regEsc(it.description || "—") + '</div></div>';
    if (ai) {
        html += '<div class="reg-ai-box ai-' + ai.verdict + '"><strong>AI-проверка соответствия: ' + _regVerdict(ai.verdict) + '</strong>' +
            (ai.comment ? '<div>' + _regEsc(ai.comment) + '</div>' : '') + '</div>';
    }
    html += '</div>'; // details
    html += '</div>'; // row
    return html;
}

function REG_renderList(view) {
    var el = document.getElementById("reg-list");
    if (!el) return;
    if (view.length === 0) {
        el.innerHTML = '<div class="reg-empty">Нет записей по выбранным условиям.</div>';
        return;
    }
    var limit = REG_state.limit;
    var shown = view.slice(0, limit);
    var html = shown.map(_regRowHTML).join("");
    if (view.length > limit) {
        html += '<button class="reg-more">Показать ещё (' + (view.length - limit) + ')</button>';
    }
    el.innerHTML = html;

    el.querySelectorAll(".reg-row-main").forEach(function (m) {
        m.addEventListener("click", function () { this.parentNode.classList.toggle("expanded"); });
    });
    var more = el.querySelector(".reg-more");
    if (more) more.addEventListener("click", function () { REG_state.limit += 100; REG_apply(); });
}

function REG_apply() {
    var items = REG_allItems.slice();
    if (REG_state.source !== "all") items = items.filter(function (it) { return it.source === REG_state.source; });
    items = REG_filterByPeriod(items, REG_state.period);

    REG_renderStats(items);
    REG_currentItems = items.filter(function (it) { return it.articleRaw && it.description; });

    // Подсказка: AI-проверка охватывает текущий выбор (период + источник)
    if (!REG_aiRunning) {
        var notChecked = REG_currentItems.filter(function (it) { return !REG_aiResults[it.uid]; }).length;
        REG_setProgress(REG_currentItems.length
            ? ("AI-проверка охватит текущий выбор: " + notChecked + " из " + REG_currentItems.length + " записей")
            : "");
    }

    var f = REG_state.filter;
    var view = items;
    if (f === "issues") view = items.filter(function (it) { return it.flags.length > 0; });
    else if (f === "ai-mismatch") view = items.filter(function (it) { var a = REG_aiResults[it.uid]; return a && (a.verdict === "mismatch" || a.verdict === "partial"); });
    else if (f !== "all") view = items.filter(function (it) { return it.flags.some(function (fl) { return fl.cat === f; }); });

    // Поиск по статье
    var q = (REG_state.search || "").trim().toLowerCase();
    if (q) {
        view = view.filter(function (it) {
            return (it.article || "").toLowerCase().indexOf(q) !== -1 ||
                String(_regArtNum(it.articleRaw)).indexOf(q) !== -1;
        });
    }

    var order = { high: 0, med: 1, low: 2, none: 3 };
    view = view.slice().sort(function (a, b) { return order[_regSev(a)] - order[_regSev(b)]; });

    REG_renderList(view);
}

// ── AI-проверка (пакетно) ────────────────────────────────────
function REG_setProgress(text) {
    var el = document.getElementById("reg-ai-progress");
    if (el) el.textContent = text || "";
}

function REG_runAI() {
    var pending = REG_currentItems.filter(function (it) { return !REG_aiResults[it.uid]; });
    if (pending.length === 0) {
        REG_setProgress("Все записи в текущем списке уже проверены AI.");
        return;
    }
    if (pending.length > 150 &&
        !confirm("Будет проверено " + pending.length + " записей за текущий выбор (период + источник) через AI. Это займёт время и расходует API. Продолжить?")) {
        return;
    }
    var btn = document.getElementById("reg-ai-btn");
    if (btn) btn.disabled = true;
    REG_aiRunning = true;

    var total = pending.length, done = 0, batchSize = 12;

    function nextBatch() {
        if (pending.length === 0) {
            if (btn) btn.disabled = false;
            REG_apply();
            REG_aiRunning = false;
            REG_setProgress("Готово: проверено " + done + " записей за текущий выбор.");
            return;
        }
        var batch = pending.splice(0, batchSize);
        REG_setProgress("Проверка соответствия… " + done + "/" + total);
        fetch("/api/check-registration", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                items: batch.map(function (it) {
                    return { id: it.uid, article: it.article, description: it.description };
                })
            })
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data && data.results) {
                    data.results.forEach(function (rr) {
                        if (rr && rr.id != null) REG_aiResults[rr.id] = { verdict: rr.verdict, comment: rr.comment };
                    });
                } else if (data && data.error) {
                    console.warn("[reg-check] AI:", data.error);
                    REG_setProgress("Ошибка AI: " + data.error);
                }
                done += batch.length;
                REG_apply();
                setTimeout(nextBatch, 250);
            })
            .catch(function (e) {
                console.warn("[reg-check] AI fetch error", e);
                done += batch.length;
                setTimeout(nextBatch, 500);
            });
    }
    nextBatch();
}

// ── Привязка управления (один раз) ───────────────────────────
function _regSetActive(selector, el) {
    document.querySelectorAll(selector).forEach(function (b) { b.classList.remove("active"); });
    if (el) el.classList.add("active");
}

function REG_wire() {
    if (REG_wired) return;
    REG_wired = true;
    document.querySelectorAll(".reg-src-tab").forEach(function (b) {
        b.addEventListener("click", function () {
            REG_state.source = this.getAttribute("data-src"); REG_state.limit = 100;
            _regSetActive(".reg-src-tab", this); REG_apply();
        });
    });
    document.querySelectorAll(".reg-period-btn").forEach(function (b) {
        b.addEventListener("click", function () {
            REG_state.period = this.getAttribute("data-period"); REG_state.limit = 100;
            _regSetActive(".reg-period-btn", this); REG_apply();
        });
    });
    document.querySelectorAll(".reg-filter-chip").forEach(function (b) {
        b.addEventListener("click", function () {
            REG_state.filter = this.getAttribute("data-filter"); REG_state.limit = 100;
            _regSetActive(".reg-filter-chip", this); REG_apply();
        });
    });
    var ai = document.getElementById("reg-ai-btn");
    if (ai) ai.addEventListener("click", REG_runAI);
    var search = document.getElementById("reg-search");
    if (search) search.addEventListener("input", function () {
        REG_state.search = this.value || ""; REG_state.limit = 100; REG_apply();
    });
}

// Вызывается из app.js при открытии панели
function REG_open() {
    REG_wire();
    REG_allItems = REG_buildItems();
    REG_setProgress("");
    REG_apply();
}
