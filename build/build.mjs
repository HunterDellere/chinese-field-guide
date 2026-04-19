#!/usr/bin/env node
/**
 * build.mjs — Chinese Field Guide build system
 *
 * Reads:  content/<category>/<slug>.md  (frontmatter + HTML body)
 * Writes: pages/<category>/<slug>.html
 *         data/entries.json
 *         data/search-index.json
 *         data/recent.json
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename, relative } from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { validateEntry } from './lib/validate.mjs';
import { buildSearchIndex } from './lib/search-index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');

const LAYOUT = readFileSync(join(ROOT, 'templates/_layout.html'), 'utf8');

// ── helpers ─────────────────────────────────────────────────────────────────

function walk(dir) {
  const results = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      results.push(...walk(full));
    } else if (name.endsWith('.md') && !name.startsWith('_')) {
      results.push(full);
    }
  }
  return results;
}

function hskDisplay(hsk) {
  if (!hsk) return '';
  if (typeof hsk === 'number') return String(hsk);
  return `${hsk.from}–${hsk.to}`;
}

function buildMetaComment(fm) {
  const obj = {};
  for (const k of ['type','char','pinyin','tone','hsk','radical','category','topic','tags','status']) {
    if (fm[k] !== undefined) obj[k] = fm[k];
  }
  return JSON.stringify(obj);
}

function buildPageTitle(fm) {
  if (fm.type === 'character') return `${fm.char} ${fm.pinyin}`;
  if (fm.title) return fm.title.split('·')[0].trim();
  return fm.title || '';
}

function renderPage(fm, body, slug, category) {
  const filename = `${slug}.html`;
  const metaComment = buildMetaComment(fm);
  const pageTitle = fm.pageTitle || buildPageTitle(fm);
  const metaDesc = fm.metaDesc || fm.desc || '';

  const page = LAYOUT
    .replace('{{{metaComment}}}', metaComment)
    .replace('{{{pageTitle}}}', pageTitle)
    .replace('{{{metaDesc}}}', metaDesc)
    .replace('{{{pageBody}}}', body.trim());

  return page;
}

function toEntryObject(fm, slug, category) {
  const path = `pages/${category}/${slug}.html`;
  const entry = {
    path,
    type: fm.type,
    category: fm.category || category,
    title: fm.title,
    desc: fm.desc,
    tags: fm.tags || [],
    status: fm.status,
  };

  if (fm.char)    entry.char    = fm.char;
  if (fm.pinyin)  entry.pinyin  = fm.pinyin;
  if (fm.tone)    entry.tone    = fm.tone;
  if (fm.hsk)     entry.hsk     = fm.hsk;
  if (fm.radical) entry.radical = fm.radical;
  if (fm.updated) entry.updated = fm.updated;

  return entry;
}

// ── main ────────────────────────────────────────────────────────────────────

const contentDir = join(ROOT, 'content');
const pagesDir   = join(ROOT, 'pages');
const dataDir    = join(ROOT, 'data');
mkdirSync(dataDir, { recursive: true });

const files = walk(contentDir).filter(f => {
  const rel = relative(contentDir, f);
  return !rel.startsWith('_schema');
});

const entries = [];
let built = 0;
let errors = 0;

for (const filePath of files) {
  const rel      = relative(contentDir, filePath);
  const parts    = rel.split('/');
  const category = parts[0];
  const slug     = basename(filePath, '.md');

  try {
    const raw  = readFileSync(filePath, 'utf8');
    const { data: fm, content: body } = matter(raw);

    validateEntry(fm, filePath);

    const outDir  = join(pagesDir, category);
    mkdirSync(outDir, { recursive: true });

    const html = renderPage(fm, body, slug, category);
    writeFileSync(join(outDir, `${slug}.html`), html, 'utf8');

    entries.push(toEntryObject(fm, slug, category));
    built++;
  } catch (err) {
    console.error(`\n✗ ${rel}\n${err.message}`);
    errors++;
  }
}

// Sort entries: complete first, then stubs; within each group by updated desc
entries.sort((a, b) => {
  if (a.status !== b.status) return a.status === 'complete' ? -1 : 1;
  if (a.updated && b.updated) return b.updated.localeCompare(a.updated);
  return 0;
});

writeFileSync(join(dataDir, 'entries.json'), JSON.stringify(entries, null, 2), 'utf8');

const searchIndex = buildSearchIndex(entries);
writeFileSync(join(dataDir, 'search-index.json'), JSON.stringify(searchIndex), 'utf8');

const recent = entries
  .filter(e => e.status === 'complete' && e.updated)
  .sort((a, b) => b.updated.localeCompare(a.updated))
  .slice(0, 20);
writeFileSync(join(dataDir, 'recent.json'), JSON.stringify(recent, null, 2), 'utf8');

console.log(`\nBuild complete: ${built} pages written, ${errors} errors.`);
if (errors) process.exit(1);
