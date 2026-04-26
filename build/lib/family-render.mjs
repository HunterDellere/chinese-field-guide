/**
 * family-render.mjs — Build-time rendering for family-index pages.
 *
 * A "family" is a top-level grouping of categories shown on a dedicated
 * index page (pages/families/<family>.html). Three families today plus a
 * master "explore" page:
 *
 *   language     → characters, vocab, grammar
 *   topics       → philosophy, religion, history, geography, culture,
 *                  daily, culinary, arts, science
 *   collections  → chengyu, hubs
 *   explore      → master hub: shows the three family cards, then a
 *                  flat browseable list of every category at the bottom
 *
 * Adding a new category to a family: append its key to the family's
 * member array in FAMILY_MEMBERS below. Adding a new family: add an entry
 * to FAMILY_MEMBERS, FAMILY_META, and create content/families/<key>.md.
 *
 * Output is injected into family pages by build.mjs via marker replacement:
 *   <!--FAMILY_CONTENT-->    → renderFamilyContent(family, entries)
 *   <!--FAMILY_CROSSLINKS--> → renderFamilyCrosslinks(family) (currently no-op)
 *
 * The family hero is text-only — there's no decorative art behind the meta
 * block. Card art (familyCardArt below) is still used for the small cards
 * on the homepage hub, the Explore page, and any future surfaces.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// ── family configuration ────────────────────────────────────────────────────

export const FAMILY_MEMBERS = {
  language:    ['characters', 'vocab', 'grammar'],
  topics:      ['philosophy', 'religion', 'history', 'geography', 'culture', 'daily', 'culinary', 'arts', 'science'],
  // Reading paths lead because they're the more on-brand "collection" — guided
  // walks through clusters of entries — and they also appear less-frequently
  // elsewhere on the site than chengyu does.
  collections: ['hubs', 'chengyu'],
  // explore renders the three family cards itself; no member categories here.
  explore:     [],
};

export const FAMILY_META = {
  explore:     { cn: '探',   py: 'tàn',     en: 'Explore',     desc: 'The master entry point. Three families, every category.' },
  language:    { cn: '语言', py: 'yǔyán',   en: 'Language',    desc: 'Characters, vocabulary, grammar. The building blocks.' },
  topics:      { cn: '话题', py: 'huàtí',   en: 'Topics',      desc: 'Thought, place, time, lived life. What the language is used to say.' },
  collections: { cn: '集锦', py: 'jíjǐn',   en: 'Collections', desc: 'Idioms and curated reading paths. Entries grouped to be read together.' },
};

// Single source of truth: data/category-meta.json (also fetched by
// scripts/homepage.js at runtime). Read once at module load — the build
// is single-pass, so a stale snapshot during a build is impossible.
const CATEGORY_META = JSON.parse(
  readFileSync(join(ROOT, 'data', 'category-meta.json'), 'utf8')
);

// ── helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Path from a family page (pages/families/<key>.html) to a content page.
 * Family pages live one level deep inside pages/, so all entry paths
 * (already 'pages/<cat>/<slug>.html') resolve via '../<cat>/<slug>.html'.
 */
function familyHref(entryPath) {
  return entryPath.replace(/^pages\//, '../');
}

/** Pull the leading Chinese phrase from a title ("感 · to feel" → "感"). */
function leadCn(entry) {
  if (entry.char) return entry.char;
  if (entry.title) return entry.title.split('·')[0].trim();
  return '';
}

/** English part of "X · Y" → "Y". Falls back to title. */
function trailEn(entry) {
  if (!entry.title) return '';
  const parts = entry.title.split('·');
  if (parts.length < 2) return entry.title;
  return parts.slice(1).join('·').trim();
}

// ── card rendering ──────────────────────────────────────────────────────────

/**
 * Render one entry card. Mirrors the .entry-card markup that
 * scripts/homepage.js produces at runtime, so styling is shared.
 */
function renderEntryCard(entry) {
  const glyph = leadCn(entry);
  const len = glyph.length;
  const sizeClass = len >= 4 ? ' glyph-4' : len === 3 ? ' glyph-3' : len === 2 ? ' glyph-2' : '';
  const titleNoCn = trailEn(entry);
  const py = entry.pinyin || '';
  const desc = entry.desc || '';
  return `<a class="entry-card" href="${escapeHtml(familyHref(entry.path))}" data-category="${escapeHtml(entry.category || '')}">` +
           (glyph ? `<span class="entry-glyph${sizeClass}">${escapeHtml(glyph)}</span>` : '') +
           `<span class="entry-pinyin">${escapeHtml(py)}</span>` +
           `<span class="entry-title">${escapeHtml(titleNoCn)}</span>` +
           `<span class="entry-desc">${escapeHtml(desc)}</span>` +
         `</a>`;
}

/**
 * Render one category section: head + entry grid. Static HTML — no
 * collapse JS, since on family pages every category is expanded by default
 * (the page's purpose is browsing).
 */
const CAT_CALLOUTS = {
  geography: `
      <a class="map-callout" href="../maps/china.html" aria-label="Open the Interactive Map of China">
        <svg class="map-callout-icon" viewBox="0 0 100 90" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect width="100" height="90" fill="#dde8ef" rx="4"/>
          <path d="M24,11 L31,9 L40,7 L52,6 L63,5 L72,5 L81,7 L88,12 L92,18 L90,25 L85,30 L82,36 L82,44 L79,52 L74,58 L67,62 L60,65 L53,67 L46,67 L39,65 L33,62 L27,57 L22,51 L18,44 L16,37 L17,29 L19,22 Z" fill="#e8dcc8" stroke="#b8a888" stroke-width="1.5"/>
          <circle cx="75" cy="27" r="3" fill="#2a5c6b" opacity="0.8"/>
          <circle cx="80" cy="46" r="2.5" fill="#2a5c6b" opacity="0.6"/>
          <path d="M38,32 C45,30 55,29 63,30 C68,31 72,34 74,38 C72,42 65,44 57,43 C48,42 40,38 38,32Z" fill="none" stroke="#c8a830" stroke-width="1.8" opacity="0.7"/>
          <text x="50" y="55" text-anchor="middle" font-family="serif" font-size="9" fill="#5a4428" opacity="0.5">中国</text>
        </svg>
        <div class="map-callout-body">
          <span class="map-callout-label">Interactive · 互动地图</span>
          <span class="map-callout-title">中国地图 · Map of China</span>
          <span class="map-callout-desc">Toggle layers: modern provinces, dynastic extents, major rivers, dialect zones, and cultural sites. Click any marker to open the linked entry.</span>
        </div>
        <span class="map-callout-cta" aria-hidden="true">Open the map →</span>
      </a>`,
};

function renderCategorySection(catKey, entries) {
  const meta = CATEGORY_META[catKey];
  if (!meta) return '';
  const cards = entries.map(renderEntryCard).join('\n        ');
  const count = entries.length;
  const callout = CAT_CALLOUTS[catKey] || '';
  return `
    <section class="cat-group fam-cat-group" id="cat-${catKey}" data-category="${catKey}">
      <div class="cat-head fam-cat-head">
        <span class="sh-cn" style="color: var(--cat-${catKey})">${escapeHtml(meta.cn)}</span>
        <span class="sh-py">${escapeHtml(meta.py)}</span>
        <span class="sh-en">${escapeHtml(meta.en)}</span>
        <span class="sh-rule"></span>
        <span class="cat-count">${count} ${count === 1 ? 'entry' : 'entries'}</span>
      </div>
      <p class="fam-cat-desc">${escapeHtml(meta.desc)}</p>${callout}
      <div class="entry-grid">
        ${cards}
      </div>
      <a class="fam-cat-top" href="#top" aria-label="Back to category jumper">↑ Top</a>
    </section>`;
}

// ── family content (the entry-grids tier) ──────────────────────────────────

/**
 * Render the per-family entry-grid block. For non-explore families this is
 * the full set of category sections. For explore it's the three family
 * cards followed by a flat link list of every category.
 */
export function renderFamilyContent(family, entries) {
  if (family === 'explore') return renderExploreContent(entries);

  const memberKeys = FAMILY_MEMBERS[family];
  if (!memberKeys || memberKeys.length === 0) return '';

  // Group complete entries by category (stable order matches CAT_ORDER intent
  // because we iterate memberKeys in declaration order).
  const byCategory = new Map();
  for (const e of entries) {
    if (e.status !== 'complete') continue;
    if (!byCategory.has(e.category)) byCategory.set(e.category, []);
    byCategory.get(e.category).push(e);
  }
  // Sort each category's entries by title (locale-aware).
  for (const list of byCategory.values()) {
    list.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'en'));
  }

  const sections = memberKeys
    .map(k => renderCategorySection(k, byCategory.get(k) || []))
    .join('\n');

  // A small intro strip above the categories, summarising the family.
  const meta = FAMILY_META[family];
  const totalEntries = memberKeys.reduce((n, k) => n + (byCategory.get(k)?.length || 0), 0);
  const intro = `
    <div class="fam-intro">
      <span class="fam-intro-stat">${totalEntries} entries · ${memberKeys.length} categor${memberKeys.length === 1 ? 'y' : 'ies'}</span>
      <p class="fam-intro-text">${escapeHtml(meta.desc)}</p>
    </div>`;

  // In-page category jumper (chip-bar). Renders only when the family has
  // 2+ categories; for single-category families it would be visual noise.
  // Sticky-positioned via CSS so long Topics scrolls keep the jumper in
  // reach. Each chip is a same-page anchor — works without JS, and the
  // homepage's anchor handler smooth-scrolls + flashes the target.
  const chipBar = memberKeys.length >= 2 ? `
    <nav class="fam-jump" aria-label="Jump to a category">
      ${memberKeys.map(k => {
        const m = CATEGORY_META[k];
        const count = byCategory.get(k)?.length || 0;
        return `<a class="fam-jump-chip" href="#cat-${k}" data-category="${k}">
          <span class="fjc-cn">${escapeHtml(m.cn)}</span>
          <span class="fjc-en">${escapeHtml(m.en)}</span>
          <span class="fjc-count">${count}</span>
        </a>`;
      }).join('\n      ')}
    </nav>` : '';

  return intro + chipBar + sections;
}

/**
 * Explore page: three big family cards + a reference-style "all categories"
 * link list. Designed to be the master entry point and a good landing for
 * /#browse redirects.
 */
function renderExploreContent(entries) {
  // Family cards (large, image-driven; mirrors .families-card on homepage).
  const families = ['language', 'topics', 'collections'];
  const totalsByCategory = new Map();
  for (const e of entries) {
    if (e.status !== 'complete') continue;
    totalsByCategory.set(e.category, (totalsByCategory.get(e.category) || 0) + 1);
  }

  // Family cards intentionally omit a numeric entries-count for visual
  // consistency with the homepage hub (where the cards are hand-coded
  // without counts because the counts would silently drift). The
  // member-categories list below already conveys the family's scope.
  const familyCards = families.map(f => {
    const meta = FAMILY_META[f];
    const memberLabels = FAMILY_MEMBERS[f].map(k => CATEGORY_META[k]?.en).filter(Boolean).join(' · ');
    return `<a class="family-card" href="${f}.html" data-family="${f}">
        <div class="family-card-art" aria-hidden="true">${familyCardArt(f)}</div>
        <div class="family-card-meta">
          <span class="family-card-eyebrow">${escapeHtml(meta.cn)} ${escapeHtml(meta.py)}</span>
          <h3 class="family-card-title">${escapeHtml(meta.en)}</h3>
          <p class="family-card-desc">${escapeHtml(meta.desc)}</p>
          <span class="family-card-members">${escapeHtml(memberLabels)}</span>
        </div>
      </a>`;
  }).join('\n      ');

  // Per-family category clusters (reference-style: glyph + name + count).
  // Grouped by family so the relationship is visible at a glance and the
  // section reads as a quieter sub-navigation under the three big cards.
  // HSK and other family-less categories aren't surfaced here — they have
  // their own destinations elsewhere on the site.
  const familyClusters = families.map(f => {
    const fmeta = FAMILY_META[f];
    const memberKeys = FAMILY_MEMBERS[f].filter(k => totalsByCategory.has(k));
    if (memberKeys.length === 0) return '';
    const catLinks = memberKeys.map(k => {
      const m = CATEGORY_META[k];
      const count = totalsByCategory.get(k) || 0;
      return `<a class="all-cat-link" href="${f}.html#cat-${k}" data-category="${k}">
              <span class="acl-cn" style="color: var(--cat-${k})">${escapeHtml(m.cn)}</span>
              <span class="acl-en">${escapeHtml(m.en)}</span>
              <span class="acl-count">${count}</span>
            </a>`;
    }).join('\n            ');
    return `
        <div class="all-cats-family">
          <a class="all-cats-family-head" href="${f}.html">
            <span class="acfh-cn">${escapeHtml(fmeta.cn)}</span>
            <span class="acfh-en">${escapeHtml(fmeta.en)}</span>
          </a>
          <div class="all-cats-family-list">
            ${catLinks}
          </div>
        </div>`;
  }).filter(Boolean).join('\n');

  return `
    <div class="families-grid">
      ${familyCards}
    </div>

    <span class="section-anchor" id="all-categories"></span>
    <div class="all-cats-clusters">
      ${familyClusters}
    </div>

    <span class="section-anchor" id="maps"></span>
    <div class="section-head">
      <span class="sh-cn">地图</span>
      <span class="sh-en">Interactive Maps</span>
    </div>
    <a class="map-callout" href="../maps/china.html" aria-label="Open the Interactive Map of China">
      <svg class="map-callout-icon" viewBox="0 0 100 90" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect width="100" height="90" fill="#dde8ef" rx="4"/>
        <path d="M24,11 L31,9 L40,7 L52,6 L63,5 L72,5 L81,7 L88,12 L92,18 L90,25 L85,30 L82,36 L82,44 L79,52 L74,58 L67,62 L60,65 L53,67 L46,67 L39,65 L33,62 L27,57 L22,51 L18,44 L16,37 L17,29 L19,22 Z" fill="#e8dcc8" stroke="#b8a888" stroke-width="1.5"/>
        <circle cx="75" cy="27" r="3" fill="#2a5c6b" opacity="0.8"/>
        <circle cx="80" cy="46" r="2.5" fill="#2a5c6b" opacity="0.6"/>
        <path d="M38,32 C45,30 55,29 63,30 C68,31 72,34 74,38 C72,42 65,44 57,43 C48,42 40,38 38,32Z" fill="none" stroke="#c8a830" stroke-width="1.8" opacity="0.7"/>
        <text x="50" y="55" text-anchor="middle" font-family="serif" font-size="9" fill="#5a4428" opacity="0.5">中国</text>
      </svg>
      <div class="map-callout-body">
        <span class="map-callout-label">Interactive · 互动地图</span>
        <span class="map-callout-title">中国地图 · Map of China</span>
        <span class="map-callout-desc">Toggle layers: modern provinces, dynastic extents, major rivers, dialect zones, and cultural sites. Click any marker to open the linked entry.</span>
      </div>
      <span class="map-callout-cta" aria-hidden="true">Open the map →</span>
    </a>`;
}

// ── crosslinks (bottom-of-page navigation between families) ────────────────

/**
 * Bottom-of-page family crosslinks intentionally omitted — every family
 * page's sidebar already lists the other families ("Other families")
 * plus the master Explore link, so a duplicate footer card row would
 * just be visual noise. The function is preserved as a no-op so the
 * build pipeline doesn't need to special-case the marker; the
 * <!--FAMILY_CROSSLINKS--> marker simply gets replaced with empty.
 */
export function renderFamilyCrosslinks(family) {
  return '';
}

// ── re-exports & art accessors ─────────────────────────────────────────────

/**
 * SVG art for a family-card (used on Explore + the homepage 3-card hub).
 */
import { familyCardArt } from './family-art.mjs';
export { familyCardArt };
