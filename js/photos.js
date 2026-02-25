/**
 * Реестр всех доступных фотографий в папке photo/
 * Админ выбирает фото из этого списка при добавлении точки.
 */
var AVAILABLE_PHOTOS = [
    // Заброшенные здания
    { file: "photo/Заброшка - Гагарин 84.jpg",               label_ru: "Заброшка — Гагарин 84",                  label_kz: "Тастанды — Гагарин 84",                  category: "abandoned" },
    { file: "photo/Заброшка - Досым Есенов улица.jpg",        label_ru: "Заброшка — ул. Досым Есенов",             label_kz: "Тастанды — Досым Есенов к.",              category: "abandoned" },
    { file: "photo/Заброшка - Исатаев 46.jpg",                label_ru: "Заброшка — Исатаев 46",                   label_kz: "Тастанды — Исатаев 46",                   category: "abandoned" },
    { file: "photo/Заброшка - Исатаев 59.jpg",                label_ru: "Заброшка — Исатаев 59",                   label_kz: "Тастанды — Исатаев 59",                   category: "abandoned" },
    { file: "photo/Заброшка - Проезд Каспий гараж.jpg",       label_ru: "Заброшка — Проезд Каспий, гараж",         label_kz: "Тастанды — Каспий өткелі, гараж",         category: "abandoned" },
    { file: "photo/Заброшка - Сырым Датов 106 гараж.jpg",     label_ru: "Заброшка — Сырым Датов 106, гараж",       label_kz: "Тастанды — Сырым Датов 106, гараж",       category: "abandoned" },
    { file: "photo/Заброшка - Сырым Датов 66, гаражы.jpg",    label_ru: "Заброшка — Сырым Датов 66, гаражи",       label_kz: "Тастанды — Сырым Датов 66, гараждар",     category: "abandoned" },

    // Неосвещённые улицы
    { file: "photo/Свет - Александр улица.jpg",               label_ru: "Свет — ул. Александр",                    label_kz: "Жарық — Александр к.",                    category: "unlit" },
    { file: "photo/Свет - Есет би улица.jpg",                 label_ru: "Свет — ул. Есет би",                      label_kz: "Жарық — Есет би к.",                      category: "unlit" },
    { file: "photo/Свет - Керейхан улица.jpg",                label_ru: "Свет — ул. Керейхан",                     label_kz: "Жарық — Керейхан к.",                     category: "unlit" },
    { file: "photo/Свет - Николай Гоголя.jpg",                label_ru: "Свет — ул. Николай Гоголя",               label_kz: "Жарық — Николай Гоголь к.",               category: "unlit" },
    { file: "photo/Свет -Темирханова улица.jpg",              label_ru: "Свет — ул. Темирханова",                  label_kz: "Жарық — Темірханов к.",                   category: "unlit" }
];
