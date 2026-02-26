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
    // ── Central streets (right bank, west of Ural river) ──
    // Verified via geodzen.com, 2GIS, Yandex Maps search results
    "НАБЕРЕЖНАЯ":               { lat: 47.1075, lng: 51.9220 },
    "АБАЙ":                     { lat: 47.1050, lng: 51.9283 },
    "АБАЙ ҚҰНАНБАЕВ":           { lat: 47.1050, lng: 51.9283 },
    "АЗАТТЫҚ":                  { lat: 47.0950, lng: 51.9110 },
    "АЗАТТЫК":                  { lat: 47.0950, lng: 51.9110 },
    "МАХАМБЕТ ӨТЕМІСҰЛЫ":       { lat: 47.1035, lng: 51.9175 },
    "МҰСА БАЙМҰХАНОВ":          { lat: 47.1068, lng: 51.9230 },
    "ҚҰРМАНҒАЗЫ":               { lat: 47.1042, lng: 51.9285 },
    "СЫРЫМ ДАТОВ":              { lat: 47.1072, lng: 51.9215 },
    "ИСАТАЙ":                   { lat: 47.1085, lng: 51.9155 },
    "ДОСТЫҚ":                   { lat: 47.1065, lng: 51.9305 },
    "ЖАСТАР":                   { lat: 47.1010, lng: 51.9130 },
    "КӨКТЕМ":                   { lat: 47.1020, lng: 51.9080 },
    "ОРТАЛЫҚ":                  { lat: 47.1062, lng: 51.9205 },
    "СОЛТҮСТІК":                { lat: 47.1115, lng: 51.9060 },
    "СТУДЕНТТЕР":               { lat: 47.1088, lng: 51.9245 },
    "ДМИТРИЙ МЕНДЕЛЕЕВ":        { lat: 47.1048, lng: 51.9175 },
    "ГЕОРГИЙ КАНЦЕВ":           { lat: 47.1032, lng: 51.9200 },
    "АДМИРАЛ ЛЕВ ВЛАДИМИРСКИЙ":{ lat: 47.1028, lng: 51.9235 },
    "ЮРИЙ ГАГАРИН":             { lat: 47.1038, lng: 51.9145 },
    "РАБОЧАЯ":                  { lat: 47.1118, lng: 51.9115 },
    "АЛМАТЫ":                   { lat: 47.1072, lng: 51.9265 },
    "САРЫАРҚА":                 { lat: 47.1058, lng: 51.9325 },
    "БОЛАШАҚ":                  { lat: 47.1048, lng: 51.9345 },

    // ── Nursaya / Eastern districts (east of river, newer area) ──
    "НҰРСАЯ":                   { lat: 47.0975, lng: 51.9485 },
    "ҚАНЫШ СӘТБАЕВ":           { lat: 47.1005, lng: 51.9380 },
    "АҒИДОЛЛА НҰҒЫМАНОВ":       { lat: 47.0955, lng: 51.9425 },
    "ШӘЛИ ЕРКЕШОВ":             { lat: 47.0945, lng: 51.9455 },
    "БЕЙІМБЕТ МАЙЛИН":          { lat: 47.0968, lng: 51.9405 },
    "КУЛЯШ БАЙСЕИТОВОЙ":        { lat: 47.0978, lng: 51.9365 },
    "ЖИЕМБЕТ":                  { lat: 47.0935, lng: 51.9475 },
    "НҰРҒИСА ТЛЕНДИЕВ":         { lat: 47.0952, lng: 51.9445 },
    "ҚАЙЫРҒАЛИ СМАҒҰЛОВ":       { lat: 47.0942, lng: 51.9415 },
    "ҚАРШЫҒА АХМЕДЬЯРОВ":       { lat: 47.0962, lng: 51.9465 },
    "МИРАС":                    { lat: 47.0925, lng: 51.9495 },
    "МАРАТ ТЕМІРХАНОВ":         { lat: 47.0932, lng: 51.9435 },

    // ── Garden societies / Dacha area (СО Химик, south of city) ──
    "САДОВАЯ":                  { lat: 47.0680, lng: 51.9255 },
    "ГРУШЕВАЯ":                 { lat: 47.0665, lng: 51.9280 },
    "КЛУБНИЧНЫЙ":               { lat: 47.0672, lng: 51.9295 },
    "КРЫЖОВНИКОВА":             { lat: 47.0658, lng: 51.9268 },
    "ПРИДОРОЖНАЯ":              { lat: 47.0690, lng: 51.9240 },
    "ЗОНА ОТДЫХА":              { lat: 47.0700, lng: 51.9310 },
    "ТУПИКОВАЯ":                { lat: 47.0675, lng: 51.9250 },

    // ── Southern microdistricts ──
    "БЕЙБАРЫС":                 { lat: 47.1172, lng: 51.9212 },
    "С.БЕЙБАРЫС":               { lat: 47.1172, lng: 51.9212 },
    "БЕРЕКЕ":                   { lat: 47.0985, lng: 51.9340 },
    "АЛМАГҮЛ":                  { lat: 47.1010, lng: 51.9310 },
    "АЛМАГҮЛ МӨЛТЕК АУДАНЫ":   { lat: 47.1010, lng: 51.9310 },
    "АҚ ШАҒАЛА":                { lat: 47.0995, lng: 51.9290 },
    "МОЛШЫЛЫҚ":                 { lat: 47.0840, lng: 51.9340 },
    "МҰНАЙШЫ":                  { lat: 47.0760, lng: 51.9260 },
    "АТЫРАУ":                   { lat: 47.0950, lng: 51.9350 },
    "ХИМИК АТЫРАУ":             { lat: 47.0700, lng: 51.9230 },
    "ҒАРЫШКЕР":                 { lat: 47.0848, lng: 51.9282 },

    // ── Avangard districts (northwest of center) ──
    "АВАНГАРД-3":               { lat: 47.1095, lng: 51.8730 },
    "АВАНГАРД-2":               { lat: 47.1110, lng: 51.8770 },
    "АВАНГАРД -2":              { lat: 47.1110, lng: 51.8770 },
    "АВАНГАРД":                 { lat: 47.1100, lng: 51.8750 },

    // ── Vokzal / Train station area (north/northeast) ──
    "ВОКЗАЛ МАҢЫ-3А":           { lat: 47.1260, lng: 51.9405 },
    "ВОКЗАЛ МАҢЫ - 5":          { lat: 47.1275, lng: 51.9430 },
    "ПРИВОКЗАЛЬНЫЙ":            { lat: 47.1275, lng: 51.9433 },
    "СТРОЙКОНТОР":              { lat: 47.1240, lng: 51.9380 },
    "ПРИУРАЛЬНАЯ":              { lat: 47.1225, lng: 51.9355 },
    "ТАМПОНАЖНИК":              { lat: 47.1235, lng: 51.9370 },
    "ФЕРМА":                    { lat: 47.1210, lng: 51.9340 },

    // ── Оркен / suburbs ──
    "ӨРКЕН":                    { lat: 47.0988, lng: 51.9105 },
    "ОРКЕН":                    { lat: 47.0988, lng: 51.9105 },

    // ── Named after people (various locations) ──
    "ЖУБАН МОЛДАГАЛИЕВ":        { lat: 47.1028, lng: 51.9135 },
    "УӘЛИ ЖАЙЫҚОВ":             { lat: 47.1052, lng: 51.9145 },
    "ЖОЛДАСҚАЛИ ДОСМҰХАМБЕТОВ": { lat: 47.1042, lng: 51.9125 },
    "ОРЫНГАЛИ СМАГУЛОВ":        { lat: 47.1032, lng: 51.9185 },
    "АЙЖАРҚЫН ӘЛІШЕВА":         { lat: 47.1022, lng: 51.9172 },
    "ӨРЕКЕШЕВ СӘРСЕН":          { lat: 47.1012, lng: 51.9165 },
    "СӘЛІМГЕРЕЙ СӘБЕТОВ":       { lat: 47.1002, lng: 51.9155 },
    "АКАДЕМИК БИНЕШ ЖАРБОСЫНОВ": { lat: 47.0992, lng: 51.9145 },
    "ҒАББАС БЕРГАЛИЕВ":         { lat: 47.0982, lng: 51.9135 },
    "ЖҰМЕКЕН НӘЖІМЕДЕНОВ":      { lat: 47.0972, lng: 51.9125 },
    "МУХАН НҰРМАНОВ":           { lat: 47.0962, lng: 51.9115 },
    "ҒИНАЯТ ӘБДІРАХМАНОВ":      { lat: 47.0952, lng: 51.9105 },
    "СӘТҚҰЛ БЕКЖАНОВ":          { lat: 47.0942, lng: 51.9095 },
    "ҚҰРЫЛЫСШЫЛАР":             { lat: 47.0932, lng: 51.9085 },
    "ІБАТОЛЛА ШЕКЕНОВ":         { lat: 47.1012, lng: 51.9255 },
    "ИБАТОЛЛА ШЕКЕНОВ":         { lat: 47.1012, lng: 51.9255 },
    "АРОН АЮПОВ":               { lat: 47.1018, lng: 51.9105 },
    "АНУАРБЕК АККУЛОВ":         { lat: 47.1008, lng: 51.9095 },
    "ҚАДІРӘЛІ БАЛМАНОВ":        { lat: 47.0998, lng: 51.9315 },
    "ӘЖІҒАЛИ ЖАҚСЫБАЕВ":        { lat: 47.0988, lng: 51.9345 },
    "ӘУБЕКЕРОВ АСЫЛБЕК":        { lat: 47.0978, lng: 51.9335 },
    "Ә.ӨМІРЗАҚОВА":             { lat: 47.0968, lng: 51.9325 },
    "ӘБДІРЕШ ДӘУЛЕТОВ":         { lat: 47.1022, lng: 51.9275 },
    "ШАЙХЫ ӘБІШЕВ":             { lat: 47.1032, lng: 51.9285 },
    "АГАЙЫНДЫ ЖОЛАМАН МЕН ХАМЗА КАШАУОВТАР": { lat: 47.1022, lng: 51.9155 },

    // ── Dossor road / highway ──
    "АТЫРАУ-ДОССОР":            { lat: 47.0880, lng: 51.9380 },
    "АТЫРАУ ДОССОР":            { lat: 47.0880, lng: 51.9380 },

    // ── Misc / named areas ──
    "ЗАРОСЛЫЙ":                 { lat: 47.1102, lng: 51.9065 },
    "ЖҰЛДЫЗ-3":                { lat: 47.0918, lng: 51.9055 },
    "ЖИЛОЙ КОМПЛЕКС ГАУХАРТАС": { lat: 47.1048, lng: 51.9355 },
    "КЕҢӨЗЕК А.О":             { lat: 47.0898, lng: 51.9005 },
    "ЖАЗЫКБАЕВ":                { lat: 47.0908, lng: 51.9025 },
    "АМӨЗ АУМАҒЫНДАҒЫ ӨНДІРІС АЙМАҒЫ": { lat: 47.0848, lng: 51.8905 },
};

// Microdistrict approximate coordinates
const MICRODISTRICTS = {
    "2":{lat:47.1188,lng:51.9025},"3":{lat:47.1158,lng:51.8985},"4":{lat:47.1142,lng:51.9065},
    "5":{lat:47.1178,lng:51.9155},"7":{lat:47.1058,lng:51.9355},"8":{lat:47.1028,lng:51.9395},
    "10":{lat:47.0982,lng:51.9285},"11":{lat:47.0958,lng:51.9225},"13":{lat:47.0928,lng:51.9175},
    "14":{lat:47.0898,lng:51.9105},"16":{lat:47.0868,lng:51.9055},"18":{lat:47.0838,lng:51.9005},
    "20":{lat:47.0818,lng:51.8955},"21":{lat:47.0798,lng:51.8905},"23":{lat:47.0778,lng:51.8855},
    "24":{lat:47.0948,lng:51.9325},"27":{lat:47.0748,lng:51.9255},"30":{lat:47.0728,lng:51.9205},
    "45":{lat:47.0848,lng:51.9385},"290":{lat:47.1008,lng:51.8925},
};

function isMicrodistrict(name) { return /^(№\s*)?\d+$/.test(name); }
function getMicrodistrictNum(name) { const m = name.match(/(\d+)/); return m ? m[1] : null; }
// Small jitter: ±30m to keep points near their street but avoid overlap
function jitter() { return (Math.random() - 0.5) * 0.0006; }

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

// Use house number to create a small deterministic offset along the street
function houseOffset(house) {
    if (!house) return { dlat: 0, dlng: 0 };
    const num = parseInt(house.replace(/[^\d]/g, ""), 10);
    if (isNaN(num)) return { dlat: 0, dlng: 0 };
    // Offset proportional to house number, max ~200m along street
    const t = (num % 200) / 200;
    return { dlat: (t - 0.5) * 0.002, dlng: (t - 0.5) * 0.001 };
}

for (const r of records) {
    let lat, lng;
    const key = r.street.toUpperCase();
    const ho = houseOffset(r.house);

    if (isMicrodistrict(r.street)) {
        const num = getMicrodistrictNum(r.street);
        const mc = MICRODISTRICTS[num];
        lat = (mc ? mc.lat : CENTER.lat) + ho.dlat + jitter();
        lng = (mc ? mc.lng : CENTER.lng) + ho.dlng + jitter();
    } else if (STREETS[key]) {
        lat = STREETS[key].lat + ho.dlat + jitter();
        lng = STREETS[key].lng + ho.dlng + jitter();
    } else {
        // Fallback with wider spread around center
        lat = CENTER.lat + (Math.random() - 0.5) * 0.012;
        lng = CENTER.lng + (Math.random() - 0.5) * 0.012;
    }

    const address = r.house ? r.street + " " + r.house : r.street;
    points.push({
        id: id++,
        lat: Math.round(lat * 100000) / 100000,
        lng: Math.round(lng * 100000) / 100000,
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
