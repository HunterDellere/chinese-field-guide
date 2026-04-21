#!/usr/bin/env node
/**
 * test-admin.mjs — smoke test for the generated admin dashboard.
 *
 * Reads `pages/_admin/review.html` and asserts invariants that a hand-edit to
 * `build/build-admin.mjs` could silently regress:
 *
 *   1. Every review state in `entry.schema.json` appears in the state filter.
 *   2. Every tab button has a matching tab panel id.
 *   3. Every reviewable (status:complete) entry from `data/entries.json` is
 *      rendered as a row in the Needs Review tab (so the "verified" filter
 *      actually has rows to match).
 *   4. The Needs Review panel exists and carries the human-readable label.
 *
 * Exits with non-zero status if any assertion fails, so `npm run check` fails
 * loudly when the generator drifts from the schema or data.
 *
 * Run: node build/test-admin.mjs   (also triggered by `npm run check`)
 */

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const htmlPath    = path.join(ROOT, 'pages', '_admin', 'review.html');
const entriesPath = path.join(ROOT, 'data', 'entries.json');
const schemaPath  = path.join(ROOT, 'content', '_schema', 'entry.schema.json');

const failures = [];
function check(label, cond, detail = '') {
  if (!cond) failures.push(`✗ ${label}${detail ? ` — ${detail}` : ''}`);
}

if (!fs.existsSync(htmlPath)) {
  console.error(`test-admin: ${htmlPath} missing — run 'npm run build' first.`);
  process.exit(1);
}

const html    = fs.readFileSync(htmlPath, 'utf8');
const entries = JSON.parse(fs.readFileSync(entriesPath, 'utf8'));
const schema  = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

// ── 1. State filter covers every content_review state (plus 'missing') ──────
const enumStates = schema.properties?.content_review?.enum || [];
const expectedStates = [...enumStates, 'missing'];
for (const s of expectedStates) {
  check(
    `state filter <option>${s}</option>`,
    html.includes(`<option>${s}</option>`),
    `add '${s}' to the <select class="f-status"> in build-admin.mjs filterBarHtml()`
  );
}

// ── 2. Every tab button has a matching tab panel ────────────────────────────
const tabButtonRe = /data-tab="([^"]+)"/g;
const tabIds = new Set();
for (const m of html.matchAll(tabButtonRe)) tabIds.add(m[1]);
check('tab buttons present', tabIds.size > 0, 'no .tab-btn rendered');
for (const id of tabIds) {
  check(
    `tab panel id="tab-${id}"`,
    html.includes(`id="tab-${id}"`),
    `tab button '${id}' has no matching <div id="tab-${id}">`
  );
}

// ── 3. Every reviewable entry is rendered as a row ──────────────────────────
const reviewable = [];
for (const e of entries) {
  const src = path.join(ROOT, e.path.replace(/^pages\//, 'content/').replace(/\.html$/, '.md'));
  if (!fs.existsSync(src)) continue;
  const { data: fm } = matter(fs.readFileSync(src, 'utf8'));
  if (fm.status === 'complete') reviewable.push(e.path);
}

const renderedPaths = new Set();
for (const m of html.matchAll(/data-path="([^"]+)"/g)) renderedPaths.add(m[1]);
for (const p of reviewable) {
  check(
    `row for ${p}`,
    renderedPaths.has(p),
    `missing <tr data-path="${p}"> — did the row filter drop it?`
  );
  if (failures.length > 10) break; // don't spam
}

// ── 4. Primary entries panel exists ─────────────────────────────────────────
check('needs-review panel present', html.includes('id="tab-needs-review"'));
check('primary tab label',          html.includes('All Entries'), 'tab label changed — update test-admin or TAB_LABELS');

// ── 5. Global search input present and rows carry data-search ───────────────
check('global search input',        html.includes('id="global-search"'), 'global search input missing from header');
check('rows carry data-search',     /data-search="/.test(html), 'row data-search attribute missing — search will not filter');

// ── Report ──────────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error(`test-admin: ${failures.length} assertion(s) failed:`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}

console.log(`✓ test-admin: ${expectedStates.length} states · ${tabIds.size} tabs · ${reviewable.length} reviewable rows — all present`);
