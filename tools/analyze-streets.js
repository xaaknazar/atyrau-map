const fs = require("fs");

// Load STREETS mapping from generate-crimes.js
const genCode = fs.readFileSync(__dirname + "/generate-crimes.js", "utf-8");
const streetsMatch = genCode.match(/const STREETS = \{([\s\S]*?)\};/);
const microMatch = genCode.match(/const MICRODISTRICTS = \{([\s\S]*?)\};/);

// Extract street names from the STREETS object
const knownStreets = new Set();
const streetLines = streetsMatch[1].split("\n");
for (const line of streetLines) {
    const m = line.match(/"([^"]+)"/);
    if (m) knownStreets.add(m[1]);
}

// Parse crime data
const lines = fs.readFileSync(__dirname + "/crime-raw.txt", "utf-8").split("\n").filter(l => l.trim());
const streetCounts = new Map();
for (const line of lines) {
    const parts = line.split("\t");
    const street = (parts[1] || "").trim();
    if (street) {
        const key = street.toUpperCase();
        streetCounts.set(key, (streetCounts.get(key) || 0) + 1);
    }
}

// Check which are mapped vs unmapped
let mapped = 0, unmapped = 0;
const unmappedList = [];
const mappedList = [];

for (const [street, count] of streetCounts.entries()) {
    const isMicro = /^(№\s*)?\d+$/.test(street);
    if (isMicro || knownStreets.has(street)) {
        mapped += count;
        mappedList.push({ street, count });
    } else {
        unmapped += count;
        unmappedList.push({ street, count });
    }
}

console.log("Total records:", lines.length);
console.log("Unique streets:", streetCounts.size);
console.log("Mapped records:", mapped, "(" + Math.round(mapped/lines.length*100) + "%)");
console.log("Unmapped records:", unmapped, "(" + Math.round(unmapped/lines.length*100) + "%)");
console.log("\n=== UNMAPPED STREETS ===");
unmappedList.sort((a, b) => b.count - a.count);
for (const { street, count } of unmappedList) {
    console.log(count + "\t" + street);
}
