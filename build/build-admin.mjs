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
const schemaPath   = path.join(ROOT, 'content', '_schema', 'entry.schema.json');
const outDir  = path.join(ROOT, 'pages', '_admin');
const outPath = path.join(outDir, 'review.html');

if (!fs.existsSync(entriesPath)) {
  console.error('build-admin: data/entries.json missing — run `npm run build` first.');
  process.exit(1);
}

// Review states are the source of truth for the state filter and any stats.
// Derived from the frontmatter schema so adding/renaming a state in the schema
// automatically updates the admin UI instead of silently diverging.
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const REVIEW_STATES = [...(schema.properties?.content_review?.enum || []), 'missing'];
if (!REVIEW_STATES.includes('verified') || !REVIEW_STATES.includes('pending')) {
  throw new Error(`build-admin: schema.content_review.enum missing expected states; got ${JSON.stringify(REVIEW_STATES)}`);
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

// ── Supplemental frontmatter (content_review, content_sources) ──────────────
const review = {};
for (const e of entries) {
  const src = path.join(ROOT, e.path.replace(/^pages\//, 'content/').replace(/\.html$/, '.md'));
  if (!fs.existsSync(src)) continue;
  const { data: fm } = matter(fs.readFileSync(src, 'utf8'));
  review[e.path] = {
    content_review:   fm.content_review   || null,
    content_sources:  fm.content_sources  || [],
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

// ── Content-review state counts ──────────────────────────────────────────────
// Reviewable = all complete pages. Stubs are excluded.
const reviewable = Object.entries(review).filter(([, r]) => r.status === 'complete');
const reviewableCount = reviewable.length;
const stateCounts = { verified: 0, pending: 0, unverified: 0, missing: 0 };
for (const [, r] of reviewable) {
  const s = r.content_review || 'missing';
  stateCounts[s in stateCounts ? s : 'missing']++;
}
const stubCount   = entries.filter(e => e.status === 'stub').length;
const completeCount = entries.filter(e => e.status === 'complete').length;

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
    content_review:  r.content_review,
    content_sources: r.content_sources || [],
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
  const status = r.content_review || 'missing';
  const contentPath = pagePath.replace(/^pages\//, 'content/').replace(/\.html$/, '.md');
  const findingsHtml = rowFindings.length
    ? `<ul class="findings-list">${rowFindings.map(findingItemHtml).join('')}</ul>`
    : '<span class="no-findings">—</span>';
  const sourcesHtml = (r.content_sources || []).length
    ? `<div class="p-sources">${r.content_sources.map(s => `<span class="src">${esc(s)}</span>`).join(' ')}</div>`
    : '';
  const titleHtml = r.char
    ? `${esc(r.char)} <span class="t-py">${esc(r.pinyin || '')}</span> — ${esc((r.title || '').replace(/^.*?·\s*/, ''))}`
    : esc(r.title || pagePath);
  const pageRelHref = pagePath.replace(/^pages\//, '../');
  const ageDays = r.updated ? Math.round((Date.now() - new Date(r.updated)) / 86400000) : null;
  const ageStr  = ageDays !== null ? `${ageDays}d ago` : '';

  // Broad searchable blob: everything a user might reasonably type. Includes
  // the tone-stripped pinyin so searching "gan" matches "gǎn". Diacritics get
  // stripped client-side too, so the raw pinyin stays here for completeness.
  const pinyinNoTone = (r.pinyin || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const searchTokens = [
    r.title, r.char, r.pinyin, pinyinNoTone,
    r.type, r.category, r.desc, pagePath, status,
    ...(r.tags || []),
    ...(r.content_sources || []),
    ...rowFindings.map(f => `${f.msg || ''} ${f.fix || ''} ${f.category || ''}`),
  ].filter(Boolean).join(' ').toLowerCase();

  return `<tr class="row row-${esc(r.status || 'complete')}"
    data-status="${esc(r.content_review || 'missing')}"
    data-type="${esc(r.type || '')}"
    data-category="${esc(r.category || '')}"
    data-level="${esc(rowFindings.length ? rowFindings.reduce((m, f) => { const o={ERROR:3,WARN:2,INFO:1}; return o[f.level]>o[m]?f.level:m; }, 'INFO') : '')}"
    data-age="${ageDays !== null ? ageDays : 9999}"
    data-path="${esc(pagePath)}"
    data-title="${esc(r.title || pagePath)}"
    data-search="${esc(searchTokens)}"
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
// Shows every reviewable (complete) entry, sorted so items needing attention
// (missing / unverified / pending) come first and verified entries come last.
// The state filter lets you narrow to any single review state — including
// verified — so this tab also serves as the "all entries" browser.
const allReviewableEntries = reviewable
  .slice()
  .sort((a, b) => {
    const order = { missing: 0, unverified: 1, pending: 2, verified: 3 };
    const ka = a[1].content_review || 'missing';
    const kb = b[1].content_review || 'missing';
    if (order[ka] !== order[kb]) return order[ka] - order[kb];
    return a[0].localeCompare(b[0]);
  });

const needsAttentionEntries = allReviewableEntries.filter(
  ([, r]) => (r.content_review || 'missing') !== 'verified'
);

// Also entries with any ERROR finding (not already in the reviewable list)
const errorPaths = new Set();
for (const f of findings.filter(f => f.level === 'ERROR')) {
  // Map content path → pages path
  const pagesPath = f.file.startsWith('content/')
    ? f.file.replace(/^content\//, 'pages/').replace(/\.md$/, '.html')
    : f.file;
  if (entries.find(e => e.path === pagesPath)) errorPaths.add(pagesPath);
}
const needsReviewRows = allReviewableEntries.map(([p, r]) => {
  const contentPath = p.replace(/^pages\//, 'content/').replace(/\.html$/, '.md');
  const rowFindings = [...(findingsByFile[contentPath] || []), ...(findingsByFile[p] || [])];
  return pageRowHtml(p, r, rowFindings, true);
}).join('');

const errorOnlyRows = [...errorPaths]
  .filter(p => !allReviewableEntries.some(([ep]) => ep === p))
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
      updated: r.updated, content_review: null,
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

// ── (chip strip removed — tabs carry the counts directly) ────────────────────

// ── SHA-256 passphrase hash ───────────────────────────────────────────────────
const ADMIN_KEY_HASH = '2092bbb3fd73f990c9d5d51a985634263ba212436a087ce4394461ea8704a4bf';

// ── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
  :root {
    --adm-bg:    #f7f1e8;
    --adm-bg2:   #efe8da;
    --adm-ink:   #1e1a16;
    --adm-ink2:  #5c5040;
    --adm-ink3:  #9a8c7a;
    --adm-rule:  #d4c8b4;
    --adm-red:   #922e20;
    --adm-amber: #a07a28;
    --adm-green: #2e6e40;
    --adm-mono:  'Noto Sans Mono', 'Inconsolata', ui-monospace, monospace;
    --adm-serif: 'Cormorant Garamond', 'Georgia', serif;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; background: var(--adm-bg); color: var(--adm-ink); font-size: 13.5px; line-height: 1.55; }
  a { color: inherit; }
  #admin-root { display: none; }

  /* ── Layout ── */
  .adm-wrap { max-width: 1400px; margin: 0 auto; padding: 1.25rem 1.5rem 3rem; }

  /* ── Header ── */
  .adm-header {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center; gap: 1.25rem;
    padding-bottom: 0.9rem; margin-bottom: 1rem;
    border-bottom: 1px solid var(--adm-rule);
  }
  .adm-header-brand {
    font-family: var(--adm-serif); font-size: 1.25rem;
    letter-spacing: 0.02em; color: var(--adm-ink); line-height: 1.2;
    display: flex; align-items: baseline; gap: 0.4rem;
  }
  .adm-header-brand .brand-cn { font-weight: 600; }
  .adm-header-brand .brand-en {
    font-size: 0.72rem; font-style: italic; color: var(--adm-ink3);
    font-family: system-ui, sans-serif;
  }
  .adm-header-right { display: flex; align-items: center; gap: 1rem; justify-self: end; }
  .adm-header-meta { font-family: var(--adm-mono); font-size: 0.66rem; color: var(--adm-ink3); line-height: 1.6; white-space: nowrap; }
  .adm-header-meta .sep { margin: 0 0.35em; opacity: 0.4; }
  .show-resolved-label { font-size: 0.72rem; color: var(--adm-ink3); display: flex; align-items: center; gap: 0.3rem; cursor: pointer; }
  .adm-lock-out { font-family: var(--adm-mono); font-size: 0.68rem; color: var(--adm-ink3); cursor: pointer; text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 2px; }
  .adm-lock-out:hover { color: var(--adm-ink); }

  /* ── Global search (header) ── */
  .global-search-wrap {
    position: relative; display: flex; align-items: center;
    max-width: 520px; width: 100%;
  }
  .global-search-wrap::before {
    content: '⌕'; position: absolute; left: 0.65rem;
    color: var(--adm-ink3); font-size: 0.95rem; pointer-events: none;
  }
  #global-search {
    flex: 1; padding: 0.48rem 2rem 0.48rem 1.9rem;
    border: 1px solid var(--adm-rule); border-radius: 3px;
    background: var(--adm-bg); color: var(--adm-ink);
    font-family: inherit; font-size: 0.85rem;
    transition: border-color 0.1s, box-shadow 0.1s;
  }
  #global-search:focus {
    outline: none; border-color: var(--adm-ink2);
    box-shadow: 0 0 0 2px rgba(30,26,22,0.08);
  }
  #global-search::placeholder { color: var(--adm-ink3); font-style: italic; }
  #global-search-clear {
    position: absolute; right: 0.3rem; top: 50%; transform: translateY(-50%);
    border: none; background: transparent; cursor: pointer;
    font-family: var(--adm-mono); font-size: 0.95rem; color: var(--adm-ink3);
    padding: 0.15rem 0.4rem; border-radius: 2px; line-height: 1;
  }
  #global-search-clear:hover { color: var(--adm-ink); background: var(--adm-bg2); }
  .gs-hint {
    position: absolute; right: 2rem; top: 50%; transform: translateY(-50%);
    font-family: var(--adm-mono); font-size: 0.6rem; color: var(--adm-ink3);
    border: 1px solid var(--adm-rule); border-radius: 2px;
    padding: 0.02rem 0.3rem; background: var(--adm-bg2); pointer-events: none;
  }
  #global-search:focus + .gs-hint, #global-search:not(:placeholder-shown) + .gs-hint { display: none; }
  @media (max-width: 860px) {
    .adm-header { grid-template-columns: 1fr auto; }
    .global-search-wrap { grid-column: 1 / -1; max-width: none; }
  }

  /* ── Stat bar ── */
  .stat-bar {
    display: flex; align-items: stretch; gap: 0; flex-wrap: wrap;
    border: 1px solid var(--adm-rule); border-radius: 4px; overflow: hidden;
    margin-bottom: 1.25rem; background: var(--adm-bg2);
  }
  .stat-item {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 0.5rem 0.9rem; min-width: 72px; gap: 0.08rem;
    border-right: 1px solid var(--adm-rule); flex: 1;
  }
  .stat-item.stat-clickable { cursor: pointer; transition: background 0.1s; }
  .stat-item.stat-clickable:hover { background: rgba(0,0,0,0.03); }
  .stat-item:last-child { border-right: none; }
  .stat-item + .stat-item.stat-group-start { border-left: 2px solid var(--adm-rule); }
  .stat-n { font-family: var(--adm-mono); font-size: 1.2rem; font-weight: 700; line-height: 1; }
  .stat-l { font-size: 0.6rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--adm-ink3); margin-top: 0.15rem; }
  .stat-item.s-verified .stat-n { color: var(--adm-green); }
  .stat-item.s-pending  .stat-n { color: var(--adm-amber); }
  .stat-item.s-unverified .stat-n { color: var(--adm-red); }
  .stat-item.s-err  .stat-n { color: var(--adm-red); }
  .stat-item.s-warn .stat-n { color: var(--adm-amber); }
  .stat-item.s-muted .stat-n { color: var(--adm-ink2); font-weight: 500; }

  /* ── Tabs ── */
  .tabs { display: flex; border-bottom: 1px solid var(--adm-rule); margin-bottom: 1rem; flex-wrap: wrap; gap: 0; }
  .tab-btn {
    font-size: 0.8rem; padding: 0.5rem 1rem;
    border: none; background: transparent; cursor: pointer;
    color: var(--adm-ink3); border-bottom: 2px solid transparent;
    margin-bottom: -1px; font-family: inherit; white-space: nowrap;
    transition: color 0.1s;
  }
  .tab-btn:hover { color: var(--adm-ink2); }
  .tab-btn.active { color: var(--adm-ink); border-bottom-color: var(--adm-ink); font-weight: 600; }
  .tab-badge {
    display: inline-block; font-family: var(--adm-mono); font-size: 0.62rem;
    padding: 0.05rem 0.3rem; border-radius: 10px; margin-left: 0.35rem;
    background: var(--adm-bg2); color: var(--adm-ink3); vertical-align: middle;
  }
  .tab-badge.tb-err  { background: rgba(146,46,32,0.1); color: var(--adm-red); }
  .tab-badge.tb-warn { background: rgba(160,122,40,0.1); color: var(--adm-amber); }
  .tab-panel { display: none; }
  .tab-panel.active { display: block; }

  /* ── Panel heading ── */
  .panel-head { margin-bottom: 1rem; }
  .panel-head h2 { font-size: 0.8rem; letter-spacing: 0.07em; text-transform: uppercase; color: var(--adm-ink3); font-weight: 600; }
  .panel-head .panel-desc { font-size: 0.78rem; color: var(--adm-ink3); margin-top: 0.25rem; }
  .panel-head .panel-desc .kbd { display: inline-block; font-family: var(--adm-mono); font-size: 0.65rem; padding: 0.05rem 0.3rem; border: 1px solid var(--adm-rule); border-radius: 2px; margin: 0 0.1rem; }

  /* ── Empty state ── */
  .empty-state { padding: 2.5rem 1rem; text-align: center; color: var(--adm-ink3); }
  .empty-state .es-icon { font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.4; }
  .empty-state .es-title { font-size: 0.85rem; font-weight: 600; color: var(--adm-ink2); margin-bottom: 0.25rem; }
  .empty-state .es-body { font-size: 0.78rem; line-height: 1.6; max-width: 380px; margin: 0 auto; }

  /* ── Filter bar ── */
  .filter-bar {
    display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap;
    margin-bottom: 0.75rem; padding: 0.45rem 0.7rem;
    background: var(--adm-bg2); border: 1px solid var(--adm-rule); border-radius: 3px;
    font-size: 0.78rem;
  }
  .filter-bar label { display: flex; align-items: center; gap: 0.3rem; color: var(--adm-ink2); }
  .filter-bar select {
    padding: 0.2rem 0.4rem; border: 1px solid var(--adm-rule);
    background: var(--adm-bg); color: inherit; font-family: var(--adm-mono);
    font-size: 0.75rem; border-radius: 2px;
  }
  .filter-count { font-family: var(--adm-mono); font-size: 0.68rem; color: var(--adm-ink3); margin-left: 0.25rem; }
  .filter-divider { width: 1px; background: var(--adm-rule); align-self: stretch; margin: 0 0.15rem; }
  .filter-actions { display: flex; gap: 0.35rem; margin-left: auto; }
  .filter-actions button {
    font-size: 0.7rem; padding: 0.22rem 0.55rem;
    border: 1px solid var(--adm-rule); background: var(--adm-bg);
    cursor: pointer; font-family: var(--adm-mono); color: var(--adm-ink2);
    border-radius: 2px;
  }
  .filter-actions button:hover { background: rgba(0,0,0,0.05); color: var(--adm-ink); }

  /* Sticky filter bar so filters stay visible while scrolling a long table */
  .tab-panel.active .filter-bar {
    position: sticky; top: 0; z-index: 10;
    box-shadow: 0 1px 0 var(--adm-rule);
  }

  /* ── Table ── */
  .review-table { border-collapse: collapse; width: 100%; font-size: 0.82rem; }
  .review-table th {
    font-size: 0.62rem; letter-spacing: 0.09em; text-transform: uppercase;
    color: var(--adm-ink3); cursor: pointer; user-select: none; white-space: nowrap;
    padding: 0.4rem 0.65rem; border-bottom: 1px solid var(--adm-rule);
    background: var(--adm-bg2); text-align: left;
  }
  .review-table th:hover { color: var(--adm-ink); }
  .review-table th .sort-arrow { opacity: 0.35; }
  .review-table th.sort-asc .sort-arrow::after  { content: ' ↑'; }
  .review-table th.sort-desc .sort-arrow::after { content: ' ↓'; }
  .review-table td { padding: 0.5rem 0.65rem; vertical-align: top; border-bottom: 1px solid var(--adm-rule); }
  .review-table tr.row { cursor: pointer; }
  .review-table tr.row:hover td { background: rgba(0,0,0,0.02); }
  .review-table tr.row:focus { outline: 2px solid var(--adm-amber); outline-offset: -2px; }
  .review-table tr.row.resolved { opacity: 0.35; }
  .review-table tr.row.resolved td { text-decoration: line-through; }
  .c-state   { width: 100px; white-space: nowrap; }
  .c-title   { width: 32%; }
  .c-findings { }
  .c-actions { width: 56px; white-space: nowrap; text-align: right; }
  .no-rows { padding: 1.5rem 0.65rem; color: var(--adm-ink3); font-size: 0.8rem; }

  /* ── Status chip ── */
  .chip { display: inline-block; padding: 0.1rem 0.4rem; border-radius: 2px; font-size: 0.66rem; letter-spacing: 0.04em; font-family: var(--adm-mono); border: 1px solid; }
  .chip-verified   { color: var(--adm-green); border-color: rgba(46,110,64,0.35); background: rgba(46,110,64,0.07); }
  .chip-pending    { color: var(--adm-amber); border-color: rgba(160,122,40,0.35); background: rgba(160,122,40,0.07); }
  .chip-unverified { color: var(--adm-red);   border-color: rgba(146,46,32,0.35);  background: rgba(146,46,32,0.07); }
  .chip-missing    { color: var(--adm-ink3);  border-color: var(--adm-rule); }

  /* ── Page title cell ── */
  .p-title { font-family: var(--adm-serif); font-size: 0.96rem; color: var(--adm-ink); text-decoration: none; }
  .p-title:hover { text-decoration: underline; text-decoration-color: var(--adm-rule); }
  .t-py { font-style: italic; font-size: 0.8rem; color: var(--adm-ink3); margin-left: 0.2rem; }
  .p-meta { font-size: 0.65rem; color: var(--adm-ink3); margin-top: 0.18rem; font-family: var(--adm-mono); }
  .p-age { color: var(--adm-ink3); }
  .p-sources { margin-top: 0.2rem; }
  .p-sources .src { display: inline-block; padding: 0.05rem 0.3rem; font-size: 0.62rem; background: rgba(46,110,64,0.08); color: var(--adm-green); margin-right: 0.2rem; border-radius: 2px; font-family: var(--adm-mono); }

  /* ── Finding items ── */
  .findings-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.2rem; }
  .fi { padding: 0.25rem 0.4rem; border-left: 2px solid; font-size: 0.74rem; line-height: 1.45; }
  .fi-error { border-left-color: var(--adm-red);   background: rgba(146,46,32,0.04); }
  .fi-warn  { border-left-color: var(--adm-amber); background: rgba(160,122,40,0.04); }
  .fi-info  { border-left-color: var(--adm-rule);  background: rgba(0,0,0,0.015); }
  .lvl { font-family: var(--adm-mono); font-size: 0.6rem; font-weight: 700; letter-spacing: 0.1em; margin-right: 0.3rem; vertical-align: middle; }
  .lvl-error { color: var(--adm-red);   }
  .lvl-warn  { color: var(--adm-amber); }
  .lvl-info  { color: var(--adm-ink3);  }
  .fi-fix  { font-size: 0.7rem; color: var(--adm-green); margin-top: 0.18rem; padding-left: 0.4rem; }
  .fi-ctx  { font-family: var(--adm-mono); font-size: 0.68rem; color: var(--adm-ink2); margin-top: 0.18rem; padding-left: 0.4rem; border-left: 1px solid var(--adm-rule); white-space: pre-wrap; word-break: break-all; }
  .fi-line { font-family: var(--adm-mono); font-size: 0.62rem; color: var(--adm-ink3); margin-top: 0.1rem; }
  .no-findings { color: var(--adm-ink3); font-family: var(--adm-mono); font-size: 0.75rem; }
  .action-link { font-size: 0.68rem; color: var(--adm-ink3); font-family: var(--adm-mono); text-decoration: none; }
  .action-link:hover { color: var(--adm-ink); text-decoration: underline; }

  /* ── Global findings block ── */
  .global-findings { margin-bottom: 1.25rem; padding: 0.65rem 0.75rem; border: 1px solid var(--adm-rule); border-radius: 3px; background: var(--adm-bg2); }
  .global-findings-title { font-size: 0.68rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--adm-ink3); margin-bottom: 0.5rem; }

  /* ── Drawer ── */
  .drawer-overlay { display: none; position: fixed; inset: 0; background: rgba(20,14,8,0.25); z-index: 100; }
  .drawer-overlay.open { display: block; }
  .drawer {
    position: fixed; top: 0; right: 0; bottom: 0; width: min(580px, 100vw);
    background: var(--adm-bg); border-left: 1px solid var(--adm-rule);
    overflow-y: auto; z-index: 101; padding: 1.25rem 1.5rem;
    transform: translateX(100%); transition: transform 0.15s ease;
    box-shadow: -4px 0 24px rgba(0,0,0,0.08);
  }
  .drawer.open { transform: translateX(0); }
  .drawer-close { float: right; font-size: 1rem; background: none; border: none; cursor: pointer; color: var(--adm-ink3); line-height: 1; padding: 0.15rem 0.3rem; border-radius: 2px; }
  .drawer-close:hover { background: var(--adm-bg2); color: var(--adm-ink); }
  .drawer-title { font-family: var(--adm-serif); font-size: 1.25rem; margin-bottom: 0.2rem; line-height: 1.2; }
  .drawer-meta { font-family: var(--adm-mono); font-size: 0.68rem; color: var(--adm-ink3); margin-bottom: 1rem; }
  .drawer-section { margin-bottom: 1.1rem; }
  .drawer-section h3 { font-size: 0.65rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--adm-ink3); margin-bottom: 0.45rem; padding-bottom: 0.2rem; border-bottom: 1px solid var(--adm-rule); }
  .drawer-kv { display: grid; grid-template-columns: 120px 1fr; gap: 0.18rem 0.5rem; font-size: 0.78rem; }
  .dk { color: var(--adm-ink3); font-family: var(--adm-mono); font-size: 0.7rem; padding-top: 0.05rem; }
  .dv { word-break: break-word; }
  .drawer-actions { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.65rem; padding-top: 0.75rem; border-top: 1px solid var(--adm-rule); }
  .dact { font-size: 0.72rem; padding: 0.28rem 0.6rem; border: 1px solid var(--adm-rule); background: transparent; cursor: pointer; font-family: var(--adm-mono); color: var(--adm-ink2); border-radius: 2px; text-decoration: none; }
  .dact:hover { background: var(--adm-bg2); }
  .dact-resolve { border-color: rgba(46,110,64,0.5); color: var(--adm-green); }
  .inbound-list, .outbound-list { list-style: none; display: flex; flex-direction: column; gap: 0.18rem; }
  .inbound-list a, .outbound-list a { font-size: 0.78rem; color: var(--adm-ink); text-decoration: none; border-bottom: 1px dotted var(--adm-rule); }
  .tag-list { display: flex; flex-wrap: wrap; gap: 0.3rem; }
  .tag-pill { font-family: var(--adm-mono); font-size: 0.68rem; padding: 0.08rem 0.3rem; border: 1px solid var(--adm-rule); border-radius: 2px; color: var(--adm-ink2); }

  /* ── Analytics tab ── */
  .analytics-panel { padding: 1.25rem; border: 1px solid var(--adm-rule); border-radius: 3px; max-width: 560px; background: var(--adm-bg2); }
  .analytics-panel h3 { font-family: var(--adm-serif); font-size: 1rem; margin-bottom: 0.65rem; }
  .analytics-panel p { font-size: 0.8rem; line-height: 1.65; margin-bottom: 0.6rem; color: var(--adm-ink2); }
  .analytics-panel code { font-family: var(--adm-mono); background: rgba(0,0,0,0.06); padding: 0.1rem 0.3rem; font-size: 0.75rem; border-radius: 2px; }

  /* ── Misc ── */
  code { font-family: var(--adm-mono); background: rgba(0,0,0,0.05); padding: 0.1rem 0.28rem; border-radius: 2px; font-size: 0.78rem; }
  .kbd { display: inline-block; font-family: var(--adm-mono); font-size: 0.65rem; padding: 0.05rem 0.28rem; border: 1px solid var(--adm-rule); border-radius: 2px; background: var(--adm-bg2); }
  .resolved-badge { font-family: var(--adm-mono); font-size: 0.62rem; color: var(--adm-green); margin-left: 0.35rem; }
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
  // Re-apply filters in the newly active tab so global search/per-tab
  // selectors narrow the rows correctly after a tab switch.
  applyFilters(id);
}

var currentTab = 'needs-review';

// ── Filter (global search + per-tab selectors) ───────────────────────────────
// Strip combining diacritics so 'gan' matches 'gǎn'.
function normalizeQuery(s) {
  return String(s || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().trim();
}

function applyFilters(tabId) {
  var panel = document.getElementById('tab-' + tabId);
  if (!panel) return;
  var fStatus   = panel.querySelector('.f-status');
  var fType     = panel.querySelector('.f-type');
  var fLevel    = panel.querySelector('.f-level-sel');
  var fFindings = panel.querySelector('.f-findings');
  var globalSearch = document.getElementById('global-search');
  var showRes   = document.getElementById('show-resolved-global');

  var status  = fStatus   ? fStatus.value.trim()   : '';
  var type    = fType     ? fType.value.trim()     : '';
  var level   = fLevel    ? fLevel.value.trim()    : '';
  var onlyF   = fFindings ? fFindings.checked      : false;
  var q       = globalSearch ? normalizeQuery(globalSearch.value) : '';
  var showR   = showRes   ? showRes.checked        : false;
  var resolved = loadResolved();

  panel.querySelectorAll('tr.row').forEach(function(row) {
    var path = row.dataset.path || '';
    var show = true;
    if (!showR && resolved[path]) { row.style.display = 'none'; return; }
    if (status && row.dataset.status !== status) show = false;
    if (type   && row.dataset.type   !== type)   show = false;
    if (level  && row.dataset.level  !== level) show = false;
    if (onlyF  && !row.querySelector('.findings-list')) show = false;
    if (q) {
      var hay = row.dataset.search || '';
      if (!hay.includes(q)) show = false;
    }
    row.style.display = show ? '' : 'none';
  });
  updateRowCounts();
}

// Global search re-applies filters to EVERY panel so that switching tabs
// while a search is active preserves the match set.
function applyGlobalSearch() {
  document.querySelectorAll('.tab-panel').forEach(function(p) {
    applyFilters(p.id.replace('tab-', ''));
  });
}

function resetFilters(tabId) {
  var panel = document.getElementById('tab-' + tabId);
  if (!panel) return;
  ['.f-status', '.f-type', '.f-level-sel'].forEach(function(sel) {
    var el = panel.querySelector(sel); if (el) el.value = '';
  });
  var cb = panel.querySelector('.f-findings'); if (cb) cb.checked = false;
  applyFilters(tabId);
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
        return '<li><a href="' + esc(p.replace(/^pages\\//,'../')) + '" target="_blank">' + esc(label) + '</a></li>';
      }).join('') + '</ul>'
    : '<span style="color:var(--adm-ink3);font-size:0.8rem">None found.</span>';

  var contentPath = path.replace(/^pages\\//,'content/').replace(/\\.html$/,'.md');
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
        '<span class="dk">content_review</span><span class="dv">' + esc(data.content_review||'—') + '</span>' +
        (data.content_sources && data.content_sources.length ? '<span class="dk">sources</span><span class="dv">' + data.content_sources.map(function(s){return'<span class="src">'+esc(s)+'</span>';}).join(' ') + '</span>' : '') +
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
      '<a class="dact" href="' + esc(path.replace(/^pages\\//,'../')) + '" target="_blank" rel="noopener">View page ↗</a>' +
      (!resolvedNow
        ? '<button class="dact dact-resolve" onclick="markResolved(\\'' + escapeSingleQuote(path) + '\\',\\'\\')">Mark resolved</button>'
        : '<button class="dact" onclick="markUnresolved(\\'' + escapeSingleQuote(path) + '\\')">Unmark resolved</button>') +
      '<button class="dact" onclick="copyDrawerFindings(\\'' + escapeSingleQuote(path) + '\\')">Copy findings</button>' +
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

  if (e.key === '/' ) { e.preventDefault(); var gs = document.getElementById('global-search'); if(gs) gs.focus(); return; }
  if (e.key === 'j' && !e.metaKey) { e.preventDefault(); var n = idx < rows.length-1 ? rows[idx+1] : rows[0]; if(n) n.focus(); return; }
  if (e.key === 'k' && !e.metaKey) { e.preventDefault(); var p = idx > 0 ? rows[idx-1] : rows[rows.length-1]; if(p) p.focus(); return; }
  if (e.key === 'Enter' && focused && focused.dataset.path) { openDrawer(focused.dataset.path); return; }
  if (e.key === 'x' && focused && focused.dataset.path) {
    var path = focused.dataset.path;
    if (isResolved(path)) markUnresolved(path); else markResolved(path, '');
    return;
  }
});

// ── Jump from stat tile to Needs Review pre-filtered by state ───────────────
function jumpToState(state) {
  showTab('needs-review');
  var panel = document.getElementById('tab-needs-review');
  if (!panel) return;
  var sel = panel.querySelector('.f-status');
  if (sel) { sel.value = state; applyFilters('needs-review'); }
  // Scroll the table into view in case the stat-bar was above the fold.
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Lock out ─────────────────────────────────────────────────────────────────
function lockOut() {
  try { localStorage.removeItem('shuwu_key'); } catch {}
  window.location.replace('../../index.html');
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  // Global search: one input drives every panel.
  var gs = document.getElementById('global-search');
  if (gs) {
    gs.addEventListener('input', applyGlobalSearch);
    var clearBtn = document.getElementById('global-search-clear');
    if (clearBtn) clearBtn.addEventListener('click', function() {
      gs.value = ''; applyGlobalSearch(); gs.focus();
    });
  }

  // Per-tab selector filters
  document.querySelectorAll('.tab-panel').forEach(function(panel) {
    var tabId = panel.id.replace('tab-', '');
    panel.querySelectorAll('.f-status, .f-type, .f-level-sel, .f-findings').forEach(function(el) {
      el.addEventListener('input', function() { applyFilters(tabId); });
      el.addEventListener('change', function() { applyFilters(tabId); });
    });
    // Sort headers
    panel.querySelectorAll('th[data-sort]').forEach(function(th) {
      th.addEventListener('click', function() { sortTable(tabId, th.dataset.sort); });
    });
    // Export / reset buttons
    var exportBtn = panel.querySelector('.export-btn');
    if (exportBtn) exportBtn.addEventListener('click', function() { exportMarkdown(tabId); });
    var resetBtn = panel.querySelector('.reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', function() { resetFilters(tabId); });
  });

  var showRes = document.getElementById('show-resolved-global');
  if (showRes) showRes.addEventListener('change', function() {
    refreshResolvedUI();
    applyGlobalSearch();
  });

  refreshResolvedUI();
  showTab('needs-review');
});
`;

// ── Tab HTML builder ──────────────────────────────────────────────────────────

function filterBarHtml(tabId, includeStateFilter = false) {
  const stateOpts = includeStateFilter
    ? `<label>State <select class="f-status"><option value="">all states</option>${
        REVIEW_STATES.map(s => `<option>${esc(s)}</option>`).join('')
      }</select></label><div class="filter-divider"></div>`
    : '';
  return `<div class="filter-bar">
    ${stateOpts}
    <label>Type <select class="f-type"><option value="">all types</option><option>character</option><option>vocab</option><option>topic</option><option>grammar</option><option>chengyu</option><option>hub</option></select></label>
    <label>Level <select class="f-level-sel"><option value="">all levels</option><option>ERROR</option><option>WARN</option><option>INFO</option></select></label>
    <label><input type="checkbox" class="f-findings"> Has findings</label>
    <span class="filter-count"></span>
    <div class="filter-actions">
      <button class="reset-btn" type="button">Reset</button>
      <button class="export-btn" type="button">Export markdown</button>
    </div>
  </div>`;
}

function tableHtml(rows, includeState = false) {
  const stateCol = includeState ? `<th data-sort="status" class="c-state">State <span class="sort-arrow"></span></th>` : '';
  const colspan  = includeState ? 4 : 3;
  const emptyMsg = includeState
    ? 'Nothing needs attention right now.'
    : 'No findings in this category.';
  return `<table class="review-table">
    <thead>
      <tr>${stateCol}<th data-sort="title">Page <span class="sort-arrow"></span></th><th>Findings</th><th></th></tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="${colspan}" class="no-rows">${emptyMsg}</td></tr>`}
    </tbody>
  </table>`;
}

function tabPanelHtml(tabId, label, descHtml, contentHtml) {
  return `<div id="tab-${tabId}" class="tab-panel">
    <div class="panel-head">
      <h2>${esc(label)}</h2>
      ${descHtml ? `<div class="panel-desc">${descHtml}</div>` : ''}
    </div>
    ${contentHtml}
  </div>`;
}

// ── Assemble all tab panels ───────────────────────────────────────────────────

const nrCount = needsAttentionEntries.length + [...errorPaths].filter(p => !allReviewableEntries.some(([ep]) => ep === p)).length;
const needsDesc = nrCount === 0
  ? 'All reviewable entries are verified. Use the state filter to browse any subset.'
  : 'Every complete entry, sorted so items needing attention come first. Use the state filter to narrow to a single review state.';

const panelNeeds = tabPanelHtml('needs-review', 'All Entries',
  needsDesc + ` <span class="kbd">/</span> search · <span class="kbd">j</span><span class="kbd">k</span> navigate · <span class="kbd">Enter</span> inspect · <span class="kbd">x</span> resolve`,
  filterBarHtml('needs-review', true) +
  tableHtml(needsReviewRows + errorOnlyRows, true)
);

function buildTabPanel(tabDef) {
  const tc = tabContents[tabDef.id];
  if (!tc) return '';
  const { rows, globalHtml, count } = tc;
  const label = TAB_LABELS[tabDef.id] || tabDef.id;
  const desc = count === 0 ? '' : `${count} entr${count === 1 ? 'y' : 'ies'} with findings in this category.`;
  return tabPanelHtml(tabDef.id, label, desc,
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
const TAB_LABELS = {
  'needs-review': 'All Entries',
  'factual':      'Factual',
  'schema':       'Schema & Tags',
  'links':        'Links',
  'layout':       'Layout',
  'health':       'Content Health',
  'relations':    'Relations',
  'search':       'Search',
  'formatting':   'Formatting',
  'analytics':    'Analytics',
};

const tabButtonsHtml = TAB_DEFS.map(t => {
  let badgeHtml = '';
  if (t.id === 'needs-review') {
    const nr = needsAttentionEntries.length + [...errorPaths].filter(p => !allReviewableEntries.some(([ep]) => ep === p)).length;
    if (nr > 0) badgeHtml = `<span class="tab-badge tb-err">${nr}</span>`;
  } else if (t.categories) {
    const errs  = t.categories.reduce((s, c) => s + ((catCounts[c] || {}).ERROR || 0), 0);
    const warns = t.categories.reduce((s, c) => s + ((catCounts[c] || {}).WARN  || 0), 0);
    const infos = t.categories.reduce((s, c) => s + ((catCounts[c] || {}).INFO  || 0), 0);
    const total = errs + warns + infos;
    if (total > 0) {
      const cls = errs > 0 ? 'tb-err' : warns > 0 ? 'tb-warn' : '';
      badgeHtml = `<span class="tab-badge ${cls}">${total}</span>`;
    }
  }
  const label = TAB_LABELS[t.id] || t.id;
  return `<button class="tab-btn" data-tab="${t.id}" onclick="showTab('${t.id}')">${esc(label)}${badgeHtml}</button>`;
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
    <div class="adm-header-brand">
      <span class="brand-cn">书屋管理台</span>
      <span class="brand-en">Admin · 角落書屋</span>
    </div>
    <div class="global-search-wrap">
      <input id="global-search" type="text"
             placeholder="Search entries by title, pinyin, char, tag, finding…"
             autocomplete="off" spellcheck="false"
             aria-label="Search all entries">
      <span class="gs-hint">press /</span>
      <button id="global-search-clear" type="button" aria-label="Clear search">×</button>
    </div>
    <div class="adm-header-right">
      <label class="show-resolved-label">
        <input type="checkbox" id="show-resolved-global"> Show resolved
      </label>
      <div class="adm-lock-out" onclick="lockOut()" title="Clear key and return home">Lock out</div>
    </div>
  </header>

  <div class="adm-header-meta">
    <span>findings updated ${esc(genTime)}</span>
    <span class="sep">·</span>
    <span>${summary.errors || 0} errors · ${summary.warnings || 0} warnings · ${summary.info || 0} info</span>
  </div>

  <!-- Stat bar: review state + severity counts + entry totals
       Clickable tiles jump to the Needs Review tab and pre-filter by state. -->
  <div class="stat-bar">
    <div class="stat-item s-verified stat-clickable" onclick="jumpToState('verified')" title="Show only verified entries">
      <span class="stat-n">${stateCounts.verified}</span>
      <span class="stat-l">Verified</span>
    </div>
    <div class="stat-item s-pending stat-clickable" onclick="jumpToState('pending')" title="Show only pending entries">
      <span class="stat-n">${stateCounts.pending}</span>
      <span class="stat-l">Pending</span>
    </div>
    <div class="stat-item s-unverified stat-clickable" onclick="jumpToState('unverified')" title="Show only unverified entries">
      <span class="stat-n">${stateCounts.unverified}</span>
      <span class="stat-l">Unverified</span>
    </div>
    <div class="stat-item s-muted stat-clickable" onclick="jumpToState('missing')" title="Show only entries with no review state">
      <span class="stat-n">${stateCounts.missing}</span>
      <span class="stat-l">Missing</span>
    </div>
    <div class="stat-item stat-group-start s-err">
      <span class="stat-n">${summary.errors || 0}</span>
      <span class="stat-l">Errors</span>
    </div>
    <div class="stat-item s-warn">
      <span class="stat-n">${summary.warnings || 0}</span>
      <span class="stat-l">Warnings</span>
    </div>
    <div class="stat-item s-muted">
      <span class="stat-n">${summary.info || 0}</span>
      <span class="stat-l">Info</span>
    </div>
    <div class="stat-item stat-group-start s-muted">
      <span class="stat-n">${completeCount}</span>
      <span class="stat-l">Complete</span>
    </div>
    <div class="stat-item s-muted">
      <span class="stat-n">${stubCount}</span>
      <span class="stat-l">Stubs</span>
    </div>
    <div class="stat-item s-muted">
      <span class="stat-n">${entries.length}</span>
      <span class="stat-l">Total</span>
    </div>
  </div>

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

// ── Build-time invariants: catch manual edits that silently break the UI ─────
// If you rename a tab id, tweak TAB_LABELS, or reorder the state filter and
// one of these assertions throws, the build fails with a clear message.
for (const t of TAB_DEFS) {
  if (!TAB_LABELS[t.id]) {
    throw new Error(`build-admin: TAB_DEFS has id '${t.id}' with no matching TAB_LABELS entry`);
  }
}
for (const s of REVIEW_STATES) {
  if (!html.includes(`<option>${s}</option>`)) {
    throw new Error(`build-admin: review state '${s}' missing from the state filter <select> — filterBarHtml drift`);
  }
}
const needsRowCount = (html.match(/<tr class="row /g) || []).length;
const expectedMinRows = allReviewableEntries.length;
if (needsRowCount < expectedMinRows) {
  throw new Error(`build-admin: rendered only ${needsRowCount} rows but ${expectedMinRows} reviewable entries exist — row rendering drift`);
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, html);

const needsAttention = needsAttentionEntries.length + [...errorPaths].filter(p => !allReviewableEntries.some(([ep]) => ep === p)).length;
console.log(`✓ build-admin: pages/_admin/review.html — ${needsAttention} items needing attention, ${findings.length} total findings`);
