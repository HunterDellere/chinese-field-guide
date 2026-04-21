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
 * Also reachable via 5-tap gesture on the 書屋 glyph on the homepage.
 *
 * Run: node build/build-admin.mjs   (also triggered by `npm run build`)
 */

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const entriesPath  = path.join(ROOT, 'data', 'entries.json');
const findingsPath = path.join(ROOT, 'data', '_admin', 'findings.json');
const outDir  = path.join(ROOT, 'pages', '_admin');
const outPath = path.join(outDir, 'review.html');

if (!fs.existsSync(entriesPath)) {
  console.error('build-admin: data/entries.json missing — run `npm run build` first.');
  process.exit(1);
}

// findings.json may not exist yet (first run). Use empty scaffold.
let generated = new Date().toISOString();
let summary   = { errors: 0, warnings: 0, info: 0 };
let findings  = [];
if (fs.existsSync(findingsPath)) {
  try {
    const raw = JSON.parse(fs.readFileSync(findingsPath, 'utf8'));
    generated = raw.generated || generated;
    summary   = raw.summary   || summary;
    findings  = raw.findings  || [];
  } catch { /* scaffold already set */ }
}

const entries = JSON.parse(fs.readFileSync(entriesPath, 'utf8'));

// ── Supplemental frontmatter (factual_review, factual_sources) ──────────────
const review = {};
for (const e of entries) {
  const src = path.join(ROOT, e.path.replace(/^pages\//, 'content/').replace(/\.html$/, '.md'));
  if (!fs.existsSync(src)) continue;
  const { data: fm } = matter(fs.readFileSync(src, 'utf8'));
  review[e.path] = {
    factual_review:   fm.factual_review   || null,
    factual_sources:  fm.factual_sources  || [],
    status:   fm.status,
    type:     fm.type,
    category: fm.category,
    title:    fm.title || e.title || e.path,
    updated:  fm.updated,
    char:     fm.char,
    pinyin:   fm.pinyin,
    tags:     fm.tags || [],
    desc:     fm.desc || '',
  };
}

// ── Factual-review state counts ──────────────────────────────────────────────
const reviewable = Object.entries(review).filter(([, r]) =>
  r.status === 'complete' && (r.type === 'character' || r.type === 'vocab')
);
const stateCounts = { verified: 0, pending: 0, unverified: 0, missing: 0 };
for (const [, r] of reviewable) {
  const s = r.factual_review || 'missing';
  stateCounts[s in stateCounts ? s : 'missing']++;
}

// ── Group findings by file ──────────────────────────────────────────────────
const findingsByFile = {};
for (const f of findings) {
  const k = f.file || '_global';
  if (!findingsByFile[k]) findingsByFile[k] = [];
  findingsByFile[k].push(f);
}

// ── Per-category finding counts ──────────────────────────────────────────────
const catCounts = {};
for (const f of findings) {
  catCounts[f.category] = catCounts[f.category] || { ERROR: 0, WARN: 0, INFO: 0 };
  catCounts[f.category][f.level] = (catCounts[f.category][f.level] || 0) + 1;
}

// ── Inbound links index ──────────────────────────────────────────────────────
// For each entry, collect which other entries have it in their related list.
const inbound = {}; // pagePath → Set of pager paths that link to it
for (const e of entries) {
  for (const rel of (e.related || [])) {
    const target = rel.startsWith('pages/') ? rel : `pages/${rel}.html`;
    if (!inbound[target]) inbound[target] = new Set();
    inbound[target].add(e.path);
  }
}

// ── Findings per category ordered for the tab list ──────────────────────────
const TAB_DEFS = [
  { id: 'needs-review', label: '⚑ Needs Review',    categories: null }, // special: all ERRORs + review state issues
  { id: 'factual',      label: '验 Factual',          categories: ['factual'] },
  { id: 'schema',       label: '⬡ Schema & Tags',     categories: ['schema', 'tags'] },
  { id: 'links',        label: '⇄ Links & Anchors',   categories: ['links', 'anchors', 'orphans'] },
  { id: 'layout',       label: '▤ Layout',             categories: ['layout', 'hub-members'] },
  { id: 'health',       label: '⊕ Content Health',    categories: ['content-health'] },
  { id: 'relations',    label: '⬡ Relations',          categories: ['relations'] },
  { id: 'search',       label: '⌕ Search',             categories: ['search'] },
  { id: 'formatting',   label: '¶ Formatting',         categories: ['formatting'] },
  { id: 'analytics',    label: '⊘ Analytics',          categories: null }, // special panel
];

// ── HTML helpers ─────────────────────────────────────────────────────────────

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function statusChipHtml(status) {
  const classes = {
    verified: 'chip-verified', pending: 'chip-pending',
    unverified: 'chip-unverified', missing: 'chip-missing',
  };
  const labels = {
    verified: '审校过 verified', pending: '审校中 pending',
    unverified: '未审校 unverified', missing: '无标 missing',
  };
  const cls = classes[status] || 'chip-missing';
  const lbl = labels[status] || 'missing';
  return `<span class="chip ${cls}">${lbl}</span>`;
}

function levelBadge(level) {
  return `<span class="lvl lvl-${level.toLowerCase()}">${esc(level)}</span>`;
}

function findingItemHtml(f) {
  let h = `<li class="fi fi-${f.level.toLowerCase()}" data-category="${esc(f.category || '')}" data-level="${esc(f.level)}">`;
  h += `${levelBadge(f.level)} <span class="fi-msg">${esc(f.msg)}</span>`;
  if (f.fix)     h += `<div class="fi-fix">→ ${esc(f.fix)}</div>`;
  if (f.context) h += `<div class="fi-ctx">${esc(String(f.context).slice(0, 200))}</div>`;
  if (f.line)    h += `<div class="fi-line">line ${f.line}</div>`;
  h += '</li>';
  return h;
}

// ── Build the drawer data blob (one JSON entry per page) ─────────────────────
// This is embedded in the HTML as a <script type="application/json"> so the
// drawer is purely client-side with no additional fetches.
const drawerData = {};
for (const e of entries) {
  const r = review[e.path] || {};
  const allFindings = [];
  // Collect findings keyed by this page (content path or pages path)
  const contentRel = e.path.replace(/^pages\//, 'content/').replace(/\.html$/, '.md');
  for (const key of [contentRel, e.path]) {
    for (const f of (findingsByFile[key] || [])) allFindings.push(f);
  }
  const inboundLinks = [...(inbound[e.path] || [])];
  drawerData[e.path] = {
    title:     r.title || e.title || e.path,
    char:      r.char,
    pinyin:    r.pinyin,
    type:      r.type || e.type,
    category:  r.category || e.category,
    status:    r.status || e.status,
    updated:   r.updated || e.updated,
    tags:      r.tags || e.tags || [],
    desc:      r.desc || e.desc || '',
    factual_review:  r.factual_review,
    factual_sources: r.factual_sources || [],
    findings:  allFindings,
    inbound:   inboundLinks,
  };
}

// ── Global findings (not tied to a content/pages file) ──────────────────────
const globalFindings = findings.filter(f =>
  !f.file.startsWith('content/') && !f.file.startsWith('pages/')
);

// ── Build per-tab rows ────────────────────────────────────────────────────────

function pageRowHtml(pagePath, r, rowFindings, includeState = false) {
  const status = r.factual_review || 'missing';
  const contentPath = pagePath.replace(/^pages\//, 'content/').replace(/\.html$/, '.md');
  const findingsHtml = rowFindings.length
    ? `<ul class="findings-list">${rowFindings.map(findingItemHtml).join('')}</ul>`
    : '<span class="no-findings">—</span>';
  const sourcesHtml = (r.factual_sources || []).length
    ? `<div class="p-sources">${r.factual_sources.map(s => `<span class="src">${esc(s)}</span>`).join(' ')}</div>`
    : '';
  const titleHtml = r.char
    ? `${esc(r.char)} <span class="t-py">${esc(r.pinyin || '')}</span> — ${esc((r.title || '').replace(/^.*?·\s*/, ''))}`
    : esc(r.title || pagePath);
  const pageRelHref = pagePath.replace(/^pages\//, '../');
  const ageDays = r.updated ? Math.round((Date.now() - new Date(r.updated)) / 86400000) : null;
  const ageStr  = ageDays !== null ? `${ageDays}d ago` : '';

  return `<tr class="row row-${esc(r.status || 'complete')}"
    data-status="${esc(r.factual_review || 'missing')}"
    data-type="${esc(r.type || '')}"
    data-category="${esc(r.category || '')}"
    data-level="${esc(rowFindings.length ? rowFindings.reduce((m, f) => { const o={ERROR:3,WARN:2,INFO:1}; return o[f.level]>o[m]?f.level:m; }, 'INFO') : '')}"
    data-age="${ageDays !== null ? ageDays : 9999}"
    data-path="${esc(pagePath)}"
    data-title="${esc(r.title || pagePath)}"
    role="button" tabindex="0" onclick="openDrawer('${pagePath.replace(/'/g, "\\'")}')" onkeydown="if(event.key==='Enter')openDrawer('${pagePath.replace(/'/g, "\\'")}')">
    ${includeState ? `<td class="c-state">${statusChipHtml(status)}</td>` : ''}
    <td class="c-title">
      <a href="${esc(pageRelHref)}" target="_blank" rel="noopener" class="p-title" onclick="event.stopPropagation()">${titleHtml}</a>
      <div class="p-meta">${esc(r.type || '')} · ${esc(r.category || '')}${r.updated ? ` · ${esc(r.updated)}` : ''}${ageStr ? ` <span class="p-age">(${esc(ageStr)})</span>` : ''}</div>
      ${sourcesHtml}
    </td>
    <td class="c-findings">${findingsHtml}</td>
    <td class="c-actions">
      <a class="action-link" href="https://github.com/HunterDellere/jiaoluo-shuwu/blob/main/${esc(contentPath)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">edit↗</a>
    </td>
  </tr>`;
}

// ── Tab: Needs Review ─────────────────────────────────────────────────────────
// Combines: review state issues (missing/unverified/pending) + any ERROR finding across all categories
const needsReviewEntries = reviewable
  .filter(([, r]) => (r.factual_review || 'missing') !== 'verified')
  .sort((a, b) => {
    const order = { missing: 0, unverified: 1, pending: 2 };
    const ka = a[1].factual_review || 'missing';
    const kb = b[1].factual_review || 'missing';
    if (order[ka] !== order[kb]) return order[ka] - order[kb];
    return a[0].localeCompare(b[0]);
  });

// Also entries with any ERROR finding (not already in the reviewable list)
const errorPaths = new Set();
for (const f of findings.filter(f => f.level === 'ERROR')) {
  // Map content path → pages path
  const pagesPath = f.file.startsWith('content/')
    ? f.file.replace(/^content\//, 'pages/').replace(/\.md$/, '.html')
    : f.file;
  if (entries.find(e => e.path === pagesPath)) errorPaths.add(pagesPath);
}
const needsReviewRows = needsReviewEntries.map(([p, r]) => {
  const contentPath = p.replace(/^pages\//, 'content/').replace(/\.html$/, '.md');
  const rowFindings = [...(findingsByFile[contentPath] || []), ...(findingsByFile[p] || [])];
  return pageRowHtml(p, r, rowFindings, true);
}).join('');

const errorOnlyRows = [...errorPaths]
  .filter(p => !needsReviewEntries.some(([ep]) => ep === p))
  .map(p => {
    const r = review[p] || {};
    const contentPath = p.replace(/^pages\//, 'content/').replace(/\.html$/, '.md');
    const rowFindings = [...(findingsByFile[contentPath] || []), ...(findingsByFile[p] || [])];
    return pageRowHtml(p, r, rowFindings.filter(f => f.level === 'ERROR'), false);
  }).join('');

// ── Tab builder for finding categories ───────────────────────────────────────
function buildCategoryTabRows(categories) {
  // Gather all content paths that have findings in these categories
  const catSet = new Set(categories);
  const pathsWithFindings = new Set();
  const globalInTab = [];
  for (const f of findings) {
    if (!catSet.has(f.category)) continue;
    if (f.file.startsWith('content/') || f.file.startsWith('pages/')) {
      const pagesPath = f.file.startsWith('content/')
        ? f.file.replace(/^content\//, 'pages/').replace(/\.md$/, '.html')
        : f.file;
      // Only treat as a page row if there's a real entry backing it
      if (entries.find(e => e.path === pagesPath)) {
        pathsWithFindings.add(pagesPath);
      } else {
        globalInTab.push(f);
      }
    } else {
      globalInTab.push(f);
    }
  }

  let rows = [...pathsWithFindings].map(p => {
    const r = review[p] || entries.find(e => e.path === p) || {};
    const contentPath = p.replace(/^pages\//, 'content/').replace(/\.html$/, '.md');
    const rowFindings = [
      ...(findingsByFile[contentPath] || []),
      ...(findingsByFile[p] || []),
    ].filter(f => catSet.has(f.category));
    // Use entry review data if we have it, otherwise build minimal stub
    const rData = review[p] || {
      title: p, type: r.type || '', category: r.category || '',
      updated: r.updated, factual_review: null,
    };
    return pageRowHtml(p, rData, rowFindings, false);
  }).join('');

  let globalHtml = '';
  if (globalInTab.length > 0) {
    globalHtml = `<div class="global-findings">
      <h3 class="global-findings-title">Global / reference findings</h3>
      <ul class="findings-list">${globalInTab.map(findingItemHtml).join('')}</ul>
    </div>`;
  }
  return { rows, globalHtml, count: pathsWithFindings.size + globalInTab.length };
}

// Build all tab content
const tabContents = {};
for (const tab of TAB_DEFS) {
  if (tab.id === 'needs-review' || tab.id === 'analytics') continue;
  tabContents[tab.id] = buildCategoryTabRows(tab.categories);
}

// ── Category chip strip ───────────────────────────────────────────────────────
const categoryChipsHtml = TAB_DEFS
  .filter(t => t.id !== 'needs-review' && t.id !== 'analytics')
  .map(t => {
    const cats = t.categories || [];
    const total = cats.reduce((sum, c) => {
      const cc = catCounts[c] || {};
      return sum + (cc.ERROR || 0) + (cc.WARN || 0) + (cc.INFO || 0);
    }, 0);
    const errs = cats.reduce((sum, c) => sum + ((catCounts[c] || {}).ERROR || 0), 0);
    const cls = errs > 0 ? 'cat-chip cat-chip-err' : total > 0 ? 'cat-chip cat-chip-warn' : 'cat-chip cat-chip-ok';
    return `<button class="${cls}" onclick="showTab('${t.id}')" title="${esc(t.label)}">${esc(t.label.replace(/^[^ ]+ /, ''))} <span class="cat-chip-n">${total}</span></button>`;
  }).join('');

// ── SHA-256 passphrase hash ───────────────────────────────────────────────────
const ADMIN_KEY_HASH = '2092bbb3fd73f990c9d5d51a985634263ba212436a087ce4394461ea8704a4bf';

// ── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
  :root {
    --adm-bg:    #f5ede0;
    --adm-ink:   #2a2420;
    --adm-ink2:  #6b5f4f;
    --adm-ink3:  #8a7e6d;
    --adm-rule:  #c9bca4;
    --adm-red:   #a33a2a;
    --adm-amber: #b78d3f;
    --adm-green: #3a7a4a;
    --adm-blue:  #2a5a8a;
    --adm-mono:  'Noto Sans Mono', 'Inconsolata', monospace;
    --adm-serif: 'Cormorant Garamond', 'Noto Serif SC', serif;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: var(--adm-bg); color: var(--adm-ink); font-size: 14px; line-height: 1.5; }
  a { color: inherit; }

  /* ── Layout ── */
  .adm-wrap { max-width: 1440px; margin: 0 auto; padding: 1.5rem; }
  .adm-header { border-bottom: 2px solid var(--adm-rule); padding-bottom: 1rem; margin-bottom: 1.25rem; display: flex; align-items: flex-start; gap: 1rem; flex-wrap: wrap; }
  .adm-header h1 { font-family: var(--adm-serif); font-size: 1.45rem; letter-spacing: 0.02em; }
  .adm-header .sub { font-style: italic; color: var(--adm-ink2); font-size: 0.82rem; }
  .adm-header .meta { font-family: var(--adm-mono); font-size: 0.7rem; color: var(--adm-ink3); }
  .adm-header-right { margin-left: auto; text-align: right; }
  .adm-lock-out { font-family: var(--adm-mono); font-size: 0.72rem; color: var(--adm-ink3); cursor: pointer; border-bottom: 1px dotted var(--adm-rule); }

  /* ── Summary strip ── */
  .summary-strip { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.25rem; }
  .sum-section { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .sum-section + .sum-section { padding-left: 0.75rem; border-left: 1px solid var(--adm-rule); }
  .count-card { min-width: 80px; padding: 0.5rem 0.8rem; border: 1px solid var(--adm-rule); border-radius: 3px; cursor: default; }
  .count-card .n { font-size: 1.5rem; font-weight: 600; font-family: var(--adm-mono); line-height: 1; }
  .count-card .l { font-size: 0.65rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--adm-ink2); margin-top: 0.2rem; }
  .count-card.cc-verified   { border-left: 3px solid var(--adm-green); }
  .count-card.cc-pending    { border-left: 3px solid var(--adm-amber); }
  .count-card.cc-unverified { border-left: 3px solid var(--adm-red);   }
  .count-card.cc-missing    { border-left: 3px solid var(--adm-ink3);  }
  .count-card.cc-err        { border-left: 3px solid var(--adm-red);   color: var(--adm-red); }
  .count-card.cc-warn       { border-left: 3px solid var(--adm-amber); }
  .count-card.cc-info       { border-left: 3px solid var(--adm-rule);  }

  /* ── Category chip strip ── */
  .cat-chips { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 1.25rem; }
  .cat-chip { font-family: var(--adm-mono); font-size: 0.72rem; padding: 0.2rem 0.5rem; border-radius: 2px; border: 1px solid; cursor: pointer; background: transparent; }
  .cat-chip-err  { color: var(--adm-red);   border-color: var(--adm-red);   }
  .cat-chip-warn { color: var(--adm-amber); border-color: var(--adm-amber); }
  .cat-chip-ok   { color: var(--adm-ink3);  border-color: var(--adm-rule);  }
  .cat-chip .cat-chip-n { font-size: 0.65rem; opacity: 0.8; }
  .cat-chip:hover { opacity: 0.8; }

  /* ── Tabs ── */
  .tabs { display: flex; gap: 0; border-bottom: 1px solid var(--adm-rule); margin-bottom: 1rem; flex-wrap: wrap; }
  .tab-btn { font-size: 0.78rem; padding: 0.45rem 0.9rem; border: none; background: transparent; cursor: pointer; color: var(--adm-ink2); border-bottom: 2px solid transparent; margin-bottom: -1px; font-family: inherit; }
  .tab-btn:hover { color: var(--adm-ink); }
  .tab-btn.active { color: var(--adm-ink); border-bottom-color: var(--adm-ink); font-weight: 600; }
  .tab-panel { display: none; }
  .tab-panel.active { display: block; }

  /* ── Filter bar ── */
  .filter-bar { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; margin-bottom: 0.75rem; font-size: 0.8rem; }
  .filter-bar label { display: flex; align-items: center; gap: 0.3rem; }
  .filter-bar select, .filter-bar input[type="text"] {
    padding: 0.25rem 0.45rem; border: 1px solid var(--adm-rule);
    background: transparent; color: inherit; font-family: var(--adm-mono);
    font-size: 0.78rem; }
  .filter-bar input[type="text"] { width: 180px; }
  .filter-bar .filter-count { font-family: var(--adm-mono); font-size: 0.72rem; color: var(--adm-ink3); }
  .filter-actions { display: flex; gap: 0.4rem; margin-left: auto; }
  .filter-actions button { font-size: 0.72rem; padding: 0.25rem 0.55rem; border: 1px solid var(--adm-rule); background: transparent; cursor: pointer; font-family: var(--adm-mono); color: inherit; }
  .filter-actions button:hover { background: rgba(0,0,0,0.04); }

  /* ── Table ── */
  .review-table { border-collapse: collapse; width: 100%; font-size: 0.82rem; }
  .review-table th, .review-table td { padding: 0.45rem 0.65rem; text-align: left; vertical-align: top; border-bottom: 1px solid var(--adm-rule); }
  .review-table th { font-size: 0.65rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--adm-ink3); cursor: pointer; user-select: none; white-space: nowrap; }
  .review-table th:hover { color: var(--adm-ink); }
  .review-table th .sort-arrow { opacity: 0.4; }
  .review-table th.sort-asc .sort-arrow::after { content: ' ↑'; }
  .review-table th.sort-desc .sort-arrow::after { content: ' ↓'; }
  .review-table tr.row { cursor: pointer; }
  .review-table tr.row:hover td { background: rgba(0,0,0,0.025); }
  .review-table tr.row.resolved { opacity: 0.4; }
  .review-table tr.row.resolved td { text-decoration: line-through; }
  .c-state   { width: 110px; white-space: nowrap; }
  .c-title   { max-width: 380px; }
  .c-findings { max-width: 580px; }
  .c-actions { width: 80px; white-space: nowrap; }
  .no-rows { padding: 1rem 0; color: var(--adm-ink3); font-family: var(--adm-mono); font-size: 0.82rem; }

  /* ── State chips ── */
  .chip { display: inline-block; padding: 0.12rem 0.45rem; border-radius: 2px; font-size: 0.68rem; letter-spacing: 0.05em; font-family: var(--adm-mono); border: 1px solid; }
  .chip-verified   { color: var(--adm-green); border-color: var(--adm-green); }
  .chip-pending    { color: var(--adm-amber); border-color: var(--adm-amber); }
  .chip-unverified { color: var(--adm-red);   border-color: var(--adm-red);   }
  .chip-missing    { color: var(--adm-ink3);  border-color: var(--adm-rule);  }

  /* ── Page title cell ── */
  .p-title { font-family: var(--adm-serif); font-size: 0.92rem; color: var(--adm-ink); text-decoration: none; border-bottom: 1px dotted var(--adm-rule); }
  .p-title:hover { border-bottom-style: solid; }
  .t-py { font-style: italic; font-size: 0.78rem; color: var(--adm-ink2); }
  .p-meta { font-size: 0.68rem; color: var(--adm-ink3); margin-top: 0.2rem; font-family: var(--adm-mono); }
  .p-age  { font-size: 0.65rem; color: var(--adm-ink3); }
  .p-sources { margin-top: 0.25rem; }
  .p-sources .src { display: inline-block; padding: 0.08rem 0.35rem; font-size: 0.65rem; background: rgba(58,122,74,0.1); color: var(--adm-green); margin-right: 0.25rem; border-radius: 2px; font-family: var(--adm-mono); }

  /* ── Finding items ── */
  .findings-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; }
  .fi { padding: 0.3rem 0.45rem; border-left: 2px solid; font-size: 0.76rem; line-height: 1.4; }
  .fi-error { border-left-color: var(--adm-red);   background: rgba(163,58,42,0.04); }
  .fi-warn  { border-left-color: var(--adm-amber); background: rgba(183,141,63,0.04); }
  .fi-info  { border-left-color: var(--adm-rule); }
  .lvl { font-family: var(--adm-mono); font-size: 0.62rem; font-weight: 700; letter-spacing: 0.1em; margin-right: 0.35rem; }
  .lvl-error { color: var(--adm-red);   }
  .lvl-warn  { color: var(--adm-amber); }
  .lvl-info  { color: var(--adm-ink3);  }
  .fi-fix  { font-size: 0.72rem; color: var(--adm-green); margin-top: 0.2rem; padding-left: 0.5rem; }
  .fi-ctx  { font-family: var(--adm-mono); font-size: 0.7rem; color: var(--adm-ink2); margin-top: 0.2rem; padding-left: 0.5rem; border-left: 1px solid var(--adm-rule); }
  .fi-line { font-family: var(--adm-mono); font-size: 0.65rem; color: var(--adm-ink3); margin-top: 0.15rem; }
  .no-findings { color: var(--adm-ink3); font-family: var(--adm-mono); font-size: 0.78rem; }
  .action-link { font-size: 0.7rem; color: var(--adm-ink3); font-family: var(--adm-mono); text-decoration: none; border-bottom: 1px dotted var(--adm-rule); }
  .action-link:hover { border-bottom-style: solid; }

  /* ── Global findings ── */
  .global-findings { margin-bottom: 1.5rem; padding: 0.75rem; border: 1px solid var(--adm-rule); }
  .global-findings-title { font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--adm-ink3); margin-bottom: 0.5rem; }

  /* ── Drawer ── */
  .drawer-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.2); z-index: 100; }
  .drawer-overlay.open { display: block; }
  .drawer { position: fixed; top: 0; right: 0; bottom: 0; width: min(640px, 100vw); background: var(--adm-bg); border-left: 1px solid var(--adm-rule); overflow-y: auto; z-index: 101; padding: 1.5rem; transform: translateX(100%); transition: transform 0.18s ease; }
  .drawer.open { transform: translateX(0); }
  .drawer-close { float: right; font-size: 1.1rem; background: none; border: none; cursor: pointer; color: var(--adm-ink3); line-height: 1; padding: 0.2rem; }
  .drawer-close:hover { color: var(--adm-ink); }
  .drawer-title { font-family: var(--adm-serif); font-size: 1.2rem; margin-bottom: 0.25rem; }
  .drawer-meta { font-family: var(--adm-mono); font-size: 0.7rem; color: var(--adm-ink3); margin-bottom: 1rem; }
  .drawer-section { margin-bottom: 1.25rem; }
  .drawer-section h3 { font-size: 0.7rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--adm-ink3); margin-bottom: 0.5rem; padding-bottom: 0.25rem; border-bottom: 1px solid var(--adm-rule); }
  .drawer-kv { display: grid; grid-template-columns: 130px 1fr; gap: 0.2rem 0.5rem; font-size: 0.8rem; }
  .dk { color: var(--adm-ink3); font-family: var(--adm-mono); font-size: 0.72rem; }
  .dv { word-break: break-word; }
  .drawer-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.75rem; }
  .dact { font-size: 0.75rem; padding: 0.3rem 0.65rem; border: 1px solid var(--adm-rule); background: transparent; cursor: pointer; font-family: var(--adm-mono); color: inherit; border-radius: 2px; text-decoration: none; }
  .dact:hover { background: rgba(0,0,0,0.04); }
  .dact-resolve { border-color: var(--adm-green); color: var(--adm-green); }
  .inbound-list, .outbound-list { list-style: none; display: flex; flex-direction: column; gap: 0.2rem; }
  .inbound-list a, .outbound-list a { font-size: 0.8rem; color: var(--adm-ink); text-decoration: none; border-bottom: 1px dotted var(--adm-rule); }
  .tag-list { display: flex; flex-wrap: wrap; gap: 0.3rem; }
  .tag-pill { font-family: var(--adm-mono); font-size: 0.7rem; padding: 0.1rem 0.35rem; border: 1px solid var(--adm-rule); border-radius: 2px; color: var(--adm-ink2); }

  /* ── Analytics tab ── */
  .analytics-panel { padding: 1rem; border: 1px solid var(--adm-rule); max-width: 600px; }
  .analytics-panel h3 { font-family: var(--adm-serif); font-size: 1rem; margin-bottom: 0.75rem; }
  .analytics-panel p { font-size: 0.82rem; line-height: 1.6; margin-bottom: 0.6rem; color: var(--adm-ink2); }
  .analytics-panel code { font-family: var(--adm-mono); background: rgba(0,0,0,0.05); padding: 0.1rem 0.3rem; font-size: 0.78rem; }

  /* ── Resolved badge ── */
  .resolved-badge { font-family: var(--adm-mono); font-size: 0.65rem; color: var(--adm-green); margin-left: 0.4rem; }

  /* ── Misc ── */
  code { font-family: var(--adm-mono); background: rgba(0,0,0,0.05); padding: 0.1rem 0.28rem; border-radius: 2px; font-size: 0.8rem; }
  #admin-root { display: none; }
  .kbd { display: inline-block; font-family: var(--adm-mono); font-size: 0.7rem; padding: 0.1rem 0.3rem; border: 1px solid var(--adm-rule); border-radius: 2px; }
`;

// ── JS (all inline, no external deps) ────────────────────────────────────────
const JS = `
// ── Resolved state (localStorage) ──────────────────────────────────────────
function resolvedKey() { return 'shuwu_resolved_v1'; }
function loadResolved() {
  try { return JSON.parse(localStorage.getItem(resolvedKey()) || '{}'); } catch { return {}; }
}
function saveResolved(r) {
  try { localStorage.setItem(resolvedKey(), JSON.stringify(r)); } catch {}
}
function isResolved(path) { return !!loadResolved()[path]; }

function markResolved(path, note) {
  const r = loadResolved();
  r[path] = { ts: new Date().toISOString(), note: note || '' };
  saveResolved(r);
  refreshResolvedUI();
}
function markUnresolved(path) {
  const r = loadResolved();
  delete r[path];
  saveResolved(r);
  refreshResolvedUI();
}
function refreshResolvedUI() {
  const r = loadResolved();
  const cb = document.getElementById('show-resolved-global');
  const showResolved = cb && cb.checked;
  document.querySelectorAll('tr.row[data-path]').forEach(function(row) {
    const p = row.dataset.path;
    if (r[p]) {
      row.classList.add('resolved');
      if (!showResolved) row.style.display = 'none';
    } else {
      row.classList.remove('resolved');
    }
  });
  updateRowCounts();
}

// ── Tab switching ────────────────────────────────────────────────────────────
function showTab(id) {
  document.querySelectorAll('.tab-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.tab === id);
  });
  document.querySelectorAll('.tab-panel').forEach(function(p) {
    p.classList.toggle('active', p.id === 'tab-' + id);
  });
  currentTab = id;
  updateRowCounts();
}

var currentTab = 'needs-review';

// ── Filter (per-tab) ─────────────────────────────────────────────────────────
function applyFilters(tabId) {
  var panel   = document.getElementById('tab-' + tabId);
  if (!panel) return;
  var fStatus   = panel.querySelector('.f-status');
  var fType     = panel.querySelector('.f-type');
  var fLevel    = panel.querySelector('.f-level-sel');
  var fFindings = panel.querySelector('.f-findings');
  var fSearch   = panel.querySelector('.f-search');
  var showRes   = document.getElementById('show-resolved-global');

  var status  = fStatus   ? fStatus.value.trim()   : '';
  var type    = fType     ? fType.value.trim()      : '';
  var level   = fLevel    ? fLevel.value.trim()     : '';
  var onlyF   = fFindings ? fFindings.checked       : false;
  var q       = fSearch   ? fSearch.value.trim().toLowerCase() : '';
  var showR   = showRes   ? showRes.checked          : false;
  var resolved = loadResolved();

  panel.querySelectorAll('tr.row').forEach(function(row) {
    var path = row.dataset.path || '';
    var show = true;
    if (!showR && resolved[path]) { row.style.display = 'none'; return; }
    if (status && row.dataset.status !== status) show = false;
    if (type   && row.dataset.type   !== type)   show = false;
    if (level  && row.dataset.level  !== level && !(level === 'ERROR' && row.dataset.level === 'ERROR')) show = false;
    if (onlyF  && !row.querySelector('.findings-list')) show = false;
    if (q      && !row.textContent.toLowerCase().includes(q)) show = false;
    row.style.display = show ? '' : 'none';
  });
  updateRowCounts();
}

function updateRowCounts() {
  document.querySelectorAll('.tab-panel').forEach(function(panel) {
    var counter = panel.querySelector('.filter-count');
    if (!counter) return;
    var visible = panel.querySelectorAll('tr.row:not([style*="display: none"])').length;
    counter.textContent = visible + ' rows';
  });
}

// ── Sort ─────────────────────────────────────────────────────────────────────
var sortState = {}; // tabId → { col, dir }
function sortTable(tabId, col) {
  if (!sortState[tabId]) sortState[tabId] = { col: null, dir: 'asc' };
  var s = sortState[tabId];
  s.dir = s.col === col ? (s.dir === 'asc' ? 'desc' : 'asc') : 'asc';
  s.col = col;

  var panel = document.getElementById('tab-' + tabId);
  if (!panel) return;
  var tbody = panel.querySelector('tbody');
  if (!tbody) return;
  var rows = Array.from(tbody.querySelectorAll('tr.row'));

  rows.sort(function(a, b) {
    var av, bv;
    if (col === 'title')   { av = a.dataset.title  || ''; bv = b.dataset.title  || ''; }
    else if (col === 'age')     { av = +a.dataset.age || 9999; bv = +b.dataset.age || 9999; }
    else if (col === 'level')   {
      var o = {ERROR:3,WARN:2,INFO:1,'':0};
      av = o[a.dataset.level]||0; bv = o[b.dataset.level]||0;
    }
    else if (col === 'status')  { var so = {missing:0,unverified:1,pending:2,verified:3}; av = so[a.dataset.status]||0; bv = so[b.dataset.status]||0; }
    if (typeof av === 'string') { var cmp = av.localeCompare(bv); return s.dir === 'asc' ? cmp : -cmp; }
    return s.dir === 'asc' ? av - bv : bv - av;
  });

  rows.forEach(function(r) { tbody.appendChild(r); });

  panel.querySelectorAll('th[data-sort]').forEach(function(th) {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.sort === col) th.classList.add(s.dir === 'asc' ? 'sort-asc' : 'sort-desc');
  });
}

// ── Drawer ───────────────────────────────────────────────────────────────────
var ENTRIES = null;
function getEntries() {
  if (!ENTRIES) {
    var el = document.getElementById('admin-entries-data');
    try { ENTRIES = el ? JSON.parse(el.textContent) : {}; } catch { ENTRIES = {}; }
  }
  return ENTRIES;
}

function openDrawer(path) {
  var data = getEntries()[path];
  if (!data) return;

  var drawer = document.getElementById('drawer');
  var overlay = document.getElementById('drawer-overlay');

  var r = loadResolved();
  var resolvedNow = !!r[path];

  var titleHtml = data.char
    ? data.char + ' <span style="font-style:italic;font-size:0.85em">' + esc(data.pinyin || '') + '</span>'
    : esc(data.title || path);

  var tagsHtml = (data.tags || []).length
    ? '<div class="tag-list">' + data.tags.map(function(t){ return '<span class="tag-pill">' + esc(t) + '</span>'; }).join('') + '</div>'
    : '<span style="color:var(--adm-ink3)">—</span>';

  var findingsHtml = data.findings && data.findings.length
    ? '<ul class="findings-list">' + data.findings.map(drawFinding).join('') + '</ul>'
    : '<span style="color:var(--adm-ink3);font-size:0.8rem">No findings for this entry.</span>';

  var inboundHtml = data.inbound && data.inbound.length
    ? '<ul class="inbound-list">' + data.inbound.map(function(p){
        var e = getEntries()[p];
        var label = e ? (e.char || e.title || p) : p;
        return '<li><a href="' + esc(p.replace(/^pages\//,'../')) + '" target="_blank">' + esc(label) + '</a></li>';
      }).join('') + '</ul>'
    : '<span style="color:var(--adm-ink3);font-size:0.8rem">None found.</span>';

  var contentPath = path.replace(/^pages\//,'content/').replace(/\.html$/,'.md');
  var ageDays = data.updated ? Math.round((Date.now() - new Date(data.updated)) / 86400000) : null;
  var ageStr  = ageDays !== null ? ageDays + ' days ago' : '—';

  drawer.innerHTML =
    '<button class="drawer-close" onclick="closeDrawer()">✕</button>' +
    '<div class="drawer-title">' + titleHtml + '</div>' +
    '<div class="drawer-meta">' + esc(data.type) + ' · ' + esc(data.category) + ' · ' + esc(path) + '</div>' +

    '<div class="drawer-section">' +
      '<h3>Metadata</h3>' +
      '<div class="drawer-kv">' +
        '<span class="dk">status</span><span class="dv">' + esc(data.status||'—') + '</span>' +
        '<span class="dk">updated</span><span class="dv">' + esc(data.updated||'—') + ' (' + esc(ageStr) + ')</span>' +
        '<span class="dk">factual_review</span><span class="dv">' + esc(data.factual_review||'—') + '</span>' +
        (data.factual_sources && data.factual_sources.length ? '<span class="dk">sources</span><span class="dv">' + data.factual_sources.map(function(s){return'<span class="src">'+esc(s)+'</span>';}).join(' ') + '</span>' : '') +
        '<span class="dk">tags</span><span class="dv">' + tagsHtml + '</span>' +
        '<span class="dk">desc</span><span class="dv" style="font-size:0.78rem;color:var(--adm-ink2)">' + esc(data.desc||'—') + '</span>' +
      '</div>' +
    '</div>' +

    '<div class="drawer-section">' +
      '<h3>Findings (' + (data.findings||[]).length + ')</h3>' +
      findingsHtml +
    '</div>' +

    '<div class="drawer-section">' +
      '<h3>Inbound links (' + (data.inbound||[]).length + ')</h3>' +
      inboundHtml +
    '</div>' +

    '<div class="drawer-actions">' +
      '<a class="dact" href="https://github.com/HunterDellere/jiaoluo-shuwu/blob/main/' + esc(contentPath) + '" target="_blank" rel="noopener">Edit on GitHub ↗</a>' +
      '<a class="dact" href="' + esc(path.replace(/^pages\//,'../')) + '" target="_blank" rel="noopener">View page ↗</a>' +
      (!resolvedNow
        ? '<button class="dact dact-resolve" onclick="markResolved(\'' + escapeSingleQuote(path) + '\',\'\')">Mark resolved</button>'
        : '<button class="dact" onclick="markUnresolved(\'' + escapeSingleQuote(path) + '\')">Unmark resolved</button>') +
      '<button class="dact" onclick="copyDrawerFindings(\'' + escapeSingleQuote(path) + '\')">Copy findings</button>' +
    '</div>';

  overlay.classList.add('open');
  drawer.classList.add('open');
  drawer.focus();
}

function drawFinding(f) {
  var li = '<li class="fi fi-' + (f.level||'').toLowerCase() + '">';
  li += '<span class="lvl lvl-' + (f.level||'').toLowerCase() + '">' + esc(f.level||'') + '</span> ';
  li += '<span class="fi-msg">' + esc(f.msg||'') + '</span>';
  if (f.fix) li += '<div class="fi-fix">→ ' + esc(f.fix) + '</div>';
  if (f.context) li += '<div class="fi-ctx">' + esc(String(f.context).slice(0,200)) + '</div>';
  li += '</li>';
  return li;
}

function closeDrawer() {
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawer-overlay').classList.remove('open');
}

function copyDrawerFindings(path) {
  var data = getEntries()[path];
  if (!data) return;
  var lines = ['# Findings: ' + (data.title||path), ''];
  (data.findings||[]).forEach(function(f) {
    lines.push('- [' + f.level + '] ' + f.msg);
    if (f.fix) lines.push('  Fix: ' + f.fix);
  });
  navigator.clipboard.writeText(lines.join('\\n')).catch(function(){});
}

function escapeSingleQuote(s) { return String(s).replace(/'/g, "\\\\'"); }
function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Export current tab as markdown checklist ─────────────────────────────────
function exportMarkdown(tabId) {
  var panel = document.getElementById('tab-' + tabId);
  if (!panel) return;
  var rows = Array.from(panel.querySelectorAll('tr.row:not([style*="display: none"])'));
  var lines = ['# Admin Export — ' + tabId + ' — ' + new Date().toISOString().slice(0,10), ''];
  rows.forEach(function(row) {
    var title = row.dataset.title || row.dataset.path || '';
    var findings = Array.from(row.querySelectorAll('.fi-msg')).map(function(el){ return el.textContent; });
    lines.push('- [ ] ' + title);
    findings.forEach(function(f){ lines.push('  - ' + f); });
  });
  navigator.clipboard.writeText(lines.join('\\n')).catch(function(){});
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
document.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'Escape') { closeDrawer(); return; }

  // j/k to step rows
  var panel = document.querySelector('.tab-panel.active');
  if (!panel) return;
  var rows = Array.from(panel.querySelectorAll('tr.row:not([style*="display: none"])'));
  var focused = document.activeElement;
  var idx = rows.indexOf(focused);

  if (e.key === '/' ) { e.preventDefault(); var fs = panel.querySelector('.f-search'); if(fs) fs.focus(); return; }
  if (e.key === 'j' && !e.metaKey) { e.preventDefault(); var n = idx < rows.length-1 ? rows[idx+1] : rows[0]; if(n) n.focus(); return; }
  if (e.key === 'k' && !e.metaKey) { e.preventDefault(); var p = idx > 0 ? rows[idx-1] : rows[rows.length-1]; if(p) p.focus(); return; }
  if (e.key === 'Enter' && focused && focused.dataset.path) { openDrawer(focused.dataset.path); return; }
  if (e.key === 'x' && focused && focused.dataset.path) {
    var path = focused.dataset.path;
    if (isResolved(path)) markUnresolved(path); else markResolved(path, '');
    return;
  }
});

// ── Lock out ─────────────────────────────────────────────────────────────────
function lockOut() {
  try { localStorage.removeItem('shuwu_key'); } catch {}
  window.location.replace('../../index.html');
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  // Wire filter inputs for every tab
  document.querySelectorAll('.tab-panel').forEach(function(panel) {
    var tabId = panel.id.replace('tab-', '');
    panel.querySelectorAll('.f-status, .f-type, .f-level-sel, .f-findings, .f-search').forEach(function(el) {
      el.addEventListener('input', function() { applyFilters(tabId); });
    });
    var showRes = document.getElementById('show-resolved-global');
    if (showRes) showRes.addEventListener('change', function() { refreshResolvedUI(); applyFilters(tabId); });
    // Sort headers
    panel.querySelectorAll('th[data-sort]').forEach(function(th) {
      th.addEventListener('click', function() { sortTable(tabId, th.dataset.sort); });
    });
    // Export button
    var exportBtn = panel.querySelector('.export-btn');
    if (exportBtn) exportBtn.addEventListener('click', function() { exportMarkdown(tabId); });
  });

  refreshResolvedUI();
  updateRowCounts();
  showTab('needs-review');
});
`;

// ── Tab HTML builder ──────────────────────────────────────────────────────────

function filterBarHtml(tabId, includeStateFilter = false) {
  const stateOpts = includeStateFilter
    ? `<label>State <select class="f-status"><option value="">all</option><option>missing</option><option>unverified</option><option>pending</option><option>verified</option></select></label>`
    : '';
  return `<div class="filter-bar">
    ${stateOpts}
    <label>Type <select class="f-type"><option value="">all</option><option>character</option><option>vocab</option><option>topic</option><option>grammar</option><option>chengyu</option><option>hub</option></select></label>
    <label>Level <select class="f-level-sel"><option value="">all</option><option>ERROR</option><option>WARN</option><option>INFO</option></select></label>
    <label>With findings <input type="checkbox" class="f-findings"></label>
    <label>Search <input type="text" class="f-search" placeholder="title, char, tag…"></label>
    <span class="filter-count"></span>
    <div class="filter-actions">
      <button class="export-btn">Copy as markdown</button>
    </div>
  </div>`;
}

function tableHtml(rows, includeState = false) {
  const stateCol = includeState ? `<th data-sort="status">State <span class="sort-arrow"></span></th>` : '';
  return `<table class="review-table">
    <thead>
      <tr>${stateCol}<th data-sort="title">Page <span class="sort-arrow"></span></th><th>Findings</th><th>Action</th></tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="4" class="no-rows">No items match the current filters.</td></tr>'}
    </tbody>
  </table>`;
}

function tabPanelHtml(tabId, headingText, contentHtml) {
  return `<div id="tab-${tabId}" class="tab-panel">
    <h2 style="font-family:var(--adm-serif);font-size:1.05rem;margin-bottom:0.75rem">${esc(headingText)}</h2>
    ${contentHtml}
  </div>`;
}

// ── Assemble all tab panels ───────────────────────────────────────────────────

const panelNeeds = tabPanelHtml('needs-review', 'Needs Review',
  filterBarHtml('needs-review', true) +
  `<p style="font-size:0.78rem;color:var(--adm-ink3);margin-bottom:0.75rem">
    All entries with factual review state pending/missing/unverified, plus any entry with an ERROR finding.
    <span class="kbd">j</span><span class="kbd">k</span> navigate · <span class="kbd">Enter</span> inspect · <span class="kbd">x</span> mark resolved · <span class="kbd">/</span> search
  </p>` +
  tableHtml(needsReviewRows + errorOnlyRows, true)
);

function buildTabPanel(tabDef) {
  const tc = tabContents[tabDef.id];
  if (!tc) return '';
  const { rows, globalHtml, count } = tc;
  const heading = tabDef.label.replace(/^[^ ]+ /, ''); // strip leading emoji
  return tabPanelHtml(tabDef.id, heading + ` (${count})`,
    filterBarHtml(tabDef.id, false) +
    globalHtml +
    tableHtml(rows, false)
  );
}

const panelAnalytics = tabPanelHtml('analytics', 'Analytics',
  `<div class="analytics-panel">
    <h3>No analytics provider configured</h3>
    <p>This site is fully static — there's no server to capture traffic data.</p>
    <p>To add lightweight, privacy-respecting analytics (no cookies, no consent banner required), add one line to <code>templates/_layout.html</code>:</p>
    <p><code>&lt;script defer data-domain="jiaoshoo.com" src="https://plausible.io/js/script.js"&gt;&lt;/script&gt;</code></p>
    <p>Once you have a Plausible or GoatCounter account, the dashboard lives on their site — this tab can display a link to it once you configure the endpoint in localStorage.</p>
    <p>To set your analytics URL so this tab links directly to it, run in the browser console:</p>
    <p><code>localStorage.setItem('shuwu_analytics_url', 'YOUR_DASHBOARD_URL')</code></p>
    <div id="analytics-link-wrap"></div>
    <script>
      (function() {
        var url = localStorage.getItem('shuwu_analytics_url');
        var wrap = document.getElementById('analytics-link-wrap');
        if (url && wrap) {
          wrap.innerHTML = '<p style="margin-top:0.75rem"><a href="' + url + '" target="_blank" rel="noopener" style="border-bottom:1px solid">Open analytics dashboard ↗</a></p>';
        }
      })();
    </script>
  </div>`
);

// ── Tabs header ───────────────────────────────────────────────────────────────
const tabButtonsHtml = TAB_DEFS.map(t => {
  let badge = '';
  if (t.id === 'needs-review') {
    const nr = needsReviewEntries.length + [...errorPaths].filter(p => !needsReviewEntries.some(([ep]) => ep === p)).length;
    badge = ` (${nr})`;
  } else if (t.categories) {
    const total = t.categories.reduce((sum, c) => {
      const cc = catCounts[c] || {};
      return sum + (cc.ERROR || 0) + (cc.WARN || 0) + (cc.INFO || 0);
    }, 0);
    badge = total ? ` (${total})` : '';
  }
  return `<button class="tab-btn" data-tab="${t.id}" onclick="showTab('${t.id}')">${esc(t.label)}${badge}</button>`;
}).join('');

// ── Final HTML ────────────────────────────────────────────────────────────────

const genTime = new Date(generated).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

const html = `<!DOCTYPE html>
<!-- ADMIN: not indexed; not linked from public surfaces -->
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">
<title>角落書屋 Admin</title>
<style>${CSS}</style>
<script>
// Passphrase gate. Failure closes silently (redirects home). Success persists in
// localStorage so the gate is one-time-per-device. Plaintext never stored.
(async function () {
  var EXPECTED = '${ADMIN_KEY_HASH}';
  function sha(text) {
    var buf = new TextEncoder().encode(text);
    return crypto.subtle.digest('SHA-256', buf).then(function (h) {
      return Array.from(new Uint8Array(h)).map(function (b) {
        return b.toString(16).padStart(2, '0');
      }).join('');
    });
  }
  function goHome() { window.location.replace('../../index.html'); }
  try {
    if (localStorage.getItem('shuwu_key') === EXPECTED) {
      document.documentElement.dataset.unlocked = '1';
      return;
    }
  } catch (_) {}
  var entered = window.prompt('');
  if (!entered) { goHome(); return; }
  var hash = await sha(entered);
  if (hash === EXPECTED) {
    try { localStorage.setItem('shuwu_key', EXPECTED); } catch (_) {}
    document.documentElement.dataset.unlocked = '1';
  } else {
    goHome();
  }
})();
var _reveal = setInterval(function () {
  if (document.documentElement.dataset.unlocked === '1') {
    clearInterval(_reveal);
    var root = document.getElementById('admin-root');
    if (root) root.style.display = 'block';
  }
}, 30);
</script>
</head>
<body>

<!-- Entry data for the drawer inspector (no extra fetches needed) -->
<script type="application/json" id="admin-entries-data">${JSON.stringify(drawerData)}</script>

<div id="admin-root">
<div class="adm-wrap">

  <header class="adm-header">
    <div>
      <h1>审校台 · Site Admin</h1>
      <div class="sub">Not publicly linked. Bookmark this URL.</div>
      <div class="meta">findings generated ${esc(genTime)} · ${summary.errors || 0} errors · ${summary.warnings || 0} warnings · ${summary.info || 0} info</div>
    </div>
    <div class="adm-header-right">
      <label style="font-size:0.72rem;font-family:var(--adm-mono);color:var(--adm-ink3);display:block;margin-bottom:0.4rem">
        <input type="checkbox" id="show-resolved-global"> show resolved
      </label>
      <div class="adm-lock-out" onclick="lockOut()">lock out</div>
    </div>
  </header>

  <!-- Summary strip: state counts + severity counts -->
  <div class="summary-strip">
    <div class="sum-section">
      <div class="count-card cc-verified"><div class="n">${stateCounts.verified}</div><div class="l">verified</div></div>
      <div class="count-card cc-pending"><div class="n">${stateCounts.pending}</div><div class="l">pending</div></div>
      <div class="count-card cc-unverified"><div class="n">${stateCounts.unverified}</div><div class="l">unverified</div></div>
      <div class="count-card cc-missing"><div class="n">${stateCounts.missing}</div><div class="l">missing</div></div>
    </div>
    <div class="sum-section">
      <div class="count-card cc-err"><div class="n">${summary.errors || 0}</div><div class="l">errors</div></div>
      <div class="count-card cc-warn"><div class="n">${summary.warnings || 0}</div><div class="l">warnings</div></div>
      <div class="count-card cc-info"><div class="n">${summary.info || 0}</div><div class="l">info</div></div>
    </div>
  </div>

  <!-- Category chip strip -->
  <div class="cat-chips">${categoryChipsHtml}</div>

  <!-- Tabs -->
  <nav class="tabs" role="tablist">${tabButtonsHtml}</nav>

  <!-- Tab panels -->
  ${panelNeeds}
  ${TAB_DEFS.filter(t => t.id !== 'needs-review' && t.id !== 'analytics').map(buildTabPanel).join('\n')}
  ${panelAnalytics}

</div><!-- /.adm-wrap -->
</div><!-- /#admin-root -->

<!-- Drawer overlay + panel -->
<div class="drawer-overlay" id="drawer-overlay" onclick="closeDrawer()"></div>
<aside class="drawer" id="drawer" tabindex="-1"></aside>

<script>${JS}</script>
</body>
</html>`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, html);

const needsAttention = needsReviewEntries.length + [...errorPaths].length;
console.log(`✓ build-admin: pages/_admin/review.html — ${needsAttention} items needing attention, ${findings.length} total findings`);
