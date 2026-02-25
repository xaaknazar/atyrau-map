/**
 * Данные точек — начальные (по умолчанию).
 * Реальные точки на основе загруженных фотографий.
 * Админ может добавлять/удалять через интерфейс — всё хранится в localStorage.
 */

var DEFAULT_POINTS = [
    // ── Заброшенные здания (реальные адреса из фото) ────────
    {
        id: 1,
        lat: 47.1170,
        lng: 51.9200,
        title_ru: "Заброшенное здание — Гагарин 84",
        title_kz: "Тастанды ғимарат — Гагарин 84",
        category: "abandoned",
        address_ru: "ул. Гагарина, 84",
        address_kz: "Гагарин к., 84",
        description_ru: "Заброшенное здание на улице Гагарина, 84. Здание не эксплуатируется, представляет угрозу безопасности.",
        description_kz: "Гагарин көшесі, 84 мекен-жайындағы тастанды ғимарат. Ғимарат пайдаланылмайды, қауіпсіздікке қатер төндіреді.",
        photos: ["photo/Заброшка - Гагарин 84.jpg"]
    },
    {
        id: 2,
        lat: 47.1050,
        lng: 51.9280,
        title_ru: "Заброшенное здание — ул. Досым Есенов",
        title_kz: "Тастанды ғимарат — Досым Есенов к.",
        category: "abandoned",
        address_ru: "ул. Досым Есенов",
        address_kz: "Досым Есенов көшесі",
        description_ru: "Заброшенное строение на улице Досым Есенов. Территория не огорожена.",
        description_kz: "Досым Есенов көшесіндегі тастанды құрылыс. Аумақ қоршалмаған.",
        photos: ["photo/Заброшка - Досым Есенов улица.jpg"]
    },
    {
        id: 3,
        lat: 47.1100,
        lng: 51.9150,
        title_ru: "Заброшенное здание — Исатаев 46",
        title_kz: "Тастанды ғимарат — Исатаев 46",
        category: "abandoned",
        address_ru: "ул. Исатаева, 46",
        address_kz: "Исатаев к., 46",
        description_ru: "Заброшенное здание по адресу Исатаев 46. Здание в аварийном состоянии.",
        description_kz: "Исатаев 46 мекен-жайындағы тастанды ғимарат. Ғимарат апатты жағдайда.",
        photos: ["photo/Заброшка - Исатаев 46.jpg"]
    },
    {
        id: 4,
        lat: 47.1090,
        lng: 51.9135,
        title_ru: "Заброшенное здание — Исатаев 59",
        title_kz: "Тастанды ғимарат — Исатаев 59",
        category: "abandoned",
        address_ru: "ул. Исатаева, 59",
        address_kz: "Исатаев к., 59",
        description_ru: "Заброшенное строение по адресу Исатаев 59.",
        description_kz: "Исатаев 59 мекен-жайындағы тастанды құрылыс.",
        photos: ["photo/Заброшка - Исатаев 59.jpg"]
    },
    {
        id: 5,
        lat: 47.0990,
        lng: 51.9320,
        title_ru: "Заброшенный гараж — проезд Каспий",
        title_kz: "Тастанды гараж — Каспий өткелі",
        category: "abandoned",
        address_ru: "Проезд Каспий, гараж",
        address_kz: "Каспий өткелі, гараж",
        description_ru: "Заброшенный гараж на проезде Каспий. Территория захламлена.",
        description_kz: "Каспий өткеліндегі тастанды гараж. Аумақ қоқыстарға толы.",
        photos: ["photo/Заброшка - Проезд Каспий гараж.jpg"]
    },
    {
        id: 6,
        lat: 47.1020,
        lng: 51.9070,
        title_ru: "Заброшенные гаражи — Сырым Датов 106",
        title_kz: "Тастанды гараждар — Сырым Датов 106",
        category: "abandoned",
        address_ru: "ул. Сырым Датова, 106",
        address_kz: "Сырым Датов к., 106",
        description_ru: "Заброшенные гаражи по адресу Сырым Датов 106. Не охраняются.",
        description_kz: "Сырым Датов 106 мекен-жайындағы тастанды гараждар. Қорғалмайды.",
        photos: ["photo/Заброшка - Сырым Датов 106 гараж.jpg"]
    },
    {
        id: 7,
        lat: 47.1035,
        lng: 51.9090,
        title_ru: "Заброшенные гаражи — Сырым Датов 66",
        title_kz: "Тастанды гараждар — Сырым Датов 66",
        category: "abandoned",
        address_ru: "ул. Сырым Датова, 66",
        address_kz: "Сырым Датов к., 66",
        description_ru: "Заброшенные гаражи по адресу Сырым Датов 66.",
        description_kz: "Сырым Датов 66 мекен-жайындағы тастанды гараждар.",
        photos: ["photo/Заброшка - Сырым Датов 66, гаражы.jpg"]
    },

    // ── Неосвещённые улицы (реальные адреса из фото) ────────
    {
        id: 8,
        lat: 47.1130,
        lng: 51.9250,
        title_ru: "Неосвещённая улица — Александр",
        title_kz: "Жарықтандырылмаған көше — Александр",
        category: "unlit",
        address_ru: "ул. Александр",
        address_kz: "Александр көшесі",
        description_ru: "Улица Александр без уличного освещения. Опасна в тёмное время суток.",
        description_kz: "Көше жарығынсыз Александр көшесі. Қараңғы уақытта қауіпті.",
        photos: ["photo/Свет - Александр улица.jpg"]
    },
    {
        id: 9,
        lat: 47.1070,
        lng: 51.9190,
        title_ru: "Неосвещённая улица — Есет би",
        title_kz: "Жарықтандырылмаған көше — Есет би",
        category: "unlit",
        address_ru: "ул. Есет би",
        address_kz: "Есет би көшесі",
        description_ru: "Улица Есет би — отсутствует уличное освещение на значительном участке.",
        description_kz: "Есет би көшесі — айтарлықтай бөлігінде көше жарығы жоқ.",
        photos: ["photo/Свет - Есет би улица.jpg"]
    },
    {
        id: 10,
        lat: 47.1150,
        lng: 51.9310,
        title_ru: "Неосвещённая улица — Керейхан",
        title_kz: "Жарықтандырылмаған көше — Керейхан",
        category: "unlit",
        address_ru: "ул. Керейхан",
        address_kz: "Керейхан көшесі",
        description_ru: "Улица Керейхан — фонари не работают или отсутствуют.",
        description_kz: "Керейхан көшесі — фонарьлар жұмыс істемейді немесе жоқ.",
        photos: ["photo/Свет - Керейхан улица.jpg"]
    },
    {
        id: 11,
        lat: 47.1060,
        lng: 51.9350,
        title_ru: "Неосвещённая улица — Николай Гоголя",
        title_kz: "Жарықтандырылмаған көше — Николай Гоголь",
        category: "unlit",
        address_ru: "ул. Николай Гоголя",
        address_kz: "Николай Гоголь көшесі",
        description_ru: "Улица Николай Гоголя без освещения.",
        description_kz: "Жарықтандырусыз Николай Гоголь көшесі.",
        photos: ["photo/Свет - Николай Гоголя.jpg"]
    },
    {
        id: 12,
        lat: 47.1115,
        lng: 51.9100,
        title_ru: "Неосвещённая улица — Темирханова",
        title_kz: "Жарықтандырылмаған көше — Темірханов",
        category: "unlit",
        address_ru: "ул. Темирханова",
        address_kz: "Темірханов көшесі",
        description_ru: "Улица Темирханова — уличное освещение отсутствует.",
        description_kz: "Темірханов көшесі — көше жарығы жоқ.",
        photos: ["photo/Свет -Темирханова улица.jpg"]
    }
];

// ── Load points from localStorage or use defaults ───────
var STORAGE_KEY = "atyrau-map-points";

function loadPoints() {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            // corrupted data — fall back
        }
    }
    return JSON.parse(JSON.stringify(DEFAULT_POINTS));
}

function savePoints() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mapPoints));
}

function resetPoints() {
    localStorage.removeItem(STORAGE_KEY);
    mapPoints = JSON.parse(JSON.stringify(DEFAULT_POINTS));
}

function getNextId() {
    var max = 0;
    mapPoints.forEach(function (p) {
        if (p.id > max) max = p.id;
    });
    return max + 1;
}

var mapPoints = loadPoints();
