#!/usr/bin/env node
/**
 * validate-relations.mjs — audit relations/discoverability signals.
 *
 * Checks:
 *   - Pages with fewer than MIN_PER_PAGE related entries after scoring (WARN) → category:'relations'
 *   - Orphaned tags: in tags.json but unused by any entry (INFO) → category:'tags'
 *   - Tag usage inventory: all tags + counts (INFO, one global finding) → category:'tags'
 *   - Hub pages with member slugs that don't resolve (ERROR) → category:'hub-members'
 *
 * Reads data/entries.json + content/_schema/tags.json + content/**.md (for hub stages).
 * Writes findings into data/_admin/findings.json via mergeFindings().
 */

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { buildRelations } from './lib/relations.mjs';
import { createFinding, mergeFindings, reportFindings } from './lib/findings.mjs';

const ROOT    = path.resolve(new URL('.', import.meta.url).pathname, '..');
const CONTENT = path.join(ROOT, 'content');

const MIN_PER_PAGE = 4; // mirrors relations.mjs constant

const entriesPath = path.join(ROOT, 'data', 'entries.json');
if (!fs.existsSync(entriesPath)) {
  console.error('validate-relations: data/entries.json missing — run `npm run build` first.');
  process.exit(1);
}

const entries = JSON.parse(fs.readFileSync(entriesPath, 'utf8'));

const findings = [];
function emit(level, category, file, msg, extra = {}) {
  findings.push(createFinding({ level, category, file, msg, ...extra }));
}

function contentPath(entry) {
  return entry.path.replace(/^pages\//, 'content/').replace(/\.html$/, '.md');
}

// ── Relations audit ─────────────────────────────────────────────────────────

const relations = buildRelations(entries);
for (const [pagePath, related] of relations) {
  const entry = entries.find(e => e.path === pagePath);
  if (!entry || entry.status !== 'complete') continue;
  if (related.length < MIN_PER_PAGE) {
    const rel = contentPath(entry);
    emit('WARN', 'relations', rel,
      `only ${related.length} related entr${related.length === 1 ? 'y' : 'ies'} (min ${MIN_PER_PAGE}) — entry may be too isolated in the tag graph`,
      { fix: 'Add 2–4 descriptive tags from content/_schema/tags.json to improve discoverability' });
  }
}

// ── Tag audit ────────────────────────────────────────────────────────────────

const tagsPath = path.join(CONTENT, '_schema', 'tags.json');
const tagsRaw = JSON.parse(fs.readFileSync(tagsPath, 'utf8'));
// tags.json is an array-like object keyed by index; values are {slug, label}
const allTagSlugs = new Set(Object.values(tagsRaw).map(t => t.slug));

// Count usage across all entries
const usage = {};
for (const e of entries) {
  for (const t of (e.tags || [])) {
    usage[t] = (usage[t] || 0) + 1;
  }
}

// Orphaned tags — defined but never used
const orphaned = [...allTagSlugs].filter(slug => !usage[slug]);
if (orphaned.length > 0) {
  emit('INFO', 'tags', 'content/_schema/tags.json',
    `${orphaned.length} tag${orphaned.length === 1 ? '' : 's'} defined in tags.json but never used: ${orphaned.slice(0, 20).join(', ')}${orphaned.length > 20 ? ` … +${orphaned.length - 20} more` : ''}`,
    { fix: 'Remove unused tags from tags.json, or add them to relevant entries' });
}

// Tag inventory summary
const topTags = Object.entries(usage)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 30)
  .map(([slug, n]) => `${slug}(${n})`)
  .join(', ');
emit('INFO', 'tags', 'content/_schema/tags.json',
  `tag inventory — ${Object.keys(usage).length} tags in use across ${entries.length} entries. Top 30: ${topTags}`);

// Unknown tags (used in entries but not defined in tags.json)
const unknownTags = Object.keys(usage).filter(t => !allTagSlugs.has(t));
if (unknownTags.length > 0) {
  emit('WARN', 'tags', 'content/_schema/tags.json',
    `${unknownTags.length} tag${unknownTags.length === 1 ? '' : 's'} used in entries but not defined in tags.json: ${unknownTags.join(', ')}`,
    { fix: 'Add missing tags to content/_schema/tags.json' });
}

// ── Hub member resolution ────────────────────────────────────────────────────

// Build set of known slugs: "category/slug-filename" (no extension)
const knownSlugs = new Set(
  entries.map(e => {
    const parts = e.path.replace(/^pages\//, '').replace(/\.html$/, '').split('/');
    return parts.join('/'); // e.g. "characters/gan3_感"
  })
);

function walk(dir) {
  const results = [];
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith('_')) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) results.push(...walk(full));
    else if (name.endsWith('.md')) results.push(full);
  }
  return results;
}

for (const fp of walk(CONTENT)) {
  const src = fs.readFileSync(fp, 'utf8');
  const { data: fm } = matter(src);
  if (fm.type !== 'hub' || !fm.stages) continue;
  const rel = path.relative(ROOT, fp);
  for (const stage of fm.stages) {
    for (const member of (stage.members || [])) {
      if (!member.slug) continue;
      // Accept "characters/gan3_感" format
      const normalized = member.slug.replace(/^pages\//, '').replace(/\.html$/, '');
      if (!knownSlugs.has(normalized)) {
        emit('ERROR', 'hub-members', rel,
          `hub member slug "${member.slug}" does not resolve to a known entry`,
          { fix: `Check content/${normalized}.md exists and is built` });
      }
    }
  }
}

// ── persist ──────────────────────────────────────────────────────────────────
reportFindings('validate-relations', findings);
mergeFindings(ROOT, findings, ['relations', 'tags', 'hub-members']);

const errorCount = findings.filter(f => f.level === 'ERROR').length;
process.exit(errorCount > 0 ? 1 : 0);
