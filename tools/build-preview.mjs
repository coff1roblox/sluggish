// Builds preview/<slug>.html: the café website as ONE self-contained file (styles, scripts,
// logos and data inlined), so it can be opened anywhere without a server or Supabase.
//   node tools/build-preview.mjs [slug]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = (p) => join(root, 'public', p);
const slug = process.argv[2] || 'sluggish';
const data = JSON.parse(readFileSync(pub(`demo/${slug}.json`), 'utf8'));

// Inline images that live in this repo as data URIs.
for (const k of ['logo_url', 'logo_alt_url']) {
  const u = data.cafe[k];
  if (u && u.startsWith('/') && existsSync(pub(u))) {
    data.cafe[k] = `data:image/png;base64,${readFileSync(pub(u)).toString('base64')}`;
  }
}

const css = readFileSync(pub('css/site.css'), 'utf8');
const core = readFileSync(pub('js/core.js'), 'utf8');
const site = readFileSync(pub('js/site.js'), 'utf8');
const safe = (s) => s.replace(/<\/script/gi, '<\\/script');

const preview = `window.CP_CONFIG = {};
window.CP_PREVIEW = {
  slug: ${JSON.stringify(slug)},
  data: ${JSON.stringify(data)},
  rpc(fn) { return Promise.resolve(fn === 'public_cafe' ? this.data : null); },
  goMessage(where) {
    const ar = document.documentElement.lang === 'ar';
    return where === 'loyalty'
      ? (ar ? 'بطاقة الولاء تجي في المرحلة الخامسة.' : 'The loyalty card arrives in stage 5.')
      : (ar ? 'صفحة المنيو تجي في المرحلة الثالثة.' : 'The full menu page arrives in stage 3.');
  },
};`;

let html = readFileSync(pub('site.html'), 'utf8')
  .replace('<link rel="stylesheet" href="/css/site.css">', () => `<style>\n${css}\n</style>`)
  .replace('<script src="/js/config.js"></script>', () => `<script>\n${safe(preview)}\n</script>`)
  .replace('<script src="/js/core.js"></script>', () => `<script>\n${safe(core)}\n</script>`)
  .replace('<script src="/js/site.js" defer></script>', () => `<script>\n${safe(site)}\n</script>`)
  .replace('<div id="app">', '<div id="app" data-preview="1">');
// Scripts are inline now, so the page body must exist before site.js runs.
html = html.replace(/<script>\n(?=\(function \(\) \{\n {2}'use strict';\n {2}\/\* Café website)/, '<script defer>\n');
const bodyAt = html.indexOf('</body>');
const siteStart = html.lastIndexOf('<script', html.indexOf('/* Café website'));
const siteEnd = html.indexOf('</script>', siteStart) + '</script>'.length;
const siteTag = html.slice(siteStart, siteEnd);
html = html.slice(0, siteStart) + html.slice(siteEnd);
html = html.replace('</body>', `${siteTag.replace('<script defer>', '<script>')}\n</body>`);

mkdirSync(join(root, 'preview'), { recursive: true });
writeFileSync(join(root, 'preview', `${slug}.html`), html);
console.log(`wrote preview/${slug}.html (${Math.round(html.length / 1024)} KB)`);
