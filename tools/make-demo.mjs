// Rebuilds public/demo/<slug>.json from supabase/seed.sql, so the site works in demo mode
// (no Supabase keys yet) with exactly what the database would return.
//
//   PGHOST=/path/to/socket PGPORT=5432 node tools/make-demo.mjs
//
import pg from 'pg';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sql = (p) => readFileSync(join(root, p), 'utf8');
const DB = 'cafes_demo_build';

const admin = new pg.Client({ database: 'postgres', user: 'postgres' });
await admin.connect();
await admin.query(`drop database if exists ${DB}`);
await admin.query(`create database ${DB}`);
await admin.end();

const db = new pg.Client({ database: DB, user: 'postgres' });
await db.connect();
await db.query(sql('tests/db/supabase_stub.sql'));
await db.query(sql('supabase/schema.sql'));
await db.query(sql('supabase/seed.sql'));
const slugs = (await db.query('select slug from cafes order by slug')).rows.map((r) => r.slug);
mkdirSync(join(root, 'public/demo'), { recursive: true });
for (const slug of slugs) {
  const { rows } = await db.query('select public_cafe($1) as j', [slug]);
  const out = join(root, 'public/demo', `${slug}.json`);
  writeFileSync(out, `${JSON.stringify(rows[0].j, null, 2)}\n`);
  console.log(`wrote public/demo/${slug}.json`);
}
await db.end();
const cleanup = new pg.Client({ database: 'postgres', user: 'postgres' });
await cleanup.connect();
await cleanup.query(`drop database if exists ${DB}`);
await cleanup.end();
