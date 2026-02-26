/**
 * Generate crime points using a manual street coordinate mapping for Atyrau.
 * Nominatim doesn't index Kazakh street names well, so we use known coords.
 */
const fs = require("fs");

const RAW_FILE = __dirname + "/crime-raw.txt";
const OUTPUT_FILE = __dirname + "/../js/crime-points.js";

const CENTER = { lat: 47.1067, lng: 51.9203 };

// ═══════════════════════════════════════════════════════════
//  Manual street coordinate mapping for Atyrau
//  Based on OpenStreetMap data & known city geography
// ═══════════════════════════════════════════════════════════
const STREETS = {
    // ── Central / Right bank ──
    "НАБЕРЕЖНАЯ":               { lat: 47.1055, lng: 51.9250 },
    "АБАЙ":                     { lat: 47.1080, lng: 51.9180 },
    "АБАЙ ҚҰНАНБАЕВ":           { lat: 47.1080, lng: 51.9180 },
    "АЗАТТЫҚ":                  { lat: 47.1100, lng: 51.9100 },
    "АЗАТТЫК":                  { lat: 47.1100, lng: 51.9100 },
    "МАХАМБЕТ ӨТЕМІСҰЛЫ":       { lat: 47.1040, lng: 51.9160 },
    "МҰСА БАЙМҰХАНОВ":          { lat: 47.1060, lng: 51.9190 },
    "ҚҰРМАНҒАЗЫ":               { lat: 47.1045, lng: 51.9280 },
    "СЫРЫМ ДАТОВ":              { lat: 47.1075, lng: 51.9220 },
    "ИСАТАЙ":                   { lat: 47.1085, lng: 51.9150 },
    "ДОСТЫҚ":                   { lat: 47.1070, lng: 51.9300 },
    "ЖАСТАР":                   { lat: 47.1095, lng: 51.9130 },
    "КӨКТЕМ":                   { lat: 47.1110, lng: 51.9080 },
    "ОРТАЛЫҚ":                  { lat: 47.1065, lng: 51.9210 },
    "СОЛТҮСТІК":                { lat: 47.1120, lng: 51.9050 },
    "СТУДЕНТТЕР":               { lat: 47.1090, lng: 51.9240 },
    "ДМИТРИЙ МЕНДЕЛЕЕВ":        { lat: 47.1050, lng: 51.9170 },
    "ГЕОРГИЙ КАНЦЕВ":           { lat: 47.1035, lng: 51.9200 },
    "АДМИРАЛ ЛЕВ ВЛАДИМИРСКИЙ":{ lat: 47.1030, lng: 51.9230 },
    "ЮРИЙ ГАГАРИН":             { lat: 47.1040, lng: 51.9140 },
    "РАБОЧАЯ":                  { lat: 47.1120, lng: 51.9110 },
    "АЛМАТЫ":                   { lat: 47.1075, lng: 51.9260 },
    "САРЫАРҚА":                 { lat: 47.1060, lng: 51.9320 },
    "БОЛАШАҚ":                  { lat: 47.1050, lng: 51.9340 },

    // ── Nursaya / Eastern districts ──
    "НҰРСАЯ":                   { lat: 47.0960, lng: 51.9480 },
    "ҚАНЫШ СӘТБАЕВ":           { lat: 47.1000, lng: 51.9380 },
    "АҒИДОЛЛА НҰҒЫМАНОВ":       { lat: 47.0950, lng: 51.9420 },
    "ШӘЛИ ЕРКЕШОВ":             { lat: 47.0940, lng: 51.9450 },
    "БЕЙІМБЕТ МАЙЛИН":          { lat: 47.0970, lng: 51.9400 },
    "КУЛЯШ БАЙСЕИТОВОЙ":        { lat: 47.0980, lng: 51.9360 },
    "ЖИЕМБЕТ":                  { lat: 47.0930, lng: 51.9470 },
    "НҰРҒИСА ТЛЕНДИЕВ":         { lat: 47.0955, lng: 51.9440 },
    "ҚАЙЫРҒАЛИ СМАҒҰЛОВ":       { lat: 47.0945, lng: 51.9410 },
    "ҚАРШЫҒА АХМЕДЬЯРОВ":       { lat: 47.0965, lng: 51.9460 },
    "МИРАС":                    { lat: 47.0920, lng: 51.9490 },
    "МАРАТ ТЕМІРХАНОВ":         { lat: 47.0935, lng: 51.9430 },

    // ── Left bank / South suburbs ──
    "САДОВАЯ":                  { lat: 47.0850, lng: 51.9350 },
    "ГРУШЕВАЯ":                 { lat: 47.0820, lng: 51.9400 },
    "КЛУБНИЧНЫЙ":               { lat: 47.0830, lng: 51.9430 },
    "КРЫЖОВНИКОВА":             { lat: 47.0810, lng: 51.9380 },
    "ПРИДОРОЖНАЯ":              { lat: 47.0870, lng: 51.9450 },
    "ЗОНА ОТДЫХА":              { lat: 47.0880, lng: 51.9500 },
    "ТУПИКОВАЯ":                { lat: 47.0860, lng: 51.9470 },
    "БЕЙБАРЫС":                 { lat: 47.0750, lng: 51.9320 },
    "С.БЕЙБАРЫС":               { lat: 47.0750, lng: 51.9320 },
    "БЕРЕКЕ":                   { lat: 47.0780, lng: 51.9360 },
    "АЛМАГҮЛ":                  { lat: 47.0800, lng: 51.9300 },
    "АЛМАГҮЛ МӨЛТЕК АУДАНЫ":   { lat: 47.0800, lng: 51.9300 },
    "АҚ ШАҒАЛА":                { lat: 47.0790, lng: 51.9280 },
    "МОЛШЫЛЫҚ":                 { lat: 47.0840, lng: 51.9340 },
    "МҰНАЙШЫ":                  { lat: 47.0760, lng: 51.9260 },
    "АТЫРАУ":                   { lat: 47.0770, lng: 51.9290 },
    "ХИМИК АТЫРАУ":             { lat: 47.0730, lng: 51.9240 },
    "ҒАРЫШКЕР":                 { lat: 47.0850, lng: 51.9280 },

    // ── Avangard districts ──
    "АВАНГАРД-3":               { lat: 47.0930, lng: 51.8850 },
    "АВАНГАРД-2":               { lat: 47.0960, lng: 51.8880 },
    "АВАНГАРД -2":              { lat: 47.0960, lng: 51.8880 },
    "АВАНГАРД":                 { lat: 47.0945, lng: 51.8865 },

    // ── Vokzal / Train station area ──
    "ВОКЗАЛ МАҢЫ-3А":           { lat: 47.1180, lng: 51.9200 },
    "ВОКЗАЛ МАҢЫ - 5":          { lat: 47.1170, lng: 51.9220 },
    "ПРИВОКЗАЛЬНЫЙ":            { lat: 47.1190, lng: 51.9190 },
    "СТРОЙКОНТОР":              { lat: 47.1160, lng: 51.9160 },
    "ПРИУРАЛЬНАЯ":              { lat: 47.1140, lng: 51.9130 },
    "ТАМПОНАЖНИК":              { lat: 47.1150, lng: 51.9140 },
    "ФЕРМА":                    { lat: 47.1130, lng: 51.9120 },

    // ── Оркен / suburbs ──
    "ӨРКЕН":                    { lat: 47.0990, lng: 51.9100 },
    "ОРКЕН":                    { lat: 47.0990, lng: 51.9100 },

    // ── Named after people ──
    "ЖУБАН МОЛДАГАЛИЕВ":        { lat: 47.1030, lng: 51.9130 },
    "УӘЛИ ЖАЙЫҚОВ":             { lat: 47.1055, lng: 51.9140 },
    "ЖОЛДАСҚАЛИ ДОСМҰХАМБЕТОВ": { lat: 47.1045, lng: 51.9120 },
    "ОРЫНГАЛИ СМАГУЛОВ":        { lat: 47.1035, lng: 51.9180 },
    "АЙЖАРҚЫН ӘЛІШЕВА":         { lat: 47.1025, lng: 51.9170 },
    "ӨРЕКЕШЕВ СӘРСЕН":          { lat: 47.1015, lng: 51.9160 },
    "СӘЛІМГЕРЕЙ СӘБЕТОВ":       { lat: 47.1005, lng: 51.9150 },
    "АКАДЕМИК БИНЕШ ЖАРБОСЫНОВ": { lat: 47.0995, lng: 51.9140 },
    "ҒАББАС БЕРГАЛИЕВ":         { lat: 47.0985, lng: 51.9130 },
    "ЖҰМЕКЕН НӘЖІМЕДЕНОВ":      { lat: 47.0975, lng: 51.9120 },
    "МУХАН НҰРМАНОВ":           { lat: 47.0965, lng: 51.9110 },
    "ҒИНАЯТ ӘБДІРАХМАНОВ":      { lat: 47.0955, lng: 51.9100 },
    "СӘТҚҰЛ БЕКЖАНОВ":          { lat: 47.0945, lng: 51.9090 },
    "ҚҰРЫЛЫСШЫЛАР":             { lat: 47.0935, lng: 51.9080 },
    "ІБАТОЛЛА ШЕКЕНОВ":         { lat: 47.1015, lng: 51.9250 },
    "ИБАТОЛЛА ШЕКЕНОВ":         { lat: 47.1015, lng: 51.9250 },
    "АРОН АЮПОВ":               { lat: 47.1020, lng: 51.9100 },
    "АНУАРБЕК АККУЛОВ":         { lat: 47.1010, lng: 51.9090 },
    "ҚАДІРӘЛІ БАЛМАНОВ":        { lat: 47.1000, lng: 51.9310 },
    "ӘЖІҒАЛИ ЖАҚСЫБАЕВ":        { lat: 47.0990, lng: 51.9340 },
    "ӘУБЕКЕРОВ АСЫЛБЕК":        { lat: 47.0980, lng: 51.9330 },
    "Ә.ӨМІРЗАҚОВА":             { lat: 47.0970, lng: 51.9320 },
    "ӘБДІРЕШ ДӘУЛЕТОВ":         { lat: 47.1025, lng: 51.9270 },
    "ШАЙХЫ ӘБІШЕВ":             { lat: 47.1035, lng: 51.9280 },
    "АГАЙЫНДЫ ЖОЛАМАН МЕН ХАМЗА КАШАУОВТАР": { lat: 47.1025, lng: 51.9150 },

    // ── Dossor road / highway ──
    "АТЫРАУ-ДОССОР":            { lat: 47.1130, lng: 51.9350 },
    "АТЫРАУ ДОССОР":            { lat: 47.1130, lng: 51.9350 },

    // ── Misc / named areas ──
    "ЗАРОСЛЫЙ":                 { lat: 47.1105, lng: 51.9060 },
    "ЖҰЛДЫЗ-3":                { lat: 47.0920, lng: 51.9050 },
    "ЖИЛОЙ КОМПЛЕКС ГАУХАРТАС": { lat: 47.1050, lng: 51.9350 },
    "КЕҢӨЗЕК А.О":             { lat: 47.0900, lng: 51.9000 },
    "ЖАЗЫКБАЕВ":                { lat: 47.0910, lng: 51.9020 },
    "АМӨЗ АУМАҒЫНДАҒЫ ӨНДІРІС АЙМАҒЫ": { lat: 47.0850, lng: 51.8900 },
};

// Microdistrict approximate coordinates
const MICRODISTRICTS = {
    "2":{lat:47.1190,lng:51.9020},"3":{lat:47.1160,lng:51.8980},"4":{lat:47.1145,lng:51.9060},
    "5":{lat:47.1180,lng:51.9150},"7":{lat:47.1060,lng:51.9350},"8":{lat:47.1030,lng:51.9390},
    "10":{lat:47.0985,lng:51.9280},"11":{lat:47.0960,lng:51.9220},"13":{lat:47.0930,lng:51.9170},
    "14":{lat:47.0900,lng:51.9100},"16":{lat:47.0870,lng:51.9050},"18":{lat:47.0840,lng:51.9000},
    "20":{lat:47.0820,lng:51.8950},"21":{lat:47.0800,lng:51.8900},"23":{lat:47.0780,lng:51.8850},
    "24":{lat:47.0950,lng:51.9320},"27":{lat:47.0750,lng:51.9250},"30":{lat:47.0730,lng:51.9200},
    "45":{lat:47.0850,lng:51.9380},"290":{lat:47.1010,lng:51.8920},
};

function isMicrodistrict(name) { return /^(№\s*)?\d+$/.test(name); }
function getMicrodistrictNum(name) { const m = name.match(/(\d+)/); return m ? m[1] : null; }
function jitter() { return (Math.random() - 0.5) * 0.002; }

// Parse
const lines = fs.readFileSync(RAW_FILE, "utf-8").split("\n").filter(l => l.trim());
const records = [];
for (const line of lines) {
    const parts = line.split("\t");
    const article = (parts[0] || "").trim();
    const street = (parts[1] || "").trim();
    const house = (parts[2] || "").trim();
    if (!article || !street) continue;
    records.push({ article, street, house });
}

console.log(`Parsed ${records.length} records`);

// Check coverage
let mapped = 0, unmapped = 0;
const unmappedStreets = new Set();
for (const r of records) {
    const key = r.street.toUpperCase();
    if (isMicrodistrict(r.street)) {
        mapped++;
    } else if (STREETS[key]) {
        mapped++;
    } else {
        unmapped++;
        unmappedStreets.add(r.street);
    }
}
console.log(`Mapped: ${mapped}, Unmapped: ${unmapped}`);
if (unmappedStreets.size > 0) {
    console.log("Unmapped streets:", [...unmappedStreets].join(", "));
}

// Generate points
const points = [];
let id = 5000;

for (const r of records) {
    let lat, lng;
    const key = r.street.toUpperCase();

    if (isMicrodistrict(r.street)) {
        const num = getMicrodistrictNum(r.street);
        const mc = MICRODISTRICTS[num];
        lat = (mc ? mc.lat : CENTER.lat) + jitter();
        lng = (mc ? mc.lng : CENTER.lng) + jitter();
    } else if (STREETS[key]) {
        lat = STREETS[key].lat + jitter();
        lng = STREETS[key].lng + jitter();
    } else {
        // Fallback with wider spread around center
        lat = CENTER.lat + (Math.random() - 0.5) * 0.012;
        lng = CENTER.lng + (Math.random() - 0.5) * 0.012;
    }

    const address = r.house ? r.street + " " + r.house : r.street;
    points.push({
        id: id++,
        lat: Math.round(lat * 10000) / 10000,
        lng: Math.round(lng * 10000) / 10000,
        category: "crime",
        title_ru: address, title_kz: address,
        address_ru: address, address_kz: address,
        description_ru: r.article + " — " + address,
        description_kz: r.article + " — " + address,
        photos: []
    });
}

const output = `/**\n * Auto-generated crime points data\n * ${points.length} crime records from prosecutor's office\n */\nvar CRIME_POINTS = ${JSON.stringify(points, null, 2)};\n`;
fs.writeFileSync(OUTPUT_FILE, output);
console.log(`\nWrote ${points.length} crime points to js/crime-points.js`);
