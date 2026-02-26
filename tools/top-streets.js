const fs = require("fs");
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
const sorted = [...streetCounts.entries()].sort((a,b) => b[1] - a[1]);
sorted.forEach(([name, count]) => console.log(count + "\t" + name));
