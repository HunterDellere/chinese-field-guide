#!/usr/bin/env node
/**
 * check.mjs — post-build invariants, link integrity, anchor resolution, orphan detection.
 *
 * Runs against the files produced by `npm run build`. Does not read content/ or
 * re-render anything; verifies the shipped output.
 *
 *   - Every page has a parseable metadata comment (pages/* only).
 *   - Layout universals are present (topnav, main, footer, stylesheet, scripts).
 *   - Type-specific invariants hold for complete pages (character → audio button,
 *     stroke order; topic/vocab/grammar → topic hero; hub → reading path).
 *   - Every relative href/src resolves to an existing file on disk.
 *   - Every #fragment href resolves to an element with a matching id on the
 *     target page.
 *   - content/**.md and pages/**.html are in 1:1 correspondence.
 *
 * Exit 0 = clean. Exit 1 = any error.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname, basename, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createFinding, mergeFindings } from './lib/findings.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');
const EMIT      = process.argv.includes('--emit-findings');

// ── file walking ────────────────────────────────────────────────────────────

function walkHtml(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) out.push(...walkHtml(full));
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

function walkMd(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith('_')) continue;
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) out.push(...walkMd(full));
    else if (name.endsWith('.md')) out.push(full);
  }
  return out;
}

// ── page parsing ────────────────────────────────────────────────────────────

function parseMetaComment(html) {
  const m = html.match(/^<!DOCTYPE html>\s*<!--\s*(\{[\s\S]*?\})\s*-->/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

function collectIds(html) {
  const ids = new Set();
  const re = /\bid="([^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) ids.add(m[1]);
  return ids;
}

/**
 * Collect all href/src attribute values from a page, excluding those inside
 * <script>, <style>, or HTML comments (so we don't try to resolve URLs in SW
 * caches lists, JSON-LD, etc.).
 */
function collectLinks(html) {
  const stripped = html
    .replace(/<script\b[\s\S]*?<\/script>/g, '')
    .replace(/<style\b[\s\S]*?<\/style>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  const links = [];
  const re = /\b(href|src)="([^"]+)"/g;
  let m;
  while ((m = re.exec(stripped)) !== null) {
    links.push({ attr: m[1], value: m[2] });
  }
  return links;
}

function stripQueryAndHash(urlPath) {
  return urlPath.split('#')[0].split('?')[0];
}

function isExternal(value) {
  return /^(https?:|mailto:|tel:|javascript:|data:)/i.test(value);
}

// ── invariants ──────────────────────────────────────────────────────────────

function escRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Each invariant is { name, test }. `test` receives (html, meta) and returns
 * true on success. Returning false emits an error.
 */
const LAYOUT_INVARIANTS = [
  { name: 'layout.topnav',      test: h => /<nav class="topnav"/.test(h) },
  { name: 'layout.main',        test: h => /<main class="main"/.test(h) },
  { name: 'layout.footer',      test: h => /<footer class="page-footer"/.test(h) },
  { name: 'layout.stylesheet',  test: h => /href="[^"]*style\.css/.test(h) },
  { name: 'layout.toc-scroll',  test: h => /toc-scroll\.js/.test(h) },
  { name: 'layout.enhance',     test: h => /enhance\.js/.test(h) },
  { name: 'layout.lang-zh',     test: h => /<html[^>]*lang="zh-Hans"/.test(h) },
];

const TYPE_INVARIANTS = {
  character: [
    { name: 'character.audio-btn',
      test: (h, m) => new RegExp(`class="audio-btn"[^>]*data-audio="${escRe(m.char)}"`).test(h) },
    { name: 'character.stroke-order',
      test: (h, m) => new RegExp(`class="so-stage"[^>]*data-char="${escRe(m.char)}"`).test(h) },
    { name: 'character.hero-glyph',
      test: (h, m) => h.includes(`<div class="hero-glyph">${m.char}</div>`) ||
                       h.includes(`<span class="hero-glyph">${m.char}</span>`) },
  ],
  topic:   [{ name: 'topic.topic-hero',   test: h => /<header class="topic-hero"/.test(h) }],
  vocab:   [{ name: 'vocab.topic-hero',   test: h => /<header class="topic-hero"/.test(h) }],
  grammar: [{ name: 'grammar.topic-hero', test: h => /<header class="topic-hero"/.test(h) }],
  chengyu: [{ name: 'chengyu.topic-hero', test: h => /<header class="topic-hero"/.test(h) }],
  hub:     [{ name: 'hub.path-anchor',    test: h => /id="path"/.test(h) }],
};

// ── main ────────────────────────────────────────────────────────────────────

const errors = [];
function fail(file, msg) { errors.push(`${relative(ROOT, file)}\n  ${msg}`); }

// Stage 1: gather all HTML pages + their parsed metadata + ids
const pagesDir = join(ROOT, 'pages');
const htmlFiles = [
  join(ROOT, 'index.html'),
  ...walkHtml(pagesDir),
];

const pageInfo = new Map(); // absPath → { html, meta, ids }
for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const meta = parseMetaComment(html);
  const ids = collectIds(html);
  pageInfo.set(file, { html, meta, ids });
}

// index.html is a JS-rendered shell — invariants and fragment resolution for
// that page are different (homepage.js builds sections at runtime). Check a
// narrower set on it.
const INDEX_INVARIANTS = [
  { name: 'index.topnav-brand', test: h => /class="topnav-brand"/.test(h) },
  { name: 'index.stylesheet',   test: h => /href="[^"]*style\.css/.test(h) },
  { name: 'index.homepage-js',  test: h => /homepage\.js/.test(h) },
  { name: 'index.lang-zh',      test: h => /<html[^>]*lang="zh-Hans"/.test(h) },
];

// Stage 2: layout + type invariants
for (const [file, { html, meta }] of pageInfo) {
  const isIndex = file === join(ROOT, 'index.html');
  // _admin/ and other _-prefixed page dirs are generated dashboards — exempt
  // from content-layout invariants.
  const relPath = relative(pagesDir, file);
  if (relPath.startsWith('_')) continue;

  if (isIndex) {
    for (const inv of INDEX_INVARIANTS) {
      if (!inv.test(html)) fail(file, `invariant failed: ${inv.name}`);
    }
    continue;
  }

  for (const inv of LAYOUT_INVARIANTS) {
    if (!inv.test(html)) fail(file, `invariant failed: ${inv.name}`);
  }

  if (!meta) {
    fail(file, 'missing or unparseable metadata comment <!-- {...} -->');
    continue;
  }
  if (!meta.type)     fail(file, 'metadata comment missing "type"');
  if (!meta.category) fail(file, 'metadata comment missing "category"');

  // Type invariants only apply to complete pages (stubs omit augments)
  if (meta.status === 'complete') {
    const invs = TYPE_INVARIANTS[meta.type] || [];
    for (const inv of invs) {
      let ok;
      try { ok = inv.test(html, meta); } catch { ok = false; }
      if (!ok) fail(file, `invariant failed: ${inv.name}`);
    }
  }
}

// Stage 3: internal link + fragment resolution
for (const [file, { html }] of pageInfo) {
  const isIndex = file === join(ROOT, 'index.html');
  const links = collectLinks(html);
  const fileDir = dirname(file);
  for (const { attr, value } of links) {
    if (!value || isExternal(value)) continue;
    if (value.startsWith('#')) {
      // index.html builds its own fragment targets at runtime (homepage.js)
      if (isIndex) continue;
      const frag = value.slice(1);
      if (!frag) continue;
      const { ids } = pageInfo.get(file);
      if (!ids.has(frag)) fail(file, `broken fragment ${attr}="${value}" — no element with id="${frag}" on this page`);
      continue;
    }
    const pathPart = stripQueryAndHash(value);
    if (!pathPart) continue;
    const fragMatch = value.match(/#([^?]*)$/);
    const fragment = fragMatch ? fragMatch[1] : '';

    const absTarget = resolve(fileDir, pathPart);
    if (!existsSync(absTarget)) {
      fail(file, `broken ${attr}="${value}" — target "${relative(ROOT, absTarget)}" does not exist`);
      continue;
    }
    // If the target is an HTML file we've parsed and there's a fragment, verify it
    if (fragment && pageInfo.has(absTarget)) {
      const targetIds = pageInfo.get(absTarget).ids;
      if (!targetIds.has(fragment)) {
        fail(file, `broken fragment ${attr}="${value}" — target page has no id="${fragment}"`);
      }
    }
  }
}

// Stage 4: orphan detection (content/ ↔ pages/)
const contentDir = join(ROOT, 'content');
const contentFiles = walkMd(contentDir)
  .filter(f => !relative(contentDir, f).startsWith('_schema'));

const contentSlugs = new Set();
for (const f of contentFiles) {
  const rel = relative(contentDir, f);         // e.g. "characters/cha2_茶.md"
  const slug = rel.replace(/\.md$/, '');        // "characters/cha2_茶"
  contentSlugs.add(slug);
}

const pageSlugs = new Set();
for (const f of walkHtml(pagesDir)) {
  const rel = relative(pagesDir, f);            // "characters/cha2_茶.html"
  const slug = rel.replace(/\.html$/, '');      // "characters/cha2_茶"
  // hsk/ is generated from content/hsk/ but individual level pages may be synthesized
  pageSlugs.add(slug);
}

for (const slug of contentSlugs) {
  if (!pageSlugs.has(slug)) {
    fail(join(contentDir, slug + '.md'), `orphan content: no corresponding pages/${slug}.html`);
  }
}
for (const slug of pageSlugs) {
  if (slug.startsWith('hsk/')) continue; // hsk pages are generated; content/hsk may not mirror
  if (slug.startsWith('_')) continue;    // _admin/ etc — generated dashboards, not content-backed
  if (!contentSlugs.has(slug)) {
    fail(join(pagesDir, slug + '.html'), `orphan page: no corresponding content/${slug}.md`);
  }
}

// ── report ──────────────────────────────────────────────────────────────────

if (EMIT && errors.length > 0) {
  // Classify each error string into a category based on keywords in the message.
  const adminFindings = errors.map(e => {
    const msg = e.replace(/^[^\n]+\n\s*/, ''); // strip filename prefix line
    const file = e.split('\n')[0].trim();
    let category = 'layout';
    if (/broken (href|src|fragment)/.test(msg))  category = 'links';
    if (/broken fragment/.test(msg))              category = 'anchors';
    if (/orphan (content|page)/.test(msg))        category = 'orphans';
    if (/invariant failed: (character|vocab|topic|grammar|chengyu|hub)/.test(msg)) category = 'layout';
    return createFinding({ level: 'ERROR', category, file, msg });
  });
  mergeFindings(ROOT, adminFindings, ['links', 'anchors', 'orphans', 'layout']);
}

if (errors.length === 0) {
  console.log(`✓ check.mjs: ${pageInfo.size} pages, ${contentSlugs.size} content sources — all invariants hold, all links resolve.`);
} else {
  console.error(`\n${errors.length} check error(s):\n`);
  for (const e of errors) console.error('✗ ' + e + '\n');
  process.exit(1);
}
