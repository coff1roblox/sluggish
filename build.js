// Builds index.html from src/template.html + src/data/*.js and validates the question bank.
// Usage: node build.js
const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "src", "data");
const files = fs.readdirSync(dataDir).filter(f => f.endsWith(".js")).sort();
let cats = [];
for (const f of files) cats = cats.concat(require(path.join(dataDir, f)));

const errors = [];
const ids = new Set();
const seenText = new Map();
let total = 0;

for (const c of cats) {
  for (const k of ["id", "name", "icon", "group"]) if (!c[k]) errors.push(`category ${c.id || "?"}: missing ${k}`);
  if (ids.has(c.id)) errors.push(`duplicate category id: ${c.id}`);
  ids.add(c.id);
  const count = { 1: 0, 2: 0, 3: 0 };
  (c.q || []).forEach((row, i) => {
    const [d, text, answer] = row;
    if (![1, 2, 3].includes(d)) errors.push(`${c.id}[${i}]: bad difficulty ${d}`);
    if (!text || !answer) errors.push(`${c.id}[${i}]: empty question or answer`);
    count[d]++;
    total++;
    const key = String(text).trim();
    if (seenText.has(key)) errors.push(`duplicate question in ${c.id} and ${seenText.get(key)}: ${key}`);
    seenText.set(key, c.id);
  });
  // A board needs 2 questions per level; a 3rd lets the swap lifeline work.
  for (const d of [1, 2, 3]) if (count[d] < 3) errors.push(`${c.id}: only ${count[d]} questions at level ${d} (need 3+)`);
}

if (errors.length) {
  console.error("Question bank has problems:\n" + errors.join("\n"));
  process.exit(1);
}

const tpl = fs.readFileSync(path.join(__dirname, "src", "template.html"), "utf8");
const marker = "/*__DATA__*/[]";
if (!tpl.includes(marker)) throw new Error("template is missing the data marker");
const json = JSON.stringify(cats).replace(/</g, "\\u003c");
fs.writeFileSync(path.join(__dirname, "index.html"), tpl.replace(marker, json));
console.log(`Built index.html: ${cats.length} categories, ${total} questions`);
