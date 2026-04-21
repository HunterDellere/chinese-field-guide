#!/usr/bin/env node
/**
 * build-admin.mjs — generate the secret admin dashboard.
 *
 * Reads:  data/entries.json, data/_admin/findings.json
 * Writes: pages/_admin/review.html
 *
 * The admin page is NOT linked from public surfaces:
 *   - Excluded from sitemap.xml (build.mjs skips `_` prefix)
 *   - Excluded from search index
 *   - Excluded from recent / orphan check
 *   - <meta name="robots" content="noindex,nofollow">
 *   - Directory prefix `_admin` + obscure filename
 *
 * Access path (bookmark it): /pages/_admin/review.html
 *
 * Run locally:  python3 -m http.server 8080  →  http://localhost:8080/pages/_admin/review.html
 */

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const entriesPath = path.join(ROOT, 'data', 'entries.json');
const findingsPath = path.join(ROOT, 'data', '_admin', 'findings.json');
const outDir = path.join(ROOT, 'pages', '_admin');
const outPath = path.join(outDir, 'review.html');

if (!fs.existsSync(entriesPath)) {
  console.error('build-admin: data/entries.json missing — run `npm run build` first.');
  process.exit(1);
}
if (!fs.existsSync(findingsPath)) {
  console.error('build-admin: data/_admin/findings.json missing — run `npm run validate:facts` first.');
  process.exit(1);
}

const entries = JSON.parse(fs.readFileSync(entriesPath, 'utf8'));
const { generated, summary, findings } = JSON.parse(fs.readFileSync(findingsPath, 'utf8'));

// Re-read frontmatter for every entry to get factual_review + factual_sources
// (entries.json doesn't carry these fields currently).
const review = {};
for (const e of entries) {
  const src = path.join(ROOT, e.path.replace(/^pages\//, 'content/').replace(/\.html$/, '.md'));
  if (!fs.existsSync(src)) continue;
  const { data: fm } = matter(fs.readFileSync(src, 'utf8'));
  review[e.path] = {
    factual_review: fm.factual_review || null,
    factual_sources: fm.factual_sources || [],
    status: fm.status,
    type: fm.type,
    category: fm.category,
    title: fm.title || e.title || e.path,
    updated: fm.updated,
    char: fm.char,
    pinyin: fm.pinyin,
  };
}

// Counts by factual_review status, for pages where the field is required.
const needsReview = Object.entries(review).filter(([, r]) =>
  r.status === 'complete' && (r.type === 'character' || r.type === 'vocab')
);
const counts = { verified: 0, pending: 0, unverified: 0, missing: 0 };
for (const [, r] of needsReview) {
  if (r.factual_review === 'verified') counts.verified++;
  else if (r.factual_review === 'pending') counts.pending++;
  else if (r.factual_review === 'unverified') counts.unverified++;
  else counts.missing++;
}

// Group findings by file for quick page-level inspection.
const findingsByFile = {};
for (const f of findings) {
  if (!findingsByFile[f.file]) findingsByFile[f.file] = [];
  findingsByFile[f.file].push(f);
}
// Map content path → pages path for linking.
function toPagesPath(contentPath) {
  return contentPath.replace(/^content\//, 'pages/').replace(/\.md$/, '.html');
}

// ────────────────────────────────────────────────────────────── render ──

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusChipClass(status) {
  return {
    verified: 'chip-verified',
    pending: 'chip-pending',
    unverified: 'chip-unverified',
    missing: 'chip-missing',
  }[status] || 'chip-missing';
}

function statusLabel(status) {
  return {
    verified: '审校过 verified',
    pending: '审校中 pending',
    unverified: '未审校 unverified',
    missing: '无标 missing',
  }[status] || 'missing';
}

const rowsHtml = needsReview
  .sort((a, b) => {
    // missing first, then unverified, pending, verified
    const order = { missing: 0, unverified: 1, pending: 2, verified: 3 };
    const ka = a[1].factual_review || 'missing';
    const kb = b[1].factual_review || 'missing';
    if (order[ka] !== order[kb]) return order[ka] - order[kb];
    return a[0].localeCompare(b[0]);
  })
  .map(([pagePath, r]) => {
    const status = r.factual_review || 'missing';
    const contentPath = pagePath.replace(/^pages\//, 'content/').replace(/\.html$/, '.md');
    const pageFindings = findingsByFile[contentPath] || [];
    const findingsHtml = pageFindings.map(f =>
      `<li class="f-${f.level.toLowerCase()}"><span class="f-level">${f.level}</span> ${escapeHtml(f.msg)}${f.context ? `<div class="f-ctx">${escapeHtml(f.context.slice(0, 200))}</div>` : ''}</li>`
    ).join('');
    const sourcesHtml = (r.factual_sources || []).length
      ? `<div class="p-sources">${(r.factual_sources).map(s => `<span class="src">${escapeHtml(s)}</span>`).join(' ')}</div>`
      : '';
    const title = r.char
      ? `${r.char} <span class="t-py">${escapeHtml(r.pinyin || '')}</span> — ${escapeHtml((r.title || '').replace(/^.*?·\s*/, ''))}`
      : escapeHtml(r.title || pagePath);
    return `
    <tr class="row-${status}" data-status="${status}" data-type="${r.type}">
      <td class="c-status"><span class="chip ${statusChipClass(status)}">${statusLabel(status)}</span></td>
      <td class="c-title">
        <a href="../${pagePath.replace(/^pages\//, '')}" target="_blank" rel="noopener" class="p-title">${title}</a>
        <div class="p-meta">${escapeHtml(r.type)} · ${escapeHtml(r.category)}${r.updated ? ' · updated ' + escapeHtml(r.updated) : ''}</div>
        ${sourcesHtml}
      </td>
      <td class="c-findings">
        ${pageFindings.length ? `<ul class="findings-list">${findingsHtml}</ul>` : '<span class="no-findings">—</span>'}
      </td>
      <td class="c-actions">
        <a class="action-link" href="https://github.com/HunterDellere/jiaoluo-shuwu/blob/main/${contentPath}" target="_blank" rel="noopener">edit source</a>
      </td>
    </tr>`;
  }).join('');

// Findings not tied to a specific content file (e.g. coverage warnings).
const globalFindings = findings.filter(f => !f.file.startsWith('content/'));

const globalFindingsHtml = globalFindings.length ? `
  <section class="admin-section">
    <h2>Global findings <span class="muted">(${globalFindings.length})</span></h2>
    <ul class="findings-list">
      ${globalFindings.map(f =>
        `<li class="f-${f.level.toLowerCase()}"><span class="f-level">${f.level}</span> <code>${escapeHtml(f.file)}</code> — ${escapeHtml(f.msg)}</li>`
      ).join('')}
    </ul>
  </section>` : '';

const html = `<!DOCTYPE html>
<!-- ADMIN: not indexed; not linked from public surfaces -->
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">
<title>Admin · Factual Review Dashboard · 角落書屋</title>
<link rel="stylesheet" href="../../style.css">
<style>
  body { font-family: var(--font-body, system-ui, sans-serif); background: var(--paper, #f5ede0); color: var(--ink-2, #2a2420); padding: 2rem 1.5rem; max-width: 1400px; margin: 0 auto; }
  .admin-header { border-bottom: 2px solid var(--rule, #c9bca4); padding-bottom: 1rem; margin-bottom: 2rem; }
  .admin-header h1 { font-family: var(--font-serif, serif); font-size: 1.6rem; margin: 0 0 0.3rem 0; letter-spacing: 0.02em; }
  .admin-header .subtitle { font-style: italic; color: var(--ink-4, #6b5f4f); font-size: 0.88rem; }
  .admin-header .meta { font-family: var(--font-mono, monospace); font-size: 0.72rem; color: var(--ink-5, #8a7e6d); margin-top: 0.4rem; }
  .counts { display: flex; gap: 0.7rem; margin: 1.5rem 0 2rem 0; flex-wrap: wrap; }
  .count-card { padding: 0.6rem 1rem; border: 1px solid var(--rule, #c9bca4); border-radius: 3px; min-width: 110px; }
  .count-card .n { font-size: 1.6rem; font-weight: 600; font-family: var(--font-mono, monospace); line-height: 1; }
  .count-card .l { font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-4, #6b5f4f); margin-top: 0.3rem; }
  .count-card.cc-verified { border-left: 3px solid #3a7a4a; }
  .count-card.cc-pending { border-left: 3px solid #b78d3f; }
  .count-card.cc-unverified { border-left: 3px solid #a33a2a; }
  .count-card.cc-missing { border-left: 3px solid #8a7e6d; }
  .count-card.cc-err { border-left: 3px solid #a33a2a; color: #a33a2a; }
  .count-card.cc-warn { border-left: 3px solid #b78d3f; }
  .admin-section { margin-bottom: 2.5rem; }
  .admin-section h2 { font-size: 1.05rem; border-bottom: 1px solid var(--rule, #c9bca4); padding-bottom: 0.4rem; margin-bottom: 0.8rem; font-family: var(--font-serif, serif); }
  .muted { color: var(--ink-5, #8a7e6d); font-weight: normal; font-size: 0.82rem; }
  table.review-table { border-collapse: collapse; width: 100%; font-size: 0.82rem; }
  table.review-table th, table.review-table td { padding: 0.5rem 0.7rem; text-align: left; vertical-align: top; border-bottom: 1px solid var(--rule, #c9bca4); }
  table.review-table th { font-size: 0.7rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-5, #8a7e6d); background: transparent; }
  .c-status { width: 120px; white-space: nowrap; }
  .c-title { max-width: 400px; }
  .c-findings { max-width: 600px; }
  .c-actions { width: 100px; white-space: nowrap; }
  .chip { display: inline-block; padding: 0.15rem 0.55rem; border-radius: 2px; font-size: 0.7rem; letter-spacing: 0.05em; font-family: var(--font-mono, monospace); border: 1px solid; }
  .chip-verified { color: #3a7a4a; border-color: #3a7a4a; }
  .chip-pending { color: #b78d3f; border-color: #b78d3f; }
  .chip-unverified { color: #a33a2a; border-color: #a33a2a; }
  .chip-missing { color: #8a7e6d; border-color: #8a7e6d; }
  .p-title { font-family: var(--font-serif, serif); font-size: 0.95rem; color: var(--ink-2, #2a2420); text-decoration: none; border-bottom: 1px dotted var(--rule, #c9bca4); }
  .p-title:hover { border-bottom-style: solid; }
  .t-py { font-style: italic; font-family: var(--font-body, serif); font-size: 0.82rem; color: var(--ink-4, #6b5f4f); }
  .p-meta { font-size: 0.72rem; color: var(--ink-5, #8a7e6d); margin-top: 0.25rem; font-family: var(--font-mono, monospace); letter-spacing: 0.04em; }
  .p-sources { margin-top: 0.3rem; }
  .p-sources .src { display: inline-block; padding: 0.1rem 0.4rem; font-size: 0.68rem; background: color-mix(in srgb, #3a7a4a 10%, transparent); color: #3a7a4a; margin-right: 0.3rem; border-radius: 2px; font-family: var(--font-mono, monospace); }
  .findings-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.3rem; }
  .findings-list li { padding: 0.35rem 0.5rem; border-left: 2px solid; font-size: 0.78rem; line-height: 1.4; }
  .findings-list li.f-error { border-left-color: #a33a2a; background: color-mix(in srgb, #a33a2a 5%, transparent); }
  .findings-list li.f-warn  { border-left-color: #b78d3f; background: color-mix(in srgb, #b78d3f 5%, transparent); }
  .findings-list li.f-info  { border-left-color: var(--rule, #c9bca4); }
  .f-level { display: inline-block; font-family: var(--font-mono, monospace); font-size: 0.65rem; font-weight: 600; letter-spacing: 0.1em; margin-right: 0.4rem; }
  .f-error .f-level { color: #a33a2a; }
  .f-warn  .f-level { color: #b78d3f; }
  .f-ctx { font-family: var(--font-mono, monospace); font-size: 0.7rem; color: var(--ink-4, #6b5f4f); margin-top: 0.25rem; padding-left: 0.5rem; border-left: 1px solid var(--rule, #c9bca4); }
  .no-findings { color: var(--ink-5, #8a7e6d); font-family: var(--font-mono, monospace); font-size: 0.8rem; }
  .action-link { font-size: 0.72rem; color: var(--ink-4, #6b5f4f); font-family: var(--font-mono, monospace); text-decoration: none; border-bottom: 1px dotted var(--rule, #c9bca4); }
  .action-link:hover { border-bottom-style: solid; }
  .filters { display: flex; gap: 0.6rem; margin-bottom: 0.8rem; font-size: 0.8rem; align-items: center; flex-wrap: wrap; }
  .filters label { cursor: pointer; }
  .filters input[type="text"] { padding: 0.3rem 0.5rem; border: 1px solid var(--rule, #c9bca4); font-family: var(--font-mono, monospace); font-size: 0.8rem; background: transparent; color: inherit; }
  .filters select { padding: 0.3rem 0.5rem; border: 1px solid var(--rule, #c9bca4); background: transparent; font-family: var(--font-mono, monospace); font-size: 0.8rem; }
  code { font-family: var(--font-mono, monospace); background: color-mix(in srgb, var(--ink-4, #6b5f4f) 8%, transparent); padding: 0.1rem 0.3rem; border-radius: 2px; font-size: 0.8rem; }
</style>
</head>
<body>
  <header class="admin-header">
    <h1>审校台 · Factual Review Dashboard</h1>
    <div class="subtitle">Not publicly linked. Bookmark this URL.</div>
    <div class="meta">generated ${escapeHtml(generated)} · ${summary.errors} errors, ${summary.warnings} warnings · ${needsReview.length} reviewable pages</div>
  </header>

  <section class="admin-section">
    <div class="counts">
      <div class="count-card cc-verified"><div class="n">${counts.verified}</div><div class="l">verified</div></div>
      <div class="count-card cc-pending"><div class="n">${counts.pending}</div><div class="l">pending</div></div>
      <div class="count-card cc-unverified"><div class="n">${counts.unverified}</div><div class="l">unverified</div></div>
      <div class="count-card cc-missing"><div class="n">${counts.missing}</div><div class="l">missing</div></div>
      <div class="count-card cc-err"><div class="n">${summary.errors}</div><div class="l">errors</div></div>
      <div class="count-card cc-warn"><div class="n">${summary.warnings}</div><div class="l">warnings</div></div>
    </div>
  </section>

  ${globalFindingsHtml}

  <section class="admin-section">
    <h2>Pages <span class="muted">(${needsReview.length} reviewable)</span></h2>
    <div class="filters">
      <label>Status
        <select id="filter-status">
          <option value="">all</option>
          <option value="missing">missing</option>
          <option value="unverified">unverified</option>
          <option value="pending">pending</option>
          <option value="verified">verified</option>
        </select>
      </label>
      <label>Type
        <select id="filter-type">
          <option value="">all</option>
          <option value="character">character</option>
          <option value="vocab">vocab</option>
        </select>
      </label>
      <label>Only with findings <input type="checkbox" id="filter-findings"></label>
      <label>Search <input type="text" id="filter-search" placeholder="char, pinyin, title…"></label>
    </div>
    <table class="review-table">
      <thead>
        <tr><th>Status</th><th>Page</th><th>Validator findings</th><th>Action</th></tr>
      </thead>
      <tbody id="review-rows">
        ${rowsHtml}
      </tbody>
    </table>
  </section>

  <script>
    (function() {
      const rows = Array.from(document.querySelectorAll('#review-rows tr'));
      const fStatus = document.getElementById('filter-status');
      const fType = document.getElementById('filter-type');
      const fFindings = document.getElementById('filter-findings');
      const fSearch = document.getElementById('filter-search');
      function apply() {
        const s = fStatus.value, t = fType.value;
        const onlyF = fFindings.checked;
        const q = fSearch.value.trim().toLowerCase();
        for (const r of rows) {
          let show = true;
          if (s && r.dataset.status !== s) show = false;
          if (t && r.dataset.type !== t) show = false;
          if (onlyF && !r.querySelector('.findings-list')) show = false;
          if (q && !r.textContent.toLowerCase().includes(q)) show = false;
          r.style.display = show ? '' : 'none';
        }
      }
      [fStatus, fType, fFindings, fSearch].forEach(el => el.addEventListener('input', apply));
    })();
  </script>
</body>
</html>
`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, html);
console.log(`✓ admin: pages/_admin/review.html (${(counts.pending + counts.missing + counts.unverified)} items needing review)`);
