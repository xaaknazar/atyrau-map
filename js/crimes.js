/**
 * Данные о зарегистрированных правонарушениях (ЕРДР).
 *
 * Каждая запись содержит:
 *   erdr        — номер ЕРДР
 *   regDate     — дата-время регистрации (ISO)
 *   organ       — орган регистрации
 *   crimeDate   — дата совершения (ISO)
 *   crimeTime   — время совершения (строка)
 *   description — описание преступления/проступка
 *   article     — квалификация (статья)
 *   articlePart — п.п. квалификации
 *   placeType   — место совершения (тип)
 *   isPublic    — общественное место (да/нет)
 *   oblast      — область
 *   district    — район
 *   city        — населённый пункт
 *   street      — улица
 *   house       — дом
 *   building    — корпус
 *   apartment   — квартира
 *   lat, lng    — координаты (геокодированные)
 */

var crimeIncidents = [
    {
        id: 1,
        erdr: "260000121000007",
        regDate: "2026-02-04T11:43:00",
        organ: "Агентство РК по финансовому мониторингу",
        crimeDate: "2025-01-01",
        crimeTime: "10:00",
        description: "Бір топ адамның, азаматтардың бірыңғай жинақтаушы зейнетақы қорындағы жинақтарын заңсыз шығару фактісі бойынша тергеп-тексеру. Стоматологиялық клиникалар арқылы жалған ДКК қорытындыларын жасау.",
        article: "ст.247 ч.2",
        articlePart: "",
        placeType: "медучреждение",
        isPublic: true,
        oblast: "Атырауская область",
        district: "Атырау",
        city: "Балықшы",
        street: "3",
        house: "24",
        building: "",
        apartment: "",
        lat: 47.0875,
        lng: 51.8650
    },
    {
        id: 2,
        erdr: "260000121000025",
        regDate: "2026-03-17T01:02:00",
        organ: "Агентство РК по финансовому мониторингу",
        crimeDate: "2021-05-22",
        crimeTime: "15:26",
        description: "Стоматологиялық клиникалардың басшылары «БЗЖҚ» АҚ-нан салымшылардың зейнетақы төлемдерін заңсыз шығаруда жалған құжаттарды жасаған. ҚК-нің 385-бабы 2-бөлігі.",
        article: "ст.385 ч.2",
        articlePart: "",
        placeType: "офис",
        isPublic: true,
        oblast: "Атырау облысы",
        district: "Атырау",
        city: "АТЫРАУ",
        street: "",
        house: "",
        building: "",
        apartment: "",
        lat: 47.1067,
        lng: 51.9203
    },
    {
        id: 3,
        erdr: "262300011000004",
        regDate: "2026-02-18T19:52:00",
        organ: "Прокуратура Атырауской области",
        crimeDate: "2025-07-05",
        crimeTime: "04:00",
        description: "«Барма» түнгі клубының алдында жәбірленуші Болатова Жадыра Иванқызын бұрыңғы жолдасы Ұзақбаев Асылхан басымен мұрнынан ұрып, мұрынын сындырған. ҚК-нің 107-бабы 1-бөлігі.",
        article: "ст.107 ч.1",
        articlePart: "",
        placeType: "улица (площадь)",
        isPublic: true,
        oblast: "Атырау облысы",
        district: "Атырау",
        city: "АТЫРАУ",
        street: "АЗАТТЫҚ",
        house: "2",
        building: "",
        apartment: "",
        lat: 47.1172,
        lng: 51.9198
    },
    {
        id: 4,
        erdr: "262300011000003",
        regDate: "2026-02-05T19:27:00",
        organ: "Прокуратура Атырауской области",
        crimeDate: "2025-12-03",
        crimeTime: "12:00",
        description: "Полиция органдары қызметкерлерінің іс-әрекеттерінде ҚК-нің 433-бабы 3-бөлігі 1-тармағында көзделген қылмыстық құқық бұзушылық белгілері анықталды.",
        article: "ст.433 ч.3",
        articlePart: "п.1",
        placeType: "другие помещения",
        isPublic: false,
        oblast: "Атырау облысы",
        district: "Қызылқоға ауданы",
        city: "МИЯЛЫ",
        street: "УӘЛИ ЖАЙЫҚОВ",
        house: "13/1",
        building: "",
        apartment: "",
        lat: 47.0419,
        lng: 53.0677
    },
    {
        id: 5,
        erdr: "262300011000005",
        regDate: "2026-03-23T18:00:00",
        organ: "Прокуратура Атырауской области",
        crimeDate: "2026-03-22",
        crimeTime: "19:00",
        description: "ҚАЖ-нің №15 мекемесінде сотталған Д.Утегенов қайтыс болған. Мекеме қызметкерлері бейне бақылау камерасы жабылғанына назар аудармай, медициналық көмекті қамтамасыз етпеген. ҚК-нің 370-бабы.",
        article: "ст.370 ч.4",
        articlePart: "п.1; п.2",
        placeType: "другие помещения",
        isPublic: false,
        oblast: "Атырау облысы",
        district: "Атырау",
        city: "ТАСҚАЛА",
        street: "",
        house: "",
        building: "1",
        apartment: "",
        lat: 47.0460,
        lng: 51.8770
    },
    {
        id: 6,
        erdr: "262300031000011",
        regDate: "2026-02-17T20:56:00",
        organ: "ДП Атырауской области",
        crimeDate: "2023-12-20",
        crimeTime: "12:00",
        description: "Күдікті С.Литвиненконың жас бала жәбірленушіге (18.04.2015 ж.т.) қатысты жасаған іс-әрекетінде ҚК-нің 121-бабы 4-бөлігінде көзделген қылмыстық құқық бұзушылық құрамы анықталды.",
        article: "ст.121 ч.4",
        articlePart: "",
        placeType: "квартира",
        isPublic: false,
        oblast: "Атырау облысы",
        district: "Атырау",
        city: "АТЫРАУ",
        street: "АВАНГАРД-3",
        house: "76",
        building: "",
        apartment: "21",
        lat: 47.1215,
        lng: 51.9520
    },
    {
        id: 7,
        erdr: "262300031000023",
        regDate: "2026-03-19T16:29:00",
        organ: "ДП Атырауской области",
        crimeDate: "2025-12-27",
        crimeTime: "12:00",
        description: "Күдікті С.Сарсемалиевке қатысты қаза болған М.Карабалинге тиесілі ірі қара малдарын ғаламтор желісі арқылы алаяқтық ниетпен сатып, мүліктік залал келтіру. ҚК-нің 190-бабы.",
        article: "ст.190 ч.2",
        articlePart: "п.4",
        placeType: "другие помещения",
        isPublic: false,
        oblast: "Атырау облысы",
        district: "Қызылқоға ауданы",
        city: "ЖАНГЕЛДИН",
        street: "",
        house: "",
        building: "",
        apartment: "",
        lat: 47.2300,
        lng: 53.1200
    },
    {
        id: 8,
        erdr: "262300031000025",
        regDate: "2026-03-26T09:34:00",
        organ: "ДП Атырауской области",
        crimeDate: "2021-03-03",
        crimeTime: "10:00",
        description: "Тергелуші Утяшов А.С. 2021 жылы Сағыз ауылында 3 дана атыс қаруына ұқсас затты көміп жасырып кеткендігін мойындаған. ҚК-нің 287-бабы.",
        article: "ст.287 ч.2",
        articlePart: "",
        placeType: "лес, лесопосадка",
        isPublic: false,
        oblast: "Атырау облысы",
        district: "Қызылқоға ауданы",
        city: "САГИЗ",
        street: "АХТАН КЕРЕЙҰЛЫ",
        house: "1",
        building: "",
        apartment: "",
        lat: 47.0670,
        lng: 53.3610
    },
    {
        id: 9,
        erdr: "262300031000017",
        regDate: "2026-03-09T19:04:00",
        organ: "ДП Атырауской области",
        crimeDate: "2025-05-10",
        crimeTime: "11:00",
        description: "С.Сарсемалиев Мұнайшы мөлтек ауданы, №3 көше, №7 үйде қайын аға туысқаны Мұқанғалиев Н.М.-ны пышақпен қазаға ұшыратқан. Мүрдесі іргетас жанынан табылған. ҚК-нің 99-бабы.",
        article: "ст.99 ч.1",
        articlePart: "",
        placeType: "дом",
        isPublic: false,
        oblast: "Атырау облысы",
        district: "Атырау",
        city: "АТЫРАУ",
        street: "№3",
        house: "17",
        building: "",
        apartment: "",
        lat: 47.0930,
        lng: 51.8560
    },
    {
        id: 10,
        erdr: "262300031000022",
        regDate: "2026-03-18T11:01:00",
        organ: "ДП Атырауской области",
        crimeDate: "2026-03-18",
        crimeTime: "04:05",
        description: "Кәмелетке толмаған қызға (15.07.2010 ж.т.) қатысты жыныстық қатынас фактісі. ҚК-нің 122-бабы 1-бөлігі.",
        article: "ст.122 ч.1",
        articlePart: "",
        placeType: "дом",
        isPublic: false,
        oblast: "Атырау облысы",
        district: "Атырау",
        city: "АТЫРАУ",
        street: "Молдагулова",
        house: "102",
        building: "",
        apartment: "",
        lat: 47.1005,
        lng: 51.9115
    },
    {
        id: 11,
        erdr: "262300031000021",
        regDate: "2026-03-16T19:11:00",
        organ: "ДП Атырауской области",
        crimeDate: "2025-01-14",
        crimeTime: "15:31",
        description: "Жанбырбаев Н.Ж. Instagram-да «hacker.atyrau» парақшасы арқылы алаяқтық жасап, Дүйсебаев Б.А.-дан Kaspi Bank арқылы 500 000 теңге аудартқызып, иемденген. ҚК-нің 190-бабы.",
        article: "ст.190 ч.3",
        articlePart: "п.4",
        placeType: "другие помещения",
        isPublic: false,
        oblast: "Атырау облысы",
        district: "Атырау",
        city: "АТЫРАУ",
        street: "1",
        house: "2",
        building: "",
        apartment: "",
        lat: 47.1145,
        lng: 51.9280
    },
    {
        id: 12,
        erdr: "262300031000018",
        regDate: "2026-03-09T19:09:00",
        organ: "ДП Атырауской области",
        crimeDate: "2025-11-06",
        crimeTime: "13:00",
        description: "С.Сарсемалиев Мұнайшы мөлтек ауданы, №3 көше, №7 үйде қайын апа туысқаны Қарабалина М.М.-ны пышақпен қазаға ұшыратқан. Мүрдесі іргетас жанынан табылған. ҚК-нің 99-бабы 2-бөлігі.",
        article: "ст.99 ч.2",
        articlePart: "п.13",
        placeType: "дом",
        isPublic: false,
        oblast: "Атырау облысы",
        district: "Атырау",
        city: "АТЫРАУ",
        street: "№3",
        house: "17",
        building: "",
        apartment: "",
        lat: 47.0932,
        lng: 51.8558
    },
    {
        id: 13,
        erdr: "262300041000002",
        regDate: "2026-01-14T15:18:00",
        organ: "ДКНБ по Атырауской области",
        crimeDate: "2026-01-14",
        crimeTime: "14:00",
        description: "ҚАЖ-нің №15 мекемесінде жазасын өтеуші сотталған Д.М.Амантурлиннің жазбаша арызы. ҚК-нің 287-бабы.",
        article: "ст.287 ч.3",
        articlePart: "",
        placeType: "прочие уличные",
        isPublic: true,
        oblast: "Атырау облысы",
        district: "Атырау",
        city: "ЖҰМЫСКЕР",
        street: "№16",
        house: "4",
        building: "",
        apartment: "",
        lat: 47.0880,
        lng: 51.9310
    },
    {
        id: 14,
        erdr: "262300041000005",
        regDate: "2026-02-19T12:36:00",
        organ: "ДКНБ по Атырауской области",
        crimeDate: "2026-02-09",
        crimeTime: "09:45",
        description: "Шетел азаматтарының ҚР шекара өткізу пункттерінен тысқары жерлерден шекараны заңсыз кесіп өтіп, РФ аумағына заңсыз енуін ұйымдастыру фактісі. ҚК-нің 394-бабы.",
        article: "ст.394 ч.2",
        articlePart: "",
        placeType: "берег реки",
        isPublic: false,
        oblast: "Атырау облысы",
        district: "Құрманғазы ауданы",
        city: "КОПТОГАЙ",
        street: "Шайхы Әбішев",
        house: "1",
        building: "",
        apartment: "",
        lat: 46.8530,
        lng: 51.6350
    },
    {
        id: 15,
        erdr: "262300041000004",
        regDate: "2026-02-04T17:03:00",
        organ: "ДКНБ по Атырауской области",
        crimeDate: "2025-05-15",
        crimeTime: "10:00",
        description: "РФ қарулы күштерінің құрамында Украина территориясында соғысқа қатысқан ҚР азаматы О.Слушаков туралы мәлімет. ҚК-нің 172-бабы — наемничество.",
        article: "ст.172",
        articlePart: "",
        placeType: "прочие уличные",
        isPublic: true,
        oblast: "Атырауская область",
        district: "Атырау",
        city: "АТЫРАУ",
        street: "ӘБДІРЕШ ДӘУЛЕТОВ",
        house: "5",
        building: "",
        apartment: "",
        lat: 47.1030,
        lng: 51.9050
    },
    {
        id: 16,
        erdr: "262300041000003",
        regDate: "2026-01-15T16:43:00",
        organ: "ДКНБ по Атырауской области",
        crimeDate: "2026-01-15",
        crimeTime: "16:30",
        description: "«Мәскеу — Астана» рейсін рәсімдеу барысында мүрдесі салынған мырыш табыт анықталған. Туремуратов Данат (08.07.2005 ж.т.). ҚК-нің 172-бабы.",
        article: "ст.172",
        articlePart: "",
        placeType: "другие помещения",
        isPublic: false,
        oblast: "Атырау облысы",
        district: "Атырау",
        city: "АТЫРАУ",
        street: "",
        house: "",
        building: "",
        apartment: "",
        lat: 47.1219,
        lng: 51.8213
    }
];

/**
 * Фильтрация инцидентов по периоду.
 * @param {string} period — "all" | "month" | "week" | "day"
 * @returns {Array} Отфильтрованный массив
 */
function filterCrimesByPeriod(period) {
    if (period === "all") return crimeIncidents;

    var now = new Date();
    var cutoff;

    switch (period) {
        case "day":
            cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
        case "week":
            cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case "month":
            cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        default:
            return crimeIncidents;
    }

    return crimeIncidents.filter(function (c) {
        var d = new Date(c.regDate);
        return d >= cutoff;
    });
}

/**
 * Построить адресную строку из полей инцидента.
 */
function buildCrimeAddress(c) {
    var parts = [];
    if (c.oblast) parts.push(c.oblast);
    if (c.district) parts.push(c.district);
    if (c.city) parts.push(c.city);
    if (c.street) parts.push("ул. " + c.street);
    if (c.house) parts.push("д. " + c.house);
    if (c.building) parts.push("корп. " + c.building);
    if (c.apartment) parts.push("кв. " + c.apartment);
    return parts.join(", ");
}

/**
 * Форматировать дату для отображения.
 */
function formatCrimeDate(isoStr) {
    var d = new Date(isoStr);
    var day = ("0" + d.getDate()).slice(-2);
    var month = ("0" + (d.getMonth() + 1)).slice(-2);
    var year = d.getFullYear();
    var hours = ("0" + d.getHours()).slice(-2);
    var mins = ("0" + d.getMinutes()).slice(-2);
    return day + "." + month + "." + year + " " + hours + ":" + mins;
}
