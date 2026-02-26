#!/usr/bin/env node
/**
 * Geocode crime-point streets using Nominatim (OpenStreetMap).
 *
 * Run this script on a machine with internet access:
 *   node tools/geocode-streets.js
 *
 * It will:
 *   1. Read unique street names from crime-raw.txt
 *   2. Query Nominatim for each street/microdistrict in Atyrau
 *   3. Cache results in tools/streets-coords.json (so re-runs are fast)
 *   4. Rewrite the STREETS & MICRODISTRICTS mappings in generate-crimes.js
 *   5. Run generate-crimes.js to produce js/crime-points.js
 *
 * Nominatim rate limit: 1 request/second (respected automatically).
 * No API key needed.
 */

const fs = require("fs");
const https = require("https");
const path = require("path");

const RAW_FILE    = path.join(__dirname, "crime-raw.txt");
const CACHE_FILE  = path.join(__dirname, "streets-coords.json");
const GEN_FILE    = path.join(__dirname, "generate-crimes.js");

// ─── helpers ─────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function httpsGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { "User-Agent": "AtyrauMapGeocoder/1.0" } }, res => {
            let data = "";
            res.on("data", chunk => data += chunk);
            res.on("end", () => {
                if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
                resolve(data);
            });
        }).on("error", reject);
    });
}

async function nominatimSearch(query) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=kz`;
    const raw = await httpsGet(url);
    const results = JSON.parse(raw);
    if (results.length > 0) {
        return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
    }
    return null;
}

// ─── parse unique street names ───────────────────────────
const lines = fs.readFileSync(RAW_FILE, "utf-8").split("\n").filter(l => l.trim());
const streetCounts = new Map();
for (const line of lines) {
    const parts = line.split("\t");
    const street = (parts[1] || "").trim();
    if (street) {
        const key = street.toUpperCase();
        streetCounts.set(key, (streetCounts.get(key) || 0) + 1);
    }
}

function isMicrodistrict(name) { return /^(№\s*)?\d+$/.test(name); }
function getMicroNum(name) { const m = name.match(/(\d+)/); return m ? m[1] : null; }

const namedStreets = [];
const microdistricts = [];
for (const name of streetCounts.keys()) {
    if (isMicrodistrict(name)) {
        microdistricts.push(getMicroNum(name));
    } else {
        namedStreets.push(name);
    }
}

console.log(`Found ${namedStreets.length} named streets and ${microdistricts.length} microdistricts to geocode.\n`);

// ─── load cache ──────────────────────────────────────────
let cache = {};
if (fs.existsSync(CACHE_FILE)) {
    try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8")); } catch(e) {}
    console.log(`Loaded ${Object.keys(cache).length} cached results from streets-coords.json`);
}

// ─── geocode ─────────────────────────────────────────────
async function geocodeAll() {
    let found = 0, notFound = 0, fromCache = 0;

    // 1. Named streets
    for (const street of namedStreets) {
        if (cache[street]) { fromCache++; continue; }

        // Try multiple query variants for better results
        const variants = [
            `${street}, Атырау, Казахстан`,
            `улица ${street}, Атырау`,
            `${street}, Atyrau, Kazakhstan`,
        ];

        let result = null;
        for (const q of variants) {
            try {
                result = await nominatimSearch(q);
            } catch (err) {
                console.error(`  Error querying "${q}": ${err.message}`);
            }
            await sleep(1100); // respect Nominatim rate limit
            if (result) break;
        }

        if (result) {
            // Verify result is roughly in Atyrau area (lat ~46.9-47.2, lng ~51.7-52.1)
            if (result.lat >= 46.9 && result.lat <= 47.3 && result.lng >= 51.7 && result.lng <= 52.2) {
                cache[street] = result;
                found++;
                console.log(`  ✓ ${street} → ${result.lat}, ${result.lng}`);
            } else {
                console.log(`  ✗ ${street} → result outside Atyrau (${result.lat}, ${result.lng}), skipped`);
                notFound++;
            }
        } else {
            console.log(`  ✗ ${street} → not found`);
            notFound++;
        }
    }

    // 2. Microdistricts
    for (const num of microdistricts) {
        const key = `MICRO_${num}`;
        if (cache[key]) { fromCache++; continue; }

        const variants = [
            `${num} микрорайон, Атырау, Казахстан`,
            `микрорайон ${num}, Атырау`,
            `${num} microdistrict, Atyrau, Kazakhstan`,
        ];

        let result = null;
        for (const q of variants) {
            try {
                result = await nominatimSearch(q);
            } catch (err) {
                console.error(`  Error querying "${q}": ${err.message}`);
            }
            await sleep(1100);
            if (result) break;
        }

        if (result && result.lat >= 46.9 && result.lat <= 47.3 && result.lng >= 51.7 && result.lng <= 52.2) {
            cache[key] = result;
            found++;
            console.log(`  ✓ Микрорайон ${num} → ${result.lat}, ${result.lng}`);
        } else {
            console.log(`  ✗ Микрорайон ${num} → not found`);
            notFound++;
        }
    }

    // Save cache
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    console.log(`\nResults: ${found} newly geocoded, ${fromCache} from cache, ${notFound} not found.`);
    console.log(`Cache saved to ${CACHE_FILE}`);

    return cache;
}

// ─── update generate-crimes.js ───────────────────────────
function updateGenerator(coords) {
    let code = fs.readFileSync(GEN_FILE, "utf-8");

    // Build new STREETS object
    const streetEntries = [];
    for (const street of namedStreets) {
        const c = coords[street];
        if (c) {
            const padded = `"${street}"`;
            streetEntries.push(`    ${padded.padEnd(44)}: { lat: ${c.lat.toFixed(6)}, lng: ${c.lng.toFixed(6)} }`);
        }
    }

    // Also keep any aliases (streets that differ only in casing/spacing)
    // by replicating coords for known aliases
    const aliases = [
        ["АБАЙ", "АБАЙ ҚҰНАНБАЕВ"],
        ["АЗАТТЫҚ", "АЗАТТЫК"],
        ["АВАНГАРД-2", "АВАНГАРД -2"],
        ["АТЫРАУ-ДОССОР", "АТЫРАУ ДОССОР"],
        ["ӨРКЕН", "ОРКЕН"],
        ["БЕЙБАРЫС", "С.БЕЙБАРЫС"],
        ["АЛМАГҮЛ", "АЛМАГҮЛ МӨЛТЕК АУДАНЫ"],
        ["ІБАТОЛЛА ШЕКЕНОВ", "ИБАТОЛЛА ШЕКЕНОВ"],
    ];
    for (const [main, alias] of aliases) {
        if (coords[main] && !coords[alias]) {
            const c = coords[main];
            const padded = `"${alias}"`;
            streetEntries.push(`    ${padded.padEnd(44)}: { lat: ${c.lat.toFixed(6)}, lng: ${c.lng.toFixed(6)} }`);
        }
    }

    const newStreets = `const STREETS = {\n${streetEntries.join(",\n")}\n};`;

    // Build new MICRODISTRICTS object
    const microEntries = [];
    for (const num of [...new Set(microdistricts)].sort((a,b) => parseInt(a) - parseInt(b))) {
        const c = coords[`MICRO_${num}`];
        if (c) {
            microEntries.push(`    "${num}": { lat: ${c.lat.toFixed(6)}, lng: ${c.lng.toFixed(6)} }`);
        }
    }
    const newMicro = `const MICRODISTRICTS = {\n${microEntries.join(",\n")}\n};`;

    // Replace STREETS block in code
    code = code.replace(/const STREETS = \{[\s\S]*?\};/, newStreets);
    // Replace MICRODISTRICTS block in code
    code = code.replace(/const MICRODISTRICTS = \{[\s\S]*?\};/, newMicro);

    fs.writeFileSync(GEN_FILE, code);
    console.log(`\nUpdated ${GEN_FILE} with geocoded coordinates.`);
}

// ─── main ────────────────────────────────────────────────
(async () => {
    try {
        const coords = await geocodeAll();
        updateGenerator(coords);

        // Run generate-crimes.js
        console.log("\nRegenerating crime points...");
        const { execSync } = require("child_process");
        execSync(`node "${GEN_FILE}"`, { stdio: "inherit" });

        console.log("\n✓ Done! Crime points have been updated with accurate coordinates.");
        console.log("  Check js/crime-points.js for the result.");
    } catch (err) {
        console.error("Error:", err.message);
        process.exit(1);
    }
})();
