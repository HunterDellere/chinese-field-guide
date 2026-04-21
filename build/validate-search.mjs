#!/usr/bin/env node
/**
 * validate-search.mjs — audit the search index for health signals.
 *
 * Checks (all emit category:'search'):
 *   - Index overview stats (INFO): path count, token count, file size
 *   - Entries contributing zero tokens beyond frontmatter (WARN)
 *   - Singleton tokens: appear in only 1 entry — candidate for pruning or rare coverage (INFO, sampled)
 *
 * Reads data/search-index.json + data/entries.json.
 * Writes findings into data/_admin/findings.json via mergeFindings().
 */

import fs from 'node:fs';
import path from 'node:path';
import { createFinding, mergeFindings, reportFindings } from './lib/findings.mjs';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');

const indexPath   = path.join(ROOT, 'data', 'search-index.json');
const entriesPath = path.join(ROOT, 'data', 'entries.json');

if (!fs.existsSync(indexPath)) {
  console.error('validate-search: data/search-index.json missing — run `npm run build` first.');
  process.exit(1);
}
if (!fs.existsSync(entriesPath)) {
  console.error('validate-search: data/entries.json missing — run `npm run build` first.');
  process.exit(1);
}

const { paths, index } = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
const entries = JSON.parse(fs.readFileSync(entriesPath, 'utf8'));

const findings = [];
function emit(level, file, msg, extra = {}) {
  findings.push(createFinding({ level, category: 'search', file, msg, ...extra }));
}

// ── index stats ─────────────────────────────────────────────────────────────

const tokenCount = Object.keys(index).length;
const indexBytes = fs.statSync(indexPath).size;
const indexKb = (indexBytes / 1024).toFixed(1);

emit('INFO', 'data/search-index.json',
  `index stats: ${paths.length} pages, ${tokenCount} tokens, ${indexKb} KB`);

// ── entries with zero tokens ─────────────────────────────────────────────────

// For each path in the index, collect which path IDs it covers.
// Then find entry paths that appear in 0 token postings.
const coveredIds = new Set();
for (const postings of Object.values(index)) {
  for (const [pathId] of postings) {
    coveredIds.add(pathId);
  }
}

for (let i = 0; i < paths.length; i++) {
  if (!coveredIds.has(i)) {
    const pagePath = paths[i];
    const entry = entries.find(e => e.path === pagePath);
    const relContent = entry
      ? pagePath.replace(/^pages\//, 'content/').replace(/\.html$/, '.md')
      : pagePath;
    emit('WARN', relContent,
      `entry contributes zero tokens to search index — it may be missing body text or has very sparse content`,
      { fix: 'Add substantive prose to the page body so it surfaces in search results' });
  }
}

// ── singleton tokens ─────────────────────────────────────────────────────────
// Tokens that appear in exactly one entry are either rare-coverage indicators
// (good) or noise (e.g. typos, one-off proper nouns). Surface the top 30 by
// length as a spot-check sample.

const singletons = [];
for (const [token, postings] of Object.entries(index)) {
  if (postings.length === 1) singletons.push(token);
}

if (singletons.length > 0) {
  const sample = singletons
    .sort((a, b) => b.length - a.length)
    .slice(0, 30)
    .join(', ');
  emit('INFO', 'data/search-index.json',
    `${singletons.length} singleton tokens (appear in exactly 1 entry). Sample: ${sample}`);
}

// ── persist ──────────────────────────────────────────────────────────────────
reportFindings('validate-search', findings);
mergeFindings(ROOT, findings, ['search']);

const errorCount = findings.filter(f => f.level === 'ERROR').length;
process.exit(errorCount > 0 ? 1 : 0);
