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
        stat_police: "Участковые пункты:",
        stat_schools: "Школы:",
        legend_police: "Участковые пункты",
        legend_schools: "Школы",
        stat_total: "Всего точек:",

        // Footer
        footer_hint: "Нажмите на точку для подробной информации",

        // Search
        search_placeholder: "Улица или координаты...",
        search_loading: "Поиск...",
        search_no_results: "Ничего не найдено",
        search_error: "Ошибка поиска",
        search_coordinates: "Координаты",

        // Modal category badges
        badge_crime: "Преступность",
        badge_blind: "Слепая зона",
        badge_abandoned: "Заброшенное здание",
        badge_unlit: "Неосвещённая улица",

        // Admin
        admin_login: "Вход для админа",
        admin_login_title: "Вход администратора",

        // Staff
        login_back: "← Вернуться на карту (гостевой режим)",
        login_card_title: "Вход в систему",
        login_password_label: "Пароль",
        login_submit: "Войти",
        staff_role_tab: "Прокуратура",
        akimat_role_tab: "Акимат",
        akimat_page_title: "Заявки жителей — Акимат г. Атырау",
        akimat_back_to_map: "← На карту",
        staff_login_btn: "Вход для Сотрудников органа Прокуратуры",
        staff_login_title: "Вход для сотрудников",
        staff_login_desc: "Цифровая карта прокуратуры г. Атырау",
        staff_login_password: "Пароль:",
        staff_login_submit: "Войти",
        staff_login_error: "Неверный пароль",
        staff_logout_btn: "Выйти из режима сотрудника",
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
        admin_bar_hint_drag: "АДМИН: нажмите на карту чтобы добавить точку · перетаскивайте маркеры для корректировки",

        // Citizen feedback
        suggest_btn: "Сообщить о проблемной зоне",
        suggest_title: "Сообщить о проблемной зоне",
        suggest_hint: "Нажмите на карту, чтобы указать место",
        suggest_name: "Ваше имя:",
        suggest_contact: "Телефон (для ответа акимата):",
        suggest_category: "Категория:",
        suggest_desc: "Описание проблемы:",
        suggest_photo_label: "Фото проблемы (обязательно):",
        suggest_photo_choose: "Выбрать фото",
        suggest_photo_required: "Прикрепите фото проблемы",
        suggest_submit: "Отправить заявку в Акимат",
        suggest_success: "Заявка отправлена в Акимат г. Атырау. Ответ на ваш телефон в течение 15 суток.",
        suggest_pick_location: "Укажите место на карте",
        suggest_pending: "Новая заявка",
        suggest_pending_count: "Заявки:",
        suggest_from: "Житель:",
        suggest_contact_label: "Телефон:",
        suggest_approve: "Одобрить",
        suggest_reject: "Отклонить",
        suggest_approve_photos: "Прикрепите фото перед одобрением:",
        suggest_no_pending: "Нет новых заявок",
        suggest_confirm_reject: "Отклонить эту заявку?",
        suggest_list_btn: "Заявки",
        suggest_list_title: "Заявки от граждан",
        suggest_show_on_map: "На карте",

        // Akimat role
        akimat_login_btn: "Вход для Акимата г. Атырау",
        akimat_login_title: "Вход для Акимата",
        akimat_login_desc: "Обработка заявок жителей г. Атырау",
        akimat_login_password: "Пароль:",
        akimat_login_submit: "Войти",
        akimat_login_error: "Неверный пароль",
        akimat_logout_btn: "Выйти из режима акимата",
        akimat_panel_btn: "Заявки жителей",
        akimat_panel_title: "Заявки жителей — Акимат г. Атырау",
        akimat_tab_new: "Новые",
        akimat_tab_inprogress: "В работе",
        akimat_tab_archive: "Архив",
        akimat_no_new: "Нет новых заявок",
        akimat_no_inprogress: "Нет заявок в работе",
        akimat_no_archive: "Архив пуст",
        akimat_accept: "Принять в работу",
        akimat_reject: "Отклонить",
        akimat_resolve: "Отметить как устранено",
        akimat_accept_title: "Принять заявку в работу",
        akimat_accept_days_label: "За сколько дней устраните проблему?",
        akimat_accept_confirm: "Подтвердить",
        akimat_reject_title: "Отклонить заявку",
        akimat_reject_reason_label: "Причина отклонения:",
        akimat_reject_confirm: "Отклонить",
        akimat_resolve_confirm: "Подтвердите, что проблема устранена",
        akimat_cancel: "Отмена",
        akimat_response: "Ответ акимата:",
        akimat_accepted_on: "Принято:",
        akimat_rejected_on: "Отклонено:",
        akimat_resolved_on: "Устранено:",
        akimat_promised: "Срок устранения:",
        akimat_reason: "Причина:",
        akimat_days_short: "дн.",

        // SLA / status
        sla_days_left: "Осталось:",
        sla_overdue: "Просрочено",
        sla_responded: "Отвечено",
        status_pending: "Ожидает ответа",
        status_accepted: "В работе",
        status_rejected: "Отклонено",
        status_resolved: "Устранено",

        // Prosecutor monitoring
        prok_monitor_btn: "Контроль заявок",
        prok_monitor_title: "Контроль заявок в Акимат",
        prok_filter_status: "Статус:",
        prok_filter_all: "Все",
        prok_filter_pending: "Ожидают",
        prok_filter_accepted: "В работе",
        prok_filter_rejected: "Отклонённые",
        prok_filter_resolved: "Устранённые",
        prok_no_applications: "Нет заявок",
        prok_submitted_on: "Подано:",
        prok_days_passed: "Прошло:",
        badge_in_progress: "В работе",

        // Admin points management
        admin_manage_points: "Список точек",

        // Analytics tabs + AI Assistant (Prosecutor)
        an_tab_assistant: "ИИ Помощник",
        an_tab_overview: "Обзор",
        an_tab_time: "Время",
        an_tab_places: "Улицы",
        an_tab_people: "Лица",
        an_tab_zones: "Зоны",
        an_tab_ai: "AI-анализ",
        assistant_title: "ИИ Помощник Прокурора",
        assistant_subtitle: "Аналитический брифинг по криминогенной обстановке",
        assistant_no_data: "Нет данных за выбранный период.",
        assistant_summary: "Краткое резюме",
        assistant_total: "Всего правонарушений",
        assistant_public: "В общественных местах",
        assistant_articles_count: "Различных статей",
        assistant_zones: "Проблемных зон",
        assistant_top_articles: "Топ статей УК — структура преступности",
        assistant_article: "Статья",
        assistant_count: "Кол-во",
        assistant_share: "Доля",
        assistant_main_street: "Основная улица",
        assistant_top_streets: "Топ улиц с концентрацией преступлений",
        assistant_streets_hint: "Улицы, требующие усиленного прокурорского надзора и патрулирования",
        assistant_street: "Улица",
        assistant_top_arts: "Топ-3 статьи",
        assistant_hot_zones: "Горячие зоны (радиус ~500 м)",
        assistant_zones_hint: "Кластеры преступности — приоритетные участки для оперативного реагирования",
        assistant_cases: "случаев",
        assistant_main_article: "Основная статья",
        assistant_peak_hour: "Пиковый час",
        assistant_time_pattern: "Опасное время",
        assistant_peak_hours: "Пиковые часы",
        assistant_peak_day: "Самый опасный день",
        assistant_trend: "Тренд между завершёнными месяцами",
        assistant_vs_prev: "к прошлому месяцу",
        assistant_vs: "против",
        assistant_offenders: "Профиль правонарушителей",
        assistant_people_total: "Всего лиц",
        assistant_minors: "Несовершеннолетних",
        assistant_top_gender: "Преобл. пол",
        assistant_top_age: "Возрастная группа",
        assistant_top_occupation: "Род занятий",
        assistant_recommendations: "Рекомендации прокурору",
        rec_patrol: "Усилить патрулирование в пиковые часы:",
        rec_streets: "Установить надзор на улицах:",
        rec_cameras: "Рассмотреть установку камер видеонаблюдения в горячих зонах #1–#",
        rec_public: "Доля преступлений в общественных местах превышает 50% — требуется межведомственное взаимодействие с акиматом и полицией",
        rec_article: "Приоритетная статья УК — ",
        rec_article_action: "Провести анализ причин и условий.",
        rec_minors: "Среди правонарушителей выявлено",
        rec_minors_action: "несовершеннолетних — направить материалы в комиссию по делам несовершеннолетних",
        assistant_extra: "Дополнительные возможности",
        extra_predict: "Прогнозирование риска по дням и зонам на основании исторических трендов",
        extra_correlate: "Корреляция с инфраструктурой: освещение, камеры, заброшенные здания",
        extra_repeat: "Выявление повторных правонарушителей по ФИО и адресам",
        extra_routes: "Построение маршрутов прокурорских проверок по горячим зонам",
        extra_export: "Экспорт брифинга в PDF для отчёта руководству",
        extra_alerts: "Уведомления при резком росте преступности на конкретной улице",

        // Crime incidents (ЕРДР)
        crime_incidents_title: "Зарегистрированные правонарушения",
        crime_incidents_show: "Показать на карте",
        crime_incidents_count: "Правонарушений:",
        crime_filter_period: "Период:",
        crime_period_all: "Все",
        crime_period_month: "Месяц",
        crime_period_week: "Неделя",
        crime_period_day: "День",
        crime_organ: "Орган регистрации",
        crime_place_type: "Место совершения",
        crime_public_place: "общественное место",
        crime_address: "Адрес",
        crime_date_committed: "Дата совершения",
        crime_loading: "Загрузка данных...",
        crime_geocoding: "Определение координат:",
        crime_open_panel: "Открыть список",
        crime_back_to_map: "Назад к карте",
        crime_search_placeholder: "Поиск по статье, адресу, описанию..."
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
        stat_police: "Учаскелік пункттер:",
        stat_schools: "Мектептер:",
        legend_police: "Учаскелік пункттер",
        legend_schools: "Мектептер",
        stat_total: "Барлық нүктелер:",

        // Footer
        footer_hint: "Толық ақпарат алу үшін нүктені басыңыз",

        // Search
        search_placeholder: "Көше немесе координаталар...",
        search_loading: "Іздеу...",
        search_no_results: "Ештеңе табылмады",
        search_error: "Іздеу қатесі",
        search_coordinates: "Координаталар",

        // Modal category badges
        badge_crime: "Қылмыс",
        badge_blind: "Соқыр аймақ",
        badge_abandoned: "Тастанды ғимарат",
        badge_unlit: "Жарықтандырылмаған көше",

        // Admin
        admin_login: "Әкімші кіру",
        admin_login_title: "Әкімші кіру",

        // Staff
        login_back: "← Картаға оралу (қонақ режимі)",
        login_card_title: "Жүйеге кіру",
        login_password_label: "Құпия сөз",
        login_submit: "Кіру",
        staff_role_tab: "Прокуратура",
        akimat_role_tab: "Әкімдік",
        akimat_page_title: "Тұрғындардың өтінімдері — Атырау қ. Әкімдігі",
        akimat_back_to_map: "← Картаға",
        staff_login_btn: "Прокуратура органы қызметкерлеріне кіру",
        staff_login_title: "Қызметкерлерге кіру",
        staff_login_desc: "Атырау қаласы прокуратурасының цифрлік картасы",
        staff_login_password: "Құпия сөз:",
        staff_login_submit: "Кіру",
        staff_login_error: "Құпия сөз қате",
        staff_logout_btn: "Қызметкер режимінен шығу",
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
        admin_bar_hint_drag: "ӘКІМШІ: нүкте қосу үшін картаны басыңыз · маркерлерді түзету үшін сүйреңіз",

        // Citizen feedback
        suggest_btn: "Проблемалық аймақ туралы хабарлау",
        suggest_title: "Проблемалық аймақ туралы хабарлау",
        suggest_hint: "Орынды белгілеу үшін картаны басыңыз",
        suggest_name: "Сіздің атыңыз:",
        suggest_contact: "Телефон (әкімдіктің жауабы үшін):",
        suggest_category: "Санат:",
        suggest_desc: "Мәселенің сипаттамасы:",
        suggest_photo_label: "Проблеманың фотосы (міндетті):",
        suggest_photo_choose: "Фото таңдау",
        suggest_photo_required: "Проблеманың фотосын тіркеңіз",
        suggest_submit: "Әкімдікке өтінім жіберу",
        suggest_success: "Өтінім Атырау қ. әкімдігіне жіберілді. Жауап 15 күн ішінде телефоныңызға келеді.",
        suggest_pick_location: "Картадан орынды көрсетіңіз",
        suggest_pending: "Жаңа өтінім",
        suggest_pending_count: "Өтінімдер:",
        suggest_from: "Тұрғын:",
        suggest_contact_label: "Телефон:",
        suggest_approve: "Мақұлдау",
        suggest_reject: "Қабылдамау",
        suggest_approve_photos: "Мақұлдау алдында фото тіркеңіз:",
        suggest_no_pending: "Жаңа өтінімдер жоқ",
        suggest_confirm_reject: "Бұл өтінімді қабылдамау керек пе?",
        suggest_list_btn: "Өтінімдер",
        suggest_list_title: "Тұрғындардан өтінімдер",
        suggest_show_on_map: "Картада",

        // Akimat role
        akimat_login_btn: "Атырау қ. Әкімдігіне кіру",
        akimat_login_title: "Әкімдікке кіру",
        akimat_login_desc: "Атырау қ. тұрғындарының өтінімдерін өңдеу",
        akimat_login_password: "Құпия сөз:",
        akimat_login_submit: "Кіру",
        akimat_login_error: "Құпия сөз қате",
        akimat_logout_btn: "Әкімдік режимінен шығу",
        akimat_panel_btn: "Тұрғындардың өтінімдері",
        akimat_panel_title: "Тұрғындардың өтінімдері — Атырау қ. Әкімдігі",
        akimat_tab_new: "Жаңа",
        akimat_tab_inprogress: "Жұмыста",
        akimat_tab_archive: "Мұрағат",
        akimat_no_new: "Жаңа өтінімдер жоқ",
        akimat_no_inprogress: "Жұмыста өтінімдер жоқ",
        akimat_no_archive: "Мұрағат бос",
        akimat_accept: "Жұмысқа қабылдау",
        akimat_reject: "Қабылдамау",
        akimat_resolve: "Жойылды деп белгілеу",
        akimat_accept_title: "Өтінімді жұмысқа қабылдау",
        akimat_accept_days_label: "Проблеманы қанша күнде шешесіз?",
        akimat_accept_confirm: "Растау",
        akimat_reject_title: "Өтінімді қабылдамау",
        akimat_reject_reason_label: "Қабылдамау себебі:",
        akimat_reject_confirm: "Қабылдамау",
        akimat_resolve_confirm: "Проблема шешілгенін растаңыз",
        akimat_cancel: "Болдырмау",
        akimat_response: "Әкімдік жауабы:",
        akimat_accepted_on: "Қабылданды:",
        akimat_rejected_on: "Қабылданбады:",
        akimat_resolved_on: "Шешілді:",
        akimat_promised: "Шешу мерзімі:",
        akimat_reason: "Себебі:",
        akimat_days_short: "күн",

        // SLA / status
        sla_days_left: "Қалды:",
        sla_overdue: "Мерзімі өтті",
        sla_responded: "Жауап берілді",
        status_pending: "Жауап күтілуде",
        status_accepted: "Жұмыста",
        status_rejected: "Қабылданбады",
        status_resolved: "Шешілді",

        // Prosecutor monitoring
        prok_monitor_btn: "Өтінімдерді бақылау",
        prok_monitor_title: "Әкімдікке өтінімдерді бақылау",
        prok_filter_status: "Күй:",
        prok_filter_all: "Барлығы",
        prok_filter_pending: "Күтілуде",
        prok_filter_accepted: "Жұмыста",
        prok_filter_rejected: "Қабылданбаған",
        prok_filter_resolved: "Шешілген",
        prok_no_applications: "Өтінімдер жоқ",
        prok_submitted_on: "Берілді:",
        prok_days_passed: "Өтті:",
        badge_in_progress: "Жұмыста",

        // Admin points management
        admin_manage_points: "Нүктелер тізімі",

        // Analytics tabs + AI Assistant
        an_tab_assistant: "ЖИ Көмекші",
        an_tab_overview: "Шолу",
        an_tab_time: "Уақыт",
        an_tab_places: "Көшелер",
        an_tab_people: "Тұлғалар",
        an_tab_zones: "Аймақтар",
        an_tab_ai: "AI-талдау",
        assistant_title: "Прокурордың ЖИ Көмекшісі",
        assistant_subtitle: "Қылмыстық жағдай бойынша талдамалы брифинг",
        assistant_no_data: "Таңдалған кезеңге дерек жоқ.",
        assistant_summary: "Қысқаша түйіндеме",
        assistant_total: "Барлық құқық бұзушылықтар",
        assistant_public: "Қоғамдық орындарда",
        assistant_articles_count: "Әртүрлі баптар",
        assistant_zones: "Проблемалық аймақтар",
        assistant_top_articles: "ҚК баптары — қылмыс құрылымы",
        assistant_article: "Бап",
        assistant_count: "Саны",
        assistant_share: "Үлесі",
        assistant_main_street: "Негізгі көше",
        assistant_top_streets: "Қылмыс шоғырланған көшелердің топ-тізімі",
        assistant_streets_hint: "Күшейтілген прокурорлық қадағалау мен патрульді қажет ететін көшелер",
        assistant_street: "Көше",
        assistant_top_arts: "Топ-3 бап",
        assistant_hot_zones: "Ыстық аймақтар (~500 м радиус)",
        assistant_zones_hint: "Қылмыс кластерлері — жедел ден қою үшін басым аумақтар",
        assistant_cases: "оқиға",
        assistant_main_article: "Негізгі бап",
        assistant_peak_hour: "Шың сағат",
        assistant_time_pattern: "Қауіпті уақыт",
        assistant_peak_hours: "Шың сағаттар",
        assistant_peak_day: "Ең қауіпті күн",
        assistant_trend: "Аяқталған айлар арасындағы үрдіс",
        assistant_vs_prev: "өткен айға қарағанда",
        assistant_vs: "қарсы",
        assistant_offenders: "Құқық бұзушылар профилі",
        assistant_people_total: "Барлық тұлғалар",
        assistant_minors: "Кәмелетке толмағандар",
        assistant_top_gender: "Басым жыныс",
        assistant_top_age: "Жас тобы",
        assistant_top_occupation: "Қызметі",
        assistant_recommendations: "Прокурорға ұсыныстар",
        rec_patrol: "Шың сағаттарда патрульді күшейту:",
        rec_streets: "Көшелерде қадағалау орнату:",
        rec_cameras: "Ыстық аймақтарда #1–# бейнебақылау камераларын орнатуды қарастыру",
        rec_public: "Қоғамдық орындардағы қылмыс үлесі 50%-дан асады — әкімдік пен полициямен ведомствоаралық өзара іс-қимыл талап етіледі",
        rec_article: "Басым ҚК бабы — ",
        rec_article_action: "Себептері мен жағдайларын талдау керек.",
        rec_minors: "Құқық бұзушылар арасында",
        rec_minors_action: "кәмелетке толмаған анықталды — материалдарды кәмелетке толмағандар ісі жөніндегі комиссияға жіберу",
        assistant_extra: "Қосымша мүмкіндіктер",
        extra_predict: "Тарихи үрдістер негізінде күндер мен аймақтар бойынша тәуекелді болжау",
        extra_correlate: "Инфрақұрылыммен корреляция: жарықтандыру, камералар, тастанды ғимараттар",
        extra_repeat: "Аты-жөні мен мекенжайлары бойынша қайталанатын құқық бұзушыларды анықтау",
        extra_routes: "Ыстық аймақтар бойынша прокурорлық тексеру маршруттарын құру",
        extra_export: "Брифингті басшылыққа есеп беру үшін PDF-ке экспорттау",
        extra_alerts: "Нақты көшеде қылмыстың күрт өсуі туралы хабарламалар",

        // Crime incidents (ЕРДР)
        crime_incidents_title: "Тіркелген құқық бұзушылықтар",
        crime_incidents_show: "Картада көрсету",
        crime_incidents_count: "Құқық бұзушылықтар:",
        crime_filter_period: "Кезең:",
        crime_period_all: "Барлығы",
        crime_period_month: "Ай",
        crime_period_week: "Апта",
        crime_period_day: "Күн",
        crime_organ: "Тіркеу органы",
        crime_place_type: "Жасалу орны",
        crime_public_place: "қоғамдық орын",
        crime_address: "Мекен-жай",
        crime_date_committed: "Жасалу күні",
        crime_loading: "Кестеден деректер жүктелуде...",
        crime_geocoding: "Координаталар анықталуда:",
        crime_open_panel: "Тізімді ашу",
        crime_back_to_map: "Картаға оралу",
        crime_search_placeholder: "Бап, мекен-жай, сипаттама бойынша іздеу..."
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

    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
        var key = el.getAttribute("data-i18n-placeholder");
        if (I18N[lang] && I18N[lang][key]) {
            el.placeholder = I18N[lang][key];
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
