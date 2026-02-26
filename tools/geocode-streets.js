#!/usr/bin/env node
/**
 * Geocode crime-point streets using 2GIS Geocoder API.
 *
 * Run this script on a machine with internet access:
 *   node tools/geocode-streets.js YOUR_2GIS_API_KEY
 *
 * How to get a free API key:
 *   1. Register at https://platform.2gis.ru/
 *   2. Create a demo key in the API Keys section
 *
 * The script will:
 *   1. Read unique street names from crime-raw.txt
 *   2. Query 2GIS Geocoder for each street/microdistrict in Atyrau
 *   3. Fall back to Nominatim (OpenStreetMap) if 2GIS can't find a street
 *   4. Cache results in tools/streets-coords.json (so re-runs are fast)
 *   5. Rewrite the STREETS & MICRODISTRICTS mappings in generate-crimes.js
 *   6. Run generate-crimes.js to produce js/crime-points.js
 */

const fs = require("fs");
const https = require("https");
const path = require("path");

const RAW_FILE    = path.join(__dirname, "crime-raw.txt");
const CACHE_FILE  = path.join(__dirname, "streets-coords.json");
const GEN_FILE    = path.join(__dirname, "generate-crimes.js");

// ─── API key ─────────────────────────────────────────────
const API_KEY = process.argv[2];
if (!API_KEY) {
    console.error("Usage: node geocode-streets.js YOUR_2GIS_API_KEY");
    console.error("");
    console.error("Get a free key at https://platform.2gis.ru/");
    process.exit(1);
}

// ─── helpers ─────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function httpsGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { "User-Agent": "AtyrauMapGeocoder/1.0" } }, res => {
            let data = "";
            res.on("data", chunk => data += chunk);
            res.on("end", () => {
                if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 300)}`));
                resolve(data);
            });
        }).on("error", reject);
    });
}

// 2GIS Geocoder API
async function dgisSearch(query) {
    const url = `https://catalog.api.2gis.com/3.0/items/geocode?q=${encodeURIComponent(query)}&fields=items.point&key=${API_KEY}`;
    const raw = await httpsGet(url);
    const data = JSON.parse(raw);
    if (data.result && data.result.items && data.result.items.length > 0) {
        const item = data.result.items[0];
        if (item.point) {
            return { lat: item.point.lat, lng: item.point.lon };
        }
    }
    return null;
}

// Nominatim fallback (1 req/sec rate limit)
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

// ─── Atyrau bounding box check ───────────────────────────
function isInAtyrau(coord) {
    return coord.lat >= 46.9 && coord.lat <= 47.3 &&
           coord.lng >= 51.7 && coord.lng <= 52.2;
}

// ─── geocode ─────────────────────────────────────────────
async function geocodeAll() {
    let found = 0, notFound = 0, fromCache = 0;

    // 1. Named streets
    for (const street of namedStreets) {
        if (cache[street]) { fromCache++; continue; }

        let result = null;

        // Try 2GIS first (primary)
        const dgisVariants = [
            `Атырау, ${street}`,
            `${street}, Атырау`,
            `Атырау, улица ${street}`,
        ];
        for (const q of dgisVariants) {
            try {
                result = await dgisSearch(q);
                if (result && isInAtyrau(result)) break;
                result = null;
            } catch (err) {
                console.error(`  2GIS error for "${q}": ${err.message}`);
            }
            await sleep(200);
        }

        // Fallback to Nominatim if 2GIS didn't find it
        if (!result) {
            const nomVariants = [
                `${street}, Атырау, Казахстан`,
                `улица ${street}, Атырау`,
                `${street}, Atyrau, Kazakhstan`,
            ];
            for (const q of nomVariants) {
                try {
                    result = await nominatimSearch(q);
                    if (result && isInAtyrau(result)) break;
                    result = null;
                } catch (err) {
                    console.error(`  Nominatim error for "${q}": ${err.message}`);
                }
                await sleep(1100); // Nominatim rate limit
            }
        }

        if (result && isInAtyrau(result)) {
            cache[street] = result;
            found++;
            console.log(`  ✓ ${street} → ${result.lat.toFixed(6)}, ${result.lng.toFixed(6)}`);
        } else {
            console.log(`  ✗ ${street} → not found`);
            notFound++;
        }
    }

    // 2. Microdistricts
    for (const num of microdistricts) {
        const key = `MICRO_${num}`;
        if (cache[key]) { fromCache++; continue; }

        let result = null;

        // 2GIS first
        const dgisVariants = [
            `Атырау, ${num} микрорайон`,
            `${num} микрорайон, Атырау`,
        ];
        for (const q of dgisVariants) {
            try {
                result = await dgisSearch(q);
                if (result && isInAtyrau(result)) break;
                result = null;
            } catch (err) {
                console.error(`  2GIS error: ${err.message}`);
            }
            await sleep(200);
        }

        // Nominatim fallback
        if (!result) {
            const nomVariants = [
                `${num} микрорайон, Атырау, Казахстан`,
                `микрорайон ${num}, Атырау`,
            ];
            for (const q of nomVariants) {
                try {
                    result = await nominatimSearch(q);
                    if (result && isInAtyrau(result)) break;
                    result = null;
                } catch (err) {}
                await sleep(1100);
            }
        }

        if (result && isInAtyrau(result)) {
            cache[key] = result;
            found++;
            console.log(`  ✓ Микрорайон ${num} → ${result.lat.toFixed(6)}, ${result.lng.toFixed(6)}`);
        } else {
            console.log(`  ✗ Микрорайон ${num} → not found`);
            notFound++;
        }
    }

    // Save cache
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    console.log(`\nResults: ${found} geocoded, ${fromCache} from cache, ${notFound} not found.`);
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

    // Replicate coords for known aliases
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
        // Quick test of the API key
        console.log("Testing 2GIS API key...");
        try {
            const test = await dgisSearch("Атырау");
            if (test) {
                console.log("✓ API key works!\n");
            } else {
                console.log("⚠ API key may be invalid — no results for test query. Continuing anyway...\n");
            }
        } catch (err) {
            console.error("✗ API key test failed:", err.message);
            console.error("Check your key at https://platform.2gis.ru/");
            process.exit(1);
        }

        const coords = await geocodeAll();
        updateGenerator(coords);

        // Run generate-crimes.js
        console.log("\nRegenerating crime points...");
        const { execSync } = require("child_process");
        execSync(`node "${GEN_FILE}"`, { stdio: "inherit" });

        console.log("\n✓ Done! Crime points have been updated with accurate 2GIS coordinates.");
        console.log("  Check js/crime-points.js for the result.");
        console.log("  Commit and push the changes when satisfied.");
    } catch (err) {
        console.error("Error:", err.message);
        process.exit(1);
    }
})();
