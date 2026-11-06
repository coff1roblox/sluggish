#!/usr/bin/env python3
"""Download a free-licensed photo for every question's photo key.

Keys come from `node build.js --keys`. Each key is one of:
  "Some Article"      -> lead image of that English Wikipedia article (free licenses only)
  "File:Name.jpg"     -> that file on Wikimedia Commons
  "search:some words" -> first matching photo in a Wikimedia Commons search

Writes photos/<id>.webp and src/photos.json (key -> file, author, license, source page).
Already-downloaded keys are skipped, so it is safe to re-run after editing keys.
Usage: node build.js --keys | python3 tools/fetch_photos.py
"""
import hashlib, html, io, json, os, re, sys, time, urllib.parse, urllib.request
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "photos")
INDEX = os.path.join(ROOT, "src", "photos.json")
UA = "JawbniTriviaBuilder/1.0 (https://github.com/coff1roblox/sluggish; personal trivia game, credits shown in game)"
ENWIKI = "https://en.wikipedia.org/w/api.php"
COMMONS = "https://commons.wikimedia.org/w/api.php"
NONFREE = re.compile(r"fair use|non-free|copyrighted", re.I)


def get(url, params=None, binary=False, tries=6):
    if params:
        url += "?" + urllib.parse.urlencode(params)
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=40) as r:
                data = r.read()
            return data if binary else json.loads(data)
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and attempt < tries - 1:
                wait = e.headers.get("Retry-After")
                time.sleep(int(wait) if wait and wait.isdigit() else 5 * 2 ** attempt)
                continue
            raise
        except (urllib.error.URLError, TimeoutError):
            if attempt < tries - 1:
                time.sleep(2 ** attempt)
                continue
            raise


def chunks(seq, n):
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


def article_images(titles):
    """Map article title -> lead image file title (free licenses only)."""
    found = {}
    for batch in chunks(titles, 40):
        res = get(ENWIKI, {"action": "query", "format": "json", "formatversion": 2, "redirects": 1,
                           "prop": "pageimages", "piprop": "name", "pilicense": "free",
                           "titles": "|".join(batch)})
        q = res.get("query", {})
        back = {t: t for t in batch}
        for step in ("normalized", "redirects"):
            for m in q.get(step, []):
                for orig, cur in list(back.items()):
                    if cur == m["from"]:
                        back[orig] = m["to"]
        by_title = {p["title"]: p.get("pageimage") for p in q.get("pages", [])}
        for orig, final in back.items():
            if by_title.get(final):
                found[orig] = "File:" + by_title[final]
        time.sleep(0.2)
    return found


def search_file(terms):
    res = get(COMMONS, {"action": "query", "format": "json", "formatversion": 2, "list": "search",
                        "srnamespace": 6, "srlimit": 15, "srsearch": terms + " filetype:bitmap"})
    for hit in res.get("query", {}).get("search", []):
        if re.search(r"\.(jpe?g|png|webp)$", hit["title"], re.I):
            return hit["title"]
    return None


def file_infos(files):
    infos = {}
    for batch in chunks(files, 40):
        res = get(ENWIKI, {"action": "query", "format": "json", "formatversion": 2, "prop": "imageinfo",
                           "iiprop": "url|mime|extmetadata", "iiurlwidth": 500,
                           "iiextmetadatafilter": "Artist|LicenseShortName|UsageTerms",
                           "titles": "|".join(batch)})
        q = res.get("query", {})
        norm = {m["to"]: m["from"] for m in q.get("normalized", [])}
        for p in q.get("pages", []):
            ii = (p.get("imageinfo") or [None])[0]
            if not ii:
                continue
            meta = ii.get("extmetadata") or {}
            if not isinstance(meta, dict):
                meta = {}
            artist = html.unescape(re.sub(r"<[^>]+>", "", meta.get("Artist", {}).get("value", ""))).strip()
            artist = re.sub(r"\s+", " ", artist)[:70] or "Unknown author"
            lic = meta.get("LicenseShortName", {}).get("value", "") or meta.get("UsageTerms", {}).get("value", "")
            infos[norm.get(p["title"], p["title"])] = {
                "thumb": ii.get("thumburl") or ii.get("url"), "mime": ii.get("mime", ""),
                "page": ii.get("descriptionurl", ""), "by": artist, "lic": html.unescape(lic).strip()}
        time.sleep(0.2)
    return infos


def save_webp(data, path):
    im = Image.open(io.BytesIO(data))
    im = im.convert("RGBA") if im.mode in ("P", "LA", "RGBA") or "transparency" in im.info else im.convert("RGB")
    im.thumbnail((640, 520), Image.LANCZOS)
    im.save(path, "WEBP", quality=74, method=6)


def write_index(index):
    tmp = INDEX + ".tmp"
    with open(tmp, "w", encoding="utf-8") as out:
        json.dump(dict(sorted(index.items())), out, ensure_ascii=False, indent=1)
    os.replace(tmp, INDEX)


def main():
    keys = [k for k in json.load(sys.stdin) if k]
    os.makedirs(OUT_DIR, exist_ok=True)
    index = json.load(open(INDEX, encoding="utf-8")) if os.path.exists(INDEX) else {}
    todo = [k for k in keys if not (index.get(k) and os.path.exists(os.path.join(ROOT, index[k]["f"])))]
    print(f"{len(keys)} keys, {len(todo)} to fetch", file=sys.stderr)

    key_file = {}
    articles = [k for k in todo if not k.startswith(("File:", "search:"))]
    key_file.update(article_images(articles))
    for k in todo:
        if k.startswith("File:"):
            key_file[k] = k
        elif k.startswith("search:"):
            try:
                f = search_file(k[len("search:"):])
            except Exception as e:  # noqa: BLE001 - report and keep going
                print(f"  search failed for {k}: {e}", file=sys.stderr)
                f = None
            if f:
                key_file[k] = f
            time.sleep(1.0)

    infos = file_infos(sorted(set(key_file.values())))
    missing, done = [], 0
    for k in todo:
        f = key_file.get(k)
        info = infos.get(f) if f else None
        if not info or not info["thumb"] or NONFREE.search(info["lic"] or "") or not info["lic"]:
            missing.append(k)
            index.pop(k, None)
            continue
        name = hashlib.sha1(f.encode()).hexdigest()[:12] + ".webp"
        rel = "photos/" + name
        if not os.path.exists(os.path.join(ROOT, rel)):
            try:
                save_webp(get(info["thumb"], binary=True), os.path.join(ROOT, rel))
            except Exception as e:  # noqa: BLE001 - report and keep going
                print(f"  download failed for {k}: {e}", file=sys.stderr)
                missing.append(k)
                continue
            time.sleep(0.15)
        index[k] = {"f": rel, "by": info["by"], "lic": info["lic"], "src": info["page"], "file": f}
        print(f"  ok  {k}  ->  {f}", file=sys.stderr)
        done += 1
        if done % 20 == 0:
            write_index(index)  # keep progress if the run is interrupted

    write_index(index)
    print(f"\nsaved {len([k for k in keys if k in index])}/{len(keys)} photos", file=sys.stderr)
    if missing:
        print("no free photo for:\n  " + "\n  ".join(missing), file=sys.stderr)


if __name__ == "__main__":
    main()
