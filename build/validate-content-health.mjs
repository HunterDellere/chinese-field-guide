#!/usr/bin/env node
/**
 * validate-content-health.mjs — surface content quality signals.
 *
 * Checks (all emit category:'content-health'):
 *   - Stub entries per category (INFO)
 *   - complete entries missing `updated` (ERROR)
 *   - Stale entries (updated > 12 months ago) (WARN)
 *   - Thin descriptions (desc.length < 40) (WARN)
 *   - Entries with zero tags (WARN)
 *   - Entries with no substantive body (pages/**html body < threshold) (WARN)
 *
 * Reads data/entries.json + content/**\/*.md frontmatter.
 * Writes findings into data/_admin/findings.json via mergeFindings().
 */

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { createFinding, mergeFindings, reportFindings } from './lib/findings.mjs';

const ROOT    = path.resolve(new URL('.', import.meta.url).pathname, '..');
const CONTENT = path.join(ROOT, 'content');
const PAGES   = path.join(ROOT, 'pages');

const STALE_MONTHS = 12;
const THIN_DESC_LEN = 40;
// Minimum characters of visible body text (after stripping tags) before a
// complete page is flagged as "no substantive body".
const MIN_BODY_CHARS = 200;

const entriesPath = path.join(ROOT, 'data', 'entries.json');
if (!fs.existsSync(entriesPath)) {
  console.error('validate-content-health: data/entries.json missing — run `npm run build` first.');
  process.exit(1);
}

const entries = JSON.parse(fs.readFileSync(entriesPath, 'utf8'));

const findings = [];
function emit(level, file, msg, extra = {}) {
  findings.push(createFinding({ level, category: 'content-health', file, msg, ...extra }));
}

// ── helpers ────────────────────────────────────────────────────────────────

const now = new Date();

function contentPath(entry) {
  return entry.path.replace(/^pages\//, 'content/').replace(/\.html$/, '.md');
}

function ageMonths(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return (now - d) / (1000 * 60 * 60 * 24 * 30.44);
}

function stripTags(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── per-entry checks ───────────────────────────────────────────────────────

const stubsByCat = {};

for (const e of entries) {
  const relContent = contentPath(e);
  const absContent = path.join(ROOT, relContent);

  // Stub check — read frontmatter directly since entries.json may not include
  // stub entries (homepage.js filters them out; build.mjs does include them).
  // We handle two cases: entries.json included the stub (status field present)
  // or the content file exists with status:stub.
  if (e.status === 'stub' || e.status === 'draft') {
    stubsByCat[e.category] = stubsByCat[e.category] || [];
    stubsByCat[e.category].push(e.title || e.path);
    continue; // stubs don't need other checks
  }

  // complete entries below —————————————————————

  // Missing `updated`
  if (!e.updated) {
    emit('ERROR', relContent, `status:complete entry missing 'updated' date`, {
      fix: `Add 'updated: ${now.toISOString().slice(0, 10)}' to frontmatter`,
    });
  }

  // Stale
  const age = ageMonths(e.updated);
  if (age !== null && age > STALE_MONTHS) {
    const months = Math.round(age);
    emit('WARN', relContent, `entry not updated in ${months} months (last: ${e.updated})`, {
      fix: 'Revisit content and bump `updated` date when done',
    });
  }

  // Thin description
  const descLen = (e.desc || '').length;
  if (descLen < THIN_DESC_LEN) {
    emit('WARN', relContent,
      `thin description: ${descLen} chars (min ${THIN_DESC_LEN}) — "${(e.desc || '').slice(0, 60)}"`,
      { fix: 'Expand the `desc` frontmatter field to at least 40 characters' });
  }

  // Zero tags
  if (!e.tags || e.tags.length === 0) {
    emit('WARN', relContent, 'entry has no tags — invisible to Jaccard relation scoring', {
      fix: 'Add at least 2 relevant tags from content/_schema/tags.json',
    });
  }

  // No substantive body
  const pagePath = path.join(ROOT, e.path);
  if (fs.existsSync(pagePath)) {
    const html = fs.readFileSync(pagePath, 'utf8');
    // Strip the hero/header to avoid counting the title as body
    const bodyMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    if (bodyMatch) {
      const bodyText = stripTags(bodyMatch[1]);
      if (bodyText.length < MIN_BODY_CHARS) {
        emit('WARN', relContent,
          `very short body text: ${bodyText.length} chars (min ${MIN_BODY_CHARS}) — page may be a thin stub marked complete`,
          { fix: 'Add substantive content or revert status to stub' });
      }
    }
  }
}

// Also walk content/ for any .md files with status:stub that may not be in entries.json
function walkContent(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith('_')) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) { walkContent(full); continue; }
    if (!name.endsWith('.md')) continue;
    const src = fs.readFileSync(full, 'utf8');
    const { data: fm } = matter(src);
    if (fm.status === 'stub' || fm.status === 'draft') {
      const rel = path.relative(ROOT, full);
      // Only emit if not already counted above (entries.json may have included it)
      const alreadyCounted = entries.some(e => contentPath(e) === rel && (e.status === 'stub' || e.status === 'draft'));
      if (!alreadyCounted) {
        stubsByCat[fm.category || 'unknown'] = stubsByCat[fm.category || 'unknown'] || [];
        stubsByCat[fm.category || 'unknown'].push(fm.title || rel);
      }
    }
  }
}
walkContent(CONTENT);

// Emit stub summaries per category
for (const [cat, titles] of Object.entries(stubsByCat)) {
  emit('INFO', `content/${cat}`, `${titles.length} stub/draft entr${titles.length === 1 ? 'y' : 'ies'}: ${titles.slice(0, 10).join(', ')}${titles.length > 10 ? ` … +${titles.length - 10} more` : ''}`, {
    fix: 'Author and flip status to complete, or leave as planned stubs',
  });
}

// ── persist ─────────────────────────────────────────────────────────────────
reportFindings('validate-content-health', findings);
mergeFindings(ROOT, findings, ['content-health']);

const errorCount = findings.filter(f => f.level === 'ERROR').length;
process.exit(errorCount > 0 ? 1 : 0);
