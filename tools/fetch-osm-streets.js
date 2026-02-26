/**
 * Fetch all street coordinates from OpenStreetMap Overpass API for Atyrau city.
 */
const https = require("https");
const fs = require("fs");

const query = `[out:json][timeout:30];
area[name="Атырау"][admin_level=6]->.a;
way["highway"]["name"](area.a);
out tags center 500;`;

const url = "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(query);

console.log("Fetching streets from Overpass API...");

https.get(url, { headers: { "User-Agent": "AtyrauCrimeMap/1.0" } }, (res) => {
    let data = "";
    res.on("data", (chunk) => data += chunk);
    res.on("end", () => {
        try {
            const parsed = JSON.parse(data);
            const streets = {};

            parsed.elements.forEach((el) => {
                if (el.tags && el.tags.name && el.center) {
                    const name = el.tags.name.toUpperCase();
                    if (!streets[name]) {
                        streets[name] = {
                            lat: el.center.lat,
                            lon: el.center.lon,
                            original: el.tags.name,
                            nameRu: el.tags["name:ru"] || null
                        };
                    }
                }
            });

            console.log("Found " + Object.keys(streets).length + " unique streets");

            // Print all streets
            const sorted = Object.entries(streets).sort((a, b) => a[0].localeCompare(b[0]));
            sorted.forEach(([key, val]) => {
                console.log(val.lat.toFixed(4) + ", " + val.lon.toFixed(4) + " | " + key + " (" + val.original + ")");
            });

            // Save to JSON
            fs.writeFileSync(__dirname + "/osm-streets.json", JSON.stringify(streets, null, 2));
            console.log("\nSaved to tools/osm-streets.json");
        } catch (e) {
            console.error("Parse error:", e.message);
            console.error("Response:", data.substring(0, 500));
        }
    });
}).on("error", (e) => {
    console.error("Request error:", e.message);
});
