// ══════════════════════════════════════════════════════════════
//  Переключатель темы (светлая / тёмная) для отчётов и аналитики.
//  Тема ставится на <html data-theme> ещё в <head> (без мигания),
//  здесь — кнопки в шапках панелей, сохранение выбора и подписи RU/KZ.
// ══════════════════════════════════════════════════════════════
(function () {
    "use strict";
    var KEY = "atyrau-theme";
    var root = document.documentElement;

    function getTheme() {
        return root.getAttribute("data-theme") === "dark" ? "dark" : "light";
    }

    function label() {
        var kz = (typeof currentLang !== "undefined" && currentLang === "kz");
        // Подпись — действие: что включит кнопка
        if (getTheme() === "dark") return kz ? "Жарық тақырып" : "Светлая тема";
        return kz ? "Қараңғы тақырып" : "Тёмная тема";
    }

    function refreshLabels() {
        var text = label();
        document.querySelectorAll(".theme-toggle").forEach(function (b) {
            var span = b.querySelector(".tt-label");
            if (span) span.textContent = text;
            b.setAttribute("aria-label", text);
            b.setAttribute("title", text);
            b.setAttribute("aria-pressed", getTheme() === "dark" ? "true" : "false");
        });
    }

    function setTheme(t) {
        root.setAttribute("data-theme", t);
        try { localStorage.setItem(KEY, t); } catch (e) {}
        refreshLabels();
    }

    function makeButton() {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "theme-toggle";
        b.innerHTML =
            '<svg class="tt-moon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>' +
            '<svg class="tt-sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>' +
            '<span class="tt-label"></span>';
        b.addEventListener("click", function (e) {
            e.stopPropagation();
            setTheme(getTheme() === "dark" ? "light" : "dark");
        });
        return b;
    }

    function mount() {
        var hosts = document.querySelectorAll(
            "#report-selector .report-selector-header," +
            "#crime-panel .crime-panel-top-row," +
            "#av-panel .crime-panel-top-row," +
            "#analytics-panel .crime-panel-top-row," +
            "#av-analytics-panel .crime-panel-top-row," +
            "#reg-check-panel .crime-panel-top-row"
        );
        hosts.forEach(function (h) {
            if (!h.querySelector(".theme-toggle")) h.appendChild(makeButton());
        });
        refreshLabels();
    }

    // Подпись всегда соответствует текущей теме, кто бы её ни сменил
    if (window.MutationObserver) {
        new MutationObserver(refreshLabels).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    }

    // Обновлять подпись при смене языка
    document.addEventListener("click", function (e) {
        if (e.target && e.target.closest && e.target.closest(".lang-btn")) setTimeout(refreshLabels, 0);
    });

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
    else mount();
})();
