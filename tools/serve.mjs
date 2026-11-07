// Local web server that follows the same URL rules as Netlify (public/_redirects).
//   node tools/serve.mjs            -> http://localhost:8888
//   PORT=3000 node tools/serve.mjs
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname } from 'node:path';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const PORT = Number(process.env.PORT || 8888);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};

// Parse "from to status" lines; ":name" matches one path segment, "*" matches the rest.
const rules = readFileSync(join(PUBLIC, '_redirects'), 'utf8').split('\n')
  .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  .map((l) => {
    const [from, to] = l.split(/\s+/);
    const re = new RegExp(`^${from.replace(/\/:[a-z]+/g, '/[^/]+').replace(/\*/g, '.*')}$`);
    return { re, to };
  });

async function fileFor(path) {
  const p = normalize(join(PUBLIC, decodeURIComponent(path)));
  if (!p.startsWith(PUBLIC)) return null;
  try {
    const s = await stat(p);
    if (s.isFile()) return p;
    if (s.isDirectory()) {
      const idx = join(p, 'index.html');
      if ((await stat(idx).catch(() => null))?.isFile()) return idx;
    }
  } catch { /* not found */ }
  return null;
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let file = await fileFor(url.pathname);
  if (!file) {
    const rule = rules.find((r) => r.re.test(url.pathname));
    if (rule) file = await fileFor(rule.to);
  }
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }
  const body = await readFile(file);
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  res.end(body);
}).listen(PORT, () => console.log(`Serving public/ on http://localhost:${PORT}`));
