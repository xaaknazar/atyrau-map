/**
 * Двуязычная поддержка: Русский (ru) / Қазақша (kz)
 */
var I18N = {
    ru: {
        // Header
        title: "Цифровая карта прокуратуры города Атырау",
        subtitle: "Мониторинг безопасности городской среды",
        mobile_title: "Карта прокуратуры г. Атырау",

        // Legend
        categories: "Категории",
        cat_blind: "Слепые зоны (нет камер)",
        cat_abandoned: "Заброшенные здания",
        cat_unlit: "Неосвещённые улицы",

        // Stats
        statistics: "Статистика",
        stat_blind: "Слепые зоны:",
        stat_abandoned: "Заброшенные здания:",
        stat_unlit: "Неосвещённые улицы:",
        stat_total: "Всего точек:",

        // Footer
        footer_hint: "Нажмите на точку для подробной информации",

        // Modal category badges
        badge_blind: "Слепая зона",
        badge_abandoned: "Заброшенное здание",
        badge_unlit: "Неосвещённая улица"
    },
    kz: {
        // Header
        title: "Атырау қаласы прокуратурасының цифрлік картасы",
        subtitle: "Қала ортасының қауіпсіздігін бақылау",
        mobile_title: "Атырау қ. прокуратура картасы",

        // Legend
        categories: "Санаттар",
        cat_blind: "Соқыр аймақтар (камера жоқ)",
        cat_abandoned: "Тастанды ғимараттар",
        cat_unlit: "Жарықтандырылмаған көшелер",

        // Stats
        statistics: "Статистика",
        stat_blind: "Соқыр аймақтар:",
        stat_abandoned: "Тастанды ғимараттар:",
        stat_unlit: "Жарықтандырылмаған көшелер:",
        stat_total: "Барлық нүктелер:",

        // Footer
        footer_hint: "Толық ақпарат алу үшін нүктені басыңыз",

        // Modal category badges
        badge_blind: "Соқыр аймақ",
        badge_abandoned: "Тастанды ғимарат",
        badge_unlit: "Жарықтандырылмаған көше"
    }
};

var currentLang = "ru";

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem("atyrau-map-lang", lang);

    // Update all elements with data-i18n attribute
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
        var key = el.getAttribute("data-i18n");
        if (I18N[lang] && I18N[lang][key]) {
            el.textContent = I18N[lang][key];
        }
    });

    // Update page title
    document.title = lang === "ru"
        ? "Цифровая карта прокуратуры г. Атырау"
        : "Атырау қ. прокуратурасының цифрлік картасы";

    // Update html lang attribute
    document.documentElement.lang = lang === "ru" ? "ru" : "kk";

    // Update active state on all lang buttons
    document.querySelectorAll(".lang-btn").forEach(function (btn) {
        btn.classList.toggle("active", btn.getAttribute("data-lang") === lang);
    });
}

function t(key) {
    return (I18N[currentLang] && I18N[currentLang][key]) || key;
}

// Init language from localStorage or default to "ru"
(function () {
    var saved = localStorage.getItem("atyrau-map-lang");
    if (saved && I18N[saved]) {
        currentLang = saved;
    }
})();
