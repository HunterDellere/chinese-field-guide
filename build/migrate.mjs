#!/usr/bin/env node
/**
 * migrate.mjs — One-time migration: convert existing pages/ HTML to content/*.md
 *
 * Reads:  pages/<category>/<slug>.html   (hand-authored pages, via git)
 *         entries.js                     (for title, desc, updated, tags)
 * Writes: content/<category>/<slug>.md   (frontmatter + verbatim HTML body)
 *
 * Run: node build/migrate.mjs
 * Safe to re-run — skips files that already exist in content/.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Load entries.js via sandboxed eval
const entriesJs = readFileSync(join(ROOT, 'entries.js'), 'utf8');
const window = {};
new Function('window', entriesJs)(window);
const ENTRIES = window.ENTRIES;
if (!Array.isArray(ENTRIES)) throw new Error('Could not load entries.js');
const entryByPath = Object.fromEntries(ENTRIES.map(e => [e.path, e]));

const CATEGORIES = ['characters', 'vocab', 'grammar', 'religion', 'philosophy', 'history'];

function parseHsk(hsk) {
  if (typeof hsk === 'number') return hsk;
  if (typeof hsk === 'string') {
    const m = hsk.match(/^(\d+)[–\-](\d+)$/);
    if (m) return { from: parseInt(m[1]), to: parseInt(m[2]) };
    const n = parseInt(hsk);
    if (!isNaN(n)) return n;
  }
  return hsk;
}

function extractBody(html) {
  const navEnd = html.indexOf('</nav>');
  if (navEnd === -1) throw new Error('No </nav> found');
  const scriptTag = html.lastIndexOf('<script src="../../scripts/toc-scroll.js">');
  if (scriptTag === -1) throw new Error('No toc-scroll.js script tag found');
  return html.slice(navEnd + 6, scriptTag).trim();
}

function yamlValue(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'object') {
    // hsk range
    if (v.from !== undefined) return `{from: ${v.from}, to: ${v.to}}`;
    return JSON.stringify(v);
  }
  // String — determine quoting strategy
  const s = String(v);
  if (!s.includes("'") && !s.includes('"') && !s.includes('\n') && !s.includes(':') && !s.includes('#')) {
    return `'${s}'`;
  }
  // Contains single quotes — use double quotes with escaped double quotes
  const escaped = s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function buildFrontmatter(fields) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      if (v.length === 0) {
        lines.push(`${k}: []`);
      } else {
        lines.push(`${k}:`);
        for (const item of v) lines.push(`  - ${yamlValue(item)}`);
      }
    } else {
      lines.push(`${k}: ${yamlValue(v)}`);
    }
  }
  lines.push('---');
  return lines.join('\n') + '\n';
}

let migrated = 0;
let skipped = 0;
let errors = 0;

for (const cat of CATEGORIES) {
  const contentDir = join(ROOT, 'content', cat);
  mkdirSync(contentDir, { recursive: true });

  // Get HTML files — use filesystem directly since git may quote non-ASCII filenames
  const { readdirSync } = await import('fs');
  let htmlFiles;
  try {
    htmlFiles = readdirSync(join(ROOT, 'pages', cat)).filter(f => f.endsWith('.html'));
  } catch {
    htmlFiles = [];
  }

  for (const htmlFile of htmlFiles) {
    const slug = basename(htmlFile, '.html');
    const outPath = join(contentDir, `${slug}.md`);

    if (existsSync(outPath)) {
      skipped++;
      continue;
    }

    const entryKey = `pages/${cat}/${htmlFile}`;
    let html;
    try {
      // Read from git to get the clean original
      html = execSync(`git show HEAD:pages/${cat}/${htmlFile}`, { cwd: ROOT }).toString();
    } catch {
      html = readFileSync(join(ROOT, 'pages', cat, htmlFile), 'utf8');
    }

    try {
      const entry = entryByPath[entryKey];

      // Parse JSON metadata comment
      const commentMatch = html.match(/^<!DOCTYPE html>\s*\n<!--\s*({[\s\S]*?})\s*-->/);
      if (!commentMatch) throw new Error('No metadata comment found');
      const jsonMeta = JSON.parse(commentMatch[1]);

      // Extract meta description and page title from original HTML
      const metaDescMatch = html.match(/<meta name="description" content="([^"]+)">/);
      const metaDesc = metaDescMatch ? metaDescMatch[1] : null;
      const pageTitleMatch = html.match(/<title>([^<]+) — Jiǎoluò Shūwū · 角落書屋<\/title>/);
      const pageTitle = pageTitleMatch ? pageTitleMatch[1] : null;

      // Build frontmatter object (ordered for readability)
      const fm = {};
      fm.type     = jsonMeta.type;
      fm.category = jsonMeta.category || entry?.category || cat;
      fm.status   = jsonMeta.status || entry?.status || 'complete';
      fm.title    = entry?.title || jsonMeta.title || '';
      fm.desc     = entry?.desc || '';
      if (metaDesc && metaDesc !== fm.desc) fm.metaDesc = metaDesc;
      if (pageTitle) fm.pageTitle = pageTitle;
      fm.tags     = entry?.tags || jsonMeta.tags || [];
      fm.updated = entry?.updated || '2026-04-18';

      // Character-specific fields
      if (jsonMeta.char)    fm.char    = jsonMeta.char;
      if (jsonMeta.pinyin)  fm.pinyin  = jsonMeta.pinyin;
      if (jsonMeta.tone)    fm.tone    = jsonMeta.tone;
      if (jsonMeta.hsk !== undefined) fm.hsk = parseHsk(jsonMeta.hsk);
      if (jsonMeta.radical) fm.radical = jsonMeta.radical;

      // Vocab pinyin
      if (entry?.pinyin && !fm.pinyin) fm.pinyin = entry.pinyin;

      const body = extractBody(html);
      const content = buildFrontmatter(fm) + '\n' + body + '\n';

      writeFileSync(outPath, content, 'utf8');
      console.log(`  ✓ ${cat}/${slug}.md`);
      migrated++;
    } catch (err) {
      console.error(`  ✗ ${cat}/${htmlFile}: ${err.message}`);
      errors++;
    }
  }
}

console.log(`\nMigration: ${migrated} migrated, ${skipped} skipped, ${errors} errors.`);
if (errors) process.exit(1);
