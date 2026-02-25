/**
 * Данные точек карты безопасности Атырау.
 *
 * Категории:
 *   "blind-spots" — слепые зоны (нет камер видеонаблюдения)
 *   "abandoned"   — заброшенные здания
 *   "unlit"       — неосвещённые улицы
 *
 * Каждая точка:
 *   id       — уникальный идентификатор
 *   lat, lng — координаты
 *   title    — название
 *   category — категория
 *   address  — адрес
 *   description — описание
 *   photos   — массив путей к фотографиям (пока placeholder)
 */

var mapPoints = [

    // ── Слепые зоны (нет камер) ────────────────────────────
    {
        id: 1,
        lat: 47.1067,
        lng: 51.9203,
        title: "Переулок за ТЦ «Атырау»",
        category: "blind-spots",
        address: "ул. Сатпаева, переулок за ТЦ «Атырау»",
        description: "Узкий переулок позади торгового центра. Камеры видеонаблюдения отсутствуют на протяжении 200 метров. Слабое пешеходное движение в вечернее время.",
        photos: ["images/placeholders/blind1.svg", "images/placeholders/blind2.svg"]
    },
    {
        id: 2,
        lat: 47.1135,
        lng: 51.9150,
        title: "Проход между домами на Азаттык",
        category: "blind-spots",
        address: "ул. Азаттык, между домами 34 и 36",
        description: "Проход между жилыми домами без видеонаблюдения. Используется как пешеходный маршрут к остановке общественного транспорта.",
        photos: ["images/placeholders/blind1.svg"]
    },
    {
        id: 3,
        lat: 47.0985,
        lng: 51.9310,
        title: "Территория за рынком «Дина»",
        category: "blind-spots",
        address: "пр. Бейбарыс, за рынком «Дина»",
        description: "Задняя территория рынка. Отсутствует видеонаблюдение. Много скрытых зон между складскими помещениями.",
        photos: ["images/placeholders/blind1.svg", "images/placeholders/blind2.svg"]
    },
    {
        id: 4,
        lat: 47.1180,
        lng: 51.9095,
        title: "Дворы на улице Махамбета",
        category: "blind-spots",
        address: "ул. Махамбета, дворы домов 12-18",
        description: "Придомовая территория без камер наблюдения. Внутренние дворы старой застройки.",
        photos: ["images/placeholders/blind1.svg"]
    },
    {
        id: 5,
        lat: 47.1050,
        lng: 51.9400,
        title: "Пустырь у набережной",
        category: "blind-spots",
        address: "Набережная р. Урал, восточный участок",
        description: "Участок набережной реки Урал без камер видеонаблюдения. Территория плохо просматривается из-за зарослей.",
        photos: ["images/placeholders/blind2.svg"]
    },

    // ── Заброшенные здания ──────────────────────────────────
    {
        id: 6,
        lat: 47.1015,
        lng: 51.9250,
        title: "Заброшенный склад на Балыкшы",
        category: "abandoned",
        address: "район Балыкшы, промзона",
        description: "Бывший складской комплекс, не используется с 2015 года. Здание частично разрушено, представляет опасность обрушения.",
        photos: ["images/placeholders/abandoned1.svg", "images/placeholders/abandoned2.svg"]
    },
    {
        id: 7,
        lat: 47.1160,
        lng: 51.9340,
        title: "Недостроенное здание на Авангарде",
        category: "abandoned",
        address: "мкр. Авангард, ул. Курмангазы",
        description: "Незавершённое строительство многоэтажного дома. Заброшено с 2018 года. Открытые проёмы, отсутствие ограждения.",
        photos: ["images/placeholders/abandoned1.svg"]
    },
    {
        id: 8,
        lat: 47.0940,
        lng: 51.9180,
        title: "Бывший цех на Жилгородке",
        category: "abandoned",
        address: "район Жилгородок, промзона",
        description: "Бывший производственный цех. Заброшен с начала 2000-х. Территория не охраняется.",
        photos: ["images/placeholders/abandoned1.svg", "images/placeholders/abandoned2.svg"]
    },
    {
        id: 9,
        lat: 47.1095,
        lng: 51.9050,
        title: "Старое общежитие на Привокзальной",
        category: "abandoned",
        address: "ул. Привокзальная, 15",
        description: "Заброшенное общежитие рядом с железнодорожным вокзалом. Здание в аварийном состоянии.",
        photos: ["images/placeholders/abandoned2.svg"]
    },
    {
        id: 10,
        lat: 47.1200,
        lng: 51.9220,
        title: "Заброшенная котельная",
        category: "abandoned",
        address: "мкр. Привокзальный, за домом 8",
        description: "Бывшая котельная, выведена из эксплуатации. Территория захламлена строительным мусором.",
        photos: ["images/placeholders/abandoned1.svg"]
    },

    // ── Неосвещённые улицы ──────────────────────────────────
    {
        id: 11,
        lat: 47.1030,
        lng: 51.9120,
        title: "Улица Тайманова (южный участок)",
        category: "unlit",
        address: "ул. Тайманова, от Сатпаева до Махамбета",
        description: "Участок улицы протяжённостью около 400 метров без уличного освещения. Особенно опасен в зимнее время.",
        photos: ["images/placeholders/unlit1.svg", "images/placeholders/unlit2.svg"]
    },
    {
        id: 12,
        lat: 47.1145,
        lng: 51.9280,
        title: "Переулок Жангельдина",
        category: "unlit",
        address: "пер. Жангельдина",
        description: "Короткий переулок без фонарей. Используется пешеходами как сквозной проход. Полная темнота после захода солнца.",
        photos: ["images/placeholders/unlit1.svg"]
    },
    {
        id: 13,
        lat: 47.0970,
        lng: 51.9350,
        title: "Дорога к дачам за Балыкшы",
        category: "unlit",
        address: "район Балыкшы, дачный массив",
        description: "Дорога к дачному массиву без уличного освещения на протяжении 1.5 км. Отсутствует тротуар.",
        photos: ["images/placeholders/unlit2.svg"]
    },
    {
        id: 14,
        lat: 47.1110,
        lng: 51.9030,
        title: "Тупик на улице Есет Батыра",
        category: "unlit",
        address: "ул. Есет Батыра, тупик",
        description: "Тупиковый участок улицы. Фонари отсутствуют или не работают. Рядом расположены частные дома.",
        photos: ["images/placeholders/unlit1.svg", "images/placeholders/unlit2.svg"]
    },
    {
        id: 15,
        lat: 47.1075,
        lng: 51.9450,
        title: "Аллея в парке Победы",
        category: "unlit",
        address: "Парк Победы, боковая аллея",
        description: "Боковая аллея парка, не затронутая реконструкцией. Освещение отсутствует, густые кроны деревьев создают дополнительную тень.",
        photos: ["images/placeholders/unlit2.svg"]
    }
];
