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
        cat_crime: "Преступность",
        cat_blind: "Слепые зоны (нет камер)",
        cat_abandoned: "Заброшенные здания",
        cat_unlit: "Неосвещённые улицы",

        // Stats
        statistics: "Статистика",
        stat_crime: "Преступность:",
        stat_blind: "Слепые зоны:",
        stat_abandoned: "Заброшенные здания:",
        stat_unlit: "Неосвещённые улицы:",
        stat_total: "Всего точек:",

        // Footer
        footer_hint: "Нажмите на точку для подробной информации",

        // Modal category badges
        badge_crime: "Преступность",
        badge_blind: "Слепая зона",
        badge_abandoned: "Заброшенное здание",
        badge_unlit: "Неосвещённая улица",

        // Admin
        admin_login: "Вход для админа",
        admin_login_title: "Вход администратора",
        admin_password_label: "Пароль:",
        admin_login_btn: "Войти",
        admin_wrong_password: "Неверный пароль",
        admin_bar_hint: "АДМИН: нажмите на карту чтобы добавить точку",
        admin_exit: "Выйти",
        admin_add_title: "Новая точка",
        admin_field_category: "Категория:",
        admin_field_address_ru: "Адрес (рус):",
        admin_field_address_kz: "Адрес (қаз):",
        admin_field_desc_ru: "Описание (рус):",
        admin_field_desc_kz: "Описание (қаз):",
        admin_field_photos: "Фотографии:",
        admin_add_btn: "Добавить точку",
        admin_delete_point: "Удалить точку",
        admin_confirm_delete: "Вы уверены что хотите удалить эту точку?",
        admin_reset_data: "Сбросить данные",
        admin_confirm_reset: "Сбросить все точки к начальным данным?",

        // Share
        share_point: "Поделиться",
        share_copied: "Ссылка скопирована!",

        // Heatmap
        heatmap_on: "Тепловая карта: ВКЛ",
        heatmap_off: "Тепловая карта: ВЫКЛ",

        // Map tiles
        tile_streets: "Карта",
        tile_satellite: "Спутник",
        tile_dark: "Тёмная",

        // Drag
        drag_saved: "Координаты обновлены",
        admin_bar_hint_drag: "АДМИН: нажмите на карту чтобы добавить точку · перетаскивайте маркеры для корректировки"
    },
    kz: {
        // Header
        title: "Атырау қаласы прокуратурасының цифрлік картасы",
        subtitle: "Қала ортасының қауіпсіздігін бақылау",
        mobile_title: "Атырау қ. прокуратура картасы",

        // Legend
        categories: "Санаттар",
        cat_crime: "Қылмыс",
        cat_blind: "Соқыр аймақтар (камера жоқ)",
        cat_abandoned: "Тастанды ғимараттар",
        cat_unlit: "Жарықтандырылмаған көшелер",

        // Stats
        statistics: "Статистика",
        stat_crime: "Қылмыс:",
        stat_blind: "Соқыр аймақтар:",
        stat_abandoned: "Тастанды ғимараттар:",
        stat_unlit: "Жарықтандырылмаған көшелер:",
        stat_total: "Барлық нүктелер:",

        // Footer
        footer_hint: "Толық ақпарат алу үшін нүктені басыңыз",

        // Modal category badges
        badge_crime: "Қылмыс",
        badge_blind: "Соқыр аймақ",
        badge_abandoned: "Тастанды ғимарат",
        badge_unlit: "Жарықтандырылмаған көше",

        // Admin
        admin_login: "Әкімші кіру",
        admin_login_title: "Әкімші кіру",
        admin_password_label: "Құпия сөз:",
        admin_login_btn: "Кіру",
        admin_wrong_password: "Құпия сөз қате",
        admin_bar_hint: "ӘКІМШІ: нүкте қосу үшін картаны басыңыз",
        admin_exit: "Шығу",
        admin_add_title: "Жаңа нүкте",
        admin_field_category: "Санат:",
        admin_field_address_ru: "Мекен-жай (орыс):",
        admin_field_address_kz: "Мекен-жай (қаз):",
        admin_field_desc_ru: "Сипаттама (орыс):",
        admin_field_desc_kz: "Сипаттама (қаз):",
        admin_field_photos: "Фотосуреттер:",
        admin_add_btn: "Нүкте қосу",
        admin_delete_point: "Нүктені жою",
        admin_confirm_delete: "Бұл нүктені жойғыңыз келетініне сенімдісіз бе?",
        admin_confirm_reset: "Барлық нүктелерді бастапқы деректерге қайтару керек пе?",
        admin_reset_data: "Деректерді қалпына келтіру",

        // Share
        share_point: "Бөлісу",
        share_copied: "Сілтеме көшірілді!",

        // Heatmap
        heatmap_on: "Жылу картасы: ҚОСУЛЫ",
        heatmap_off: "Жылу картасы: ӨШІРУЛІ",

        // Map tiles
        tile_streets: "Карта",
        tile_satellite: "Спутник",
        tile_dark: "Қараңғы",

        // Drag
        drag_saved: "Координаттар жаңартылды",
        admin_bar_hint_drag: "ӘКІМШІ: нүкте қосу үшін картаны басыңыз · маркерлерді түзету үшін сүйреңіз"
    }
};

var currentLang = "ru";

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem("atyrau-map-lang", lang);

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
        var key = el.getAttribute("data-i18n");
        if (I18N[lang] && I18N[lang][key]) {
            el.textContent = I18N[lang][key];
        }
    });

    document.title = lang === "ru"
        ? "Цифровая карта прокуратуры г. Атырау"
        : "Атырау қ. прокуратурасының цифрлік картасы";

    document.documentElement.lang = lang === "ru" ? "ru" : "kk";

    document.querySelectorAll(".lang-btn").forEach(function (btn) {
        btn.classList.toggle("active", btn.getAttribute("data-lang") === lang);
    });
}

function t(key) {
    return (I18N[currentLang] && I18N[currentLang][key]) || key;
}

// Init language from localStorage or default
(function () {
    var saved = localStorage.getItem("atyrau-map-lang");
    if (saved && I18N[saved]) {
        currentLang = saved;
    }
})();
