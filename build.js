// Builds index.html from src/template.html + src/data/*.js + src/photos.json, and validates the question bank.
// Usage:
//   node build.js          build index.html
//   node build.js --keys   print every photo key as JSON (pipe into tools/fetch_photos.py)
//   node build.js --bundle also write dist/: the page plus one photo bundle per category
//                          (for hosts that limit the number of files, like Claude artifacts)
const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "src", "data");
const files = fs.readdirSync(dataDir).filter(f => f.endsWith(".js")).sort();
let cats = [];
for (const f of files) cats = cats.concat(require(path.join(dataDir, f)));

if (process.argv.includes("--keys")) {
  const keys = new Set();
  for (const c of cats) for (const row of c.q) for (const k of [row[3], row[4]]) if (k) keys.add(k);
  process.stdout.write(JSON.stringify([...keys]));
  process.exit(0);
}

const errors = [];
const ids = new Set();
const seen = new Map();
let total = 0;

for (const c of cats) {
  for (const k of ["id", "name", "icon", "group"]) if (!c[k]) errors.push(`category ${c.id || "?"}: missing ${k}`);
  if (ids.has(c.id)) errors.push(`duplicate category id: ${c.id}`);
  ids.add(c.id);
  const count = { 1: 0, 2: 0, 3: 0 };
  (c.q || []).forEach((row, i) => {
    const [d, text, answer, photo, answerPhoto] = row;
    if (![1, 2, 3].includes(d)) errors.push(`${c.id}[${i}]: bad level ${d}`);
    if (!text || !answer) errors.push(`${c.id}[${i}]: empty question or answer`);
    if (!photo) errors.push(`${c.id}[${i}]: missing question photo`);
    if (answerPhoto !== undefined && typeof answerPhoto !== "string") errors.push(`${c.id}[${i}]: answer photo must be a string`);
    count[d]++;
    total++;
    // Picture rounds reuse the same wording, so a question is its text plus its photo.
    const key = String(text).trim() + "|" + (photo || "");
    if (seen.has(key)) errors.push(`duplicate question in ${c.id} and ${seen.get(key)}: ${text}`);
    seen.set(key, c.id);
  });
  // A board needs 2 questions per level; a 3rd lets the swap helper work.
  for (const d of [1, 2, 3]) if (count[d] < 3) errors.push(`${c.id}: only ${count[d]} questions at level ${d} (need 3+)`);
}

if (errors.length) {
  console.error("Question bank has problems:\n" + errors.join("\n"));
  process.exit(1);
}

// Attach photos. Each question becomes [level, text, answer, questionPhotoIndex, answerPhotoIndex] (-1 = none).
const photoIndex = fs.existsSync(path.join(__dirname, "src", "photos.json"))
  ? JSON.parse(fs.readFileSync(path.join(__dirname, "src", "photos.json"), "utf8")) : {};
const photos = [], photoPos = new Map();
let withPhoto = 0;
const missing = [];
const outCats = cats.map(c => ({
  id: c.id, name: c.name, icon: c.icon, group: c.group,
  q: c.q.map(([d, t, a, key, akey]) => {
    const attach = k => {
      const info = k && photoIndex[k];
      if (!info || !fs.existsSync(path.join(__dirname, info.f))) return -1;
      if (!photoPos.has(info.f)) {
        // Some Commons files put links in the author field; show a plain name instead.
        const by = /https?:|www\./i.test(info.by) || !info.by.trim() ? "Wikimedia Commons" : info.by;
        photoPos.set(info.f, photos.length); photos.push([info.f, by, info.lic, info.src]);
      }
      return photoPos.get(info.f);
    };
    const p = attach(key), ap = akey ? attach(akey) : -1;
    if (p >= 0) withPhoto++; else missing.push(`${c.id}: ${key || "(no key)"}`);
    if (akey && ap < 0) missing.push(`${c.id}: answer ${akey}`);
    return [d, t, a, p, ap];
  })
}));

const tpl = fs.readFileSync(path.join(__dirname, "src", "template.html"), "utf8");
const marker = "/*__DATA__*/[]";
if (!tpl.includes(marker)) throw new Error("template is missing the data marker");
const json = JSON.stringify({ cats: outCats, photos }).replace(/</g, "\\u003c");
fs.writeFileSync(path.join(__dirname, "index.html"), tpl.replace(marker, json));

if (process.argv.includes("--bundle")) {
  const dist = path.join(__dirname, "dist");
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(path.join(dist, "photos"), { recursive: true });
  const bjson = JSON.stringify({ cats: outCats, photos, bundle: true }).replace(/</g, "\\u003c");
  fs.writeFileSync(path.join(dist, "index.html"), tpl.replace(marker, bjson));
  for (const c of outCats) {
    const map = {};
    for (const q of c.q) for (const pi of [q[3], q[4]]) if (pi >= 0) {
      const f = photos[pi][0];
      map[f] = "data:image/webp;base64," + fs.readFileSync(path.join(__dirname, f)).toString("base64");
    }
    fs.writeFileSync(path.join(dist, "photos", c.id + ".js"),
      `window.__PH=window.__PH||{};window.__PH[${JSON.stringify(c.id)}]=${JSON.stringify(map)};`);
  }
  console.log(`Built dist/: index.html + ${outCats.length} photo bundles`);
}
console.log(`Built index.html: ${cats.length} categories, ${total} questions, ${withPhoto} with photos (${photos.length} unique)`);
if (missing.length) console.log(`No photo for ${missing.length}:\n  ` + missing.join("\n  "));
