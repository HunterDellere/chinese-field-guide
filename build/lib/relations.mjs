/**
 * Compute related entries by IDF-weighted tag similarity + structural signals.
 * Returns Map<entryPath, RelatedEntry[]> with up to MAX_RELATED per entry.
 *
 * Tag scoring:
 *   - Rare tags count more (classic IDF: idf = log((N+1)/(df(t)+1)))
 *   - Weighted Jaccard = Σ idf(shared) / Σ idf(union) — common "bucket" tags
 *     like "culture", "history", "philosophy" contribute little; specific tags
 *     like "wuxing", "chan", "confucianism" dominate a match.
 *   - Meta-tags that duplicate category/structure (radical, chengyu, hub,
 *     grammar, vocabulary, characters, wordlist, hsk, stub) are ignored — they
 *     describe what a page IS, not what it's ABOUT.
 *   - Within a category, tags that cover >50% of that category (e.g. "idioms"
 *     across chengyu, or "grammar" across grammar pages) are suppressed so
 *     same-category pairs don't score trivially max on the category-label tag.
 *
 * Structural bonuses (additive):
 *   BONUS_SAME_CATEGORY       — entries in the same category
 *   BONUS_SHARED_RADICAL      — character entries sharing the same radical
 *   BONUS_HSK_PROXIMITY       — both have HSK and are within 1 level
 *   BONUS_CONTAINS_CHARACTER  — one entry's char appears in the other's CN title prefix
 */

const MAX_RELATED = 8;
const MIN_SCORE = 0.18;
// Ensure every complete page has at least this many related entries when possible,
// by relaxing the threshold only for the pages that would otherwise be too sparse.
const MIN_PER_PAGE = 4;
const FALLBACK_MIN_SCORE = 0.08;

const BONUS_SAME_CATEGORY      = 0.08;
const BONUS_SHARED_RADICAL     = 0.22;
const BONUS_HSK_PROXIMITY      = 0.06;
const BONUS_CONTAINS_CHARACTER = 0.25;

// Tags that describe what an entry IS (structural/meta), not what it's about.
// These are excluded from tag similarity scoring. The structural signal they
// carry is already captured by category and the shared-radical bonus.
const META_TAGS = new Set([
  'radical', 'hub', 'wordlist', 'hsk', 'chengyu', 'characters',
  'vocabulary', 'grammar', 'hanzi', 'stub', 'meta',
]);

// Tags whose in-category prevalence above this fraction gets them suppressed
// WITHIN that category (i.e., two chengyu won't match on "idioms" alone).
const IN_CATEGORY_PREVALENCE_CUTOFF = 0.5;

/** Normalise HSK to a single number (use midpoint for ranges). */
function hskMid(hsk) {
  if (typeof hsk === 'number') return hsk;
  if (hsk && typeof hsk === 'object' && 'from' in hsk) return (hsk.from + hsk.to) / 2;
  return null;
}

/** Leading Chinese phrase from a title ("感谢 · …" → "感谢"). */
function cnPrefix(title) {
  if (!title) return '';
  return title.split('·')[0].trim();
}

/**
 * Build tag statistics used by the weighted scorer.
 * - df(t): number of complete entries that carry tag t
 * - idf(t): log((N + 1) / (df(t) + 1)) — smoothed, always ≥ 0
 * - inCategoryDf(t, cat): count of entries in `cat` carrying tag t
 * - suppressedInCategory(cat): Set of tags whose in-category prevalence
 *   exceeds IN_CATEGORY_PREVALENCE_CUTOFF — these are structural within that
 *   category and are ignored for same-category pairs.
 */
function buildTagStats(entries) {
  const N = entries.length;
  const df = new Map();
  const categoryCounts = new Map();
  const inCatDf = new Map(); // `${cat}::${tag}` → count

  for (const e of entries) {
    categoryCounts.set(e.category, (categoryCounts.get(e.category) || 0) + 1);
    for (const t of (e.tags || [])) {
      if (META_TAGS.has(t)) continue;
      df.set(t, (df.get(t) || 0) + 1);
      const k = `${e.category}::${t}`;
      inCatDf.set(k, (inCatDf.get(k) || 0) + 1);
    }
  }

  const idf = new Map();
  for (const [t, count] of df) {
    idf.set(t, Math.log((N + 1) / (count + 1)));
  }

  const suppressedInCategory = new Map(); // cat → Set<tag>
  for (const [k, count] of inCatDf) {
    const [cat, tag] = k.split('::');
    const catSize = categoryCounts.get(cat) || 1;
    if (count / catSize > IN_CATEGORY_PREVALENCE_CUTOFF) {
      if (!suppressedInCategory.has(cat)) suppressedInCategory.set(cat, new Set());
      suppressedInCategory.get(cat).add(tag);
    }
  }

  return { idf, suppressedInCategory };
}

function effectiveTags(entry, stats, otherCategory) {
  // Drop meta-tags entirely. Drop tags that are structural within a shared
  // category (so two chengyu don't match on "idioms" alone).
  const out = new Set();
  const sameCat = entry.category === otherCategory;
  const suppressed = sameCat ? stats.suppressedInCategory.get(entry.category) : null;
  for (const t of (entry.tags || [])) {
    if (META_TAGS.has(t)) continue;
    if (suppressed && suppressed.has(t)) continue;
    out.add(t);
  }
  return out;
}

function score(a, b, stats) {
  let s = 0;
  const reasons = []; // { kind, weight, label }

  // IDF-weighted tag Jaccard
  const tagsA = effectiveTags(a, stats, b.category);
  const tagsB = effectiveTags(b, stats, a.category);
  if (tagsA.size > 0 && tagsB.size > 0) {
    let sharedW = 0;
    let unionW = 0;
    let bestShared = null;
    let bestSharedW = -1;
    const union = new Set([...tagsA, ...tagsB]);
    for (const t of union) {
      const w = stats.idf.get(t) || 0;
      unionW += w;
      if (tagsA.has(t) && tagsB.has(t)) {
        sharedW += w;
        if (w > bestSharedW) { bestSharedW = w; bestShared = t; }
      }
    }
    if (unionW > 0 && sharedW > 0) {
      const wJaccard = sharedW / unionW;
      s += wJaccard;
      // Weight the reason by IDF so rare-tag matches outrank bucket-tag matches
      // when the "primary reason" is picked below.
      reasons.push({ kind: 'tag', weight: bestSharedW, label: bestShared });
    }
  }

  if (a.category === b.category) {
    s += BONUS_SAME_CATEGORY;
    // Category is a weak signal; only used as the reason if nothing stronger applies.
    reasons.push({ kind: 'category', weight: BONUS_SAME_CATEGORY, label: a.category });
  }

  // Shared radical (character pages only)
  if (a.radical && b.radical && a.radical === b.radical) {
    s += BONUS_SHARED_RADICAL;
    reasons.push({ kind: 'radical', weight: BONUS_SHARED_RADICAL, label: a.radical });
  }

  // HSK proximity (within 1 level) — a weak, supporting signal only.
  // Never used as the primary reason; reserved for the tie-breaker role.
  const ha = hskMid(a.hsk);
  const hb = hskMid(b.hsk);
  if (ha !== null && hb !== null && Math.abs(ha - hb) <= 1) {
    s += BONUS_HSK_PROXIMITY;
    reasons.push({ kind: 'hsk', weight: BONUS_HSK_PROXIMITY, label: `HSK ${Math.round(ha)}` });
  }

  // Contains-the-character: one entry's char appears in the other's CN title prefix.
  // Requires the source char to be a single glyph to avoid noise on multi-char keys.
  if (a.char && a.char.length === 1 && cnPrefix(b.title).includes(a.char)) {
    s += BONUS_CONTAINS_CHARACTER;
    reasons.push({ kind: 'contains', weight: BONUS_CONTAINS_CHARACTER, label: `contains ${a.char}` });
  }
  if (b.char && b.char.length === 1 && cnPrefix(a.title).includes(b.char)) {
    s += BONUS_CONTAINS_CHARACTER;
    reasons.push({ kind: 'contains', weight: BONUS_CONTAINS_CHARACTER, label: `in ${b.char}` });
  }

  // Primary reason = most specific strong signal.
  // Priority: contains/radical > high-IDF tag > lower-IDF tag > hsk > category.
  const PRIORITY = { contains: 5, radical: 4, tag: 3, hsk: 2, category: 1 };
  reasons.sort((x, y) => {
    const p = (PRIORITY[y.kind] || 0) - (PRIORITY[x.kind] || 0);
    if (p !== 0) return p;
    return y.weight - x.weight;
  });
  const primary = reasons[0] || null;

  return { score: s, reason: primary };
}

/** Resolve explicit `related` slugs from frontmatter to full entry objects. */
function resolveExplicit(slugs, allEntries) {
  if (!slugs || !slugs.length) return [];
  const byPath = new Map(allEntries.map(e => [e.path, e]));
  return slugs
    .map(slug => {
      // Accept "characters/gan3_感" or full "pages/characters/gan3_感.html"
      const normalized = slug.startsWith('pages/') ? slug
        : slug.endsWith('.html') ? `pages/${slug}`
        : `pages/${slug}.html`;
      return byPath.get(normalized) || null;
    })
    .filter(Boolean);
}

export function buildRelations(entries) {
  const complete = entries.filter(e => e.status === 'complete');
  const stats = buildTagStats(complete);
  const relations = new Map();

  for (const a of complete) {
    // Explicit author-specified related entries come first (deduped below).
    // Author picks don't need a reason chip — they're curated.
    const explicit = resolveExplicit(a.related, complete).map(entry => ({ entry, reason: null }));
    const explicitPaths = new Set(explicit.map(r => r.entry.path));

    // Score every candidate once; keep the full ranking so we can pull extras
    // at a relaxed threshold if the strict pass leaves a page under-linked.
    const allScored = [];
    for (const b of complete) {
      if (a.path === b.path) continue;
      if (explicitPaths.has(b.path)) continue;
      const { score: s, reason } = score(a, b, stats);
      if (s >= FALLBACK_MIN_SCORE) allScored.push({ entry: b, s, reason });
    }
    allScored.sort((x, y) => y.s - x.s || x.entry.title.localeCompare(y.entry.title));

    const strong = allScored.filter(x => x.s >= MIN_SCORE);
    const derivedRaw = strong.length + explicit.length >= MIN_PER_PAGE
      ? strong
      : allScored.slice(0, Math.max(strong.length, MIN_PER_PAGE - explicit.length));

    const derived = derivedRaw.slice(0, MAX_RELATED).map(x => ({ entry: x.entry, reason: x.reason }));
    const merged = [...explicit, ...derived].slice(0, MAX_RELATED);
    relations.set(a.path, merged);
  }

  return relations;
}

export function buildAdjacency(entries) {
  const complete = entries.filter(e => e.status === 'complete');
  const byCategory = {};
  for (const e of complete) {
    (byCategory[e.category] = byCategory[e.category] || []).push(e);
  }
  for (const cat of Object.keys(byCategory)) {
    byCategory[cat].sort((a, b) => a.title.localeCompare(b.title, 'en'));
  }

  const adjacency = new Map();
  for (const cat of Object.keys(byCategory)) {
    const list = byCategory[cat];
    list.forEach((e, i) => {
      adjacency.set(e.path, {
        prev: i > 0 ? list[i - 1] : null,
        next: i < list.length - 1 ? list[i + 1] : null,
      });
    });
  }
  return adjacency;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const REASON_PREFIX = {
  radical:  'shares radical',
  contains: '',  // label already reads "contains 心" / "in 道"
  tag:      'theme',
  hsk:      'level',
  category: 'same section',
};

function reasonChipHtml(reason) {
  if (!reason) return '';
  const prefix = REASON_PREFIX[reason.kind] || '';
  // For "contains" the label is already a full phrase; otherwise combine "prefix · label"
  let text;
  if (reason.kind === 'contains') {
    text = reason.label;
  } else if (prefix && reason.label) {
    text = `${prefix} · ${reason.label}`;
  } else {
    text = prefix || reason.label || '';
  }
  if (!text) return '';
  return `<span class="rl-reason rl-reason-${reason.kind}">${escapeHtml(text)}</span>`;
}

/**
 * Build a one-line "detail" for a Related card: a short, useful gloss that
 * isn't already covered by the english title. Falls back to '' if nothing
 * stronger than the english title is available.
 */
function cardDetail(e) {
  const candidates = [];
  if (e.desc) candidates.push(e.desc);
  if (e.metaDesc && e.metaDesc !== e.desc) candidates.push(e.metaDesc);
  for (const c of candidates) {
    // Strip any leading "X is/means" boilerplate that just restates the title
    const trimmed = c.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

/**
 * Render the new Related section: a card gallery with category color-coding,
 * one TOC-discoverable section. Cards carry hanzi + pinyin + english + a
 * one-line detail + the reason chip. The chips tier (legacy `.adj-wrap`) is
 * hoisted in by build.mjs from the content body if present.
 *
 * Returns a `<section class="section-anchor" id="related">` so toc-scroll.js
 * picks it up automatically. The section is empty/omitted only when there's
 * nothing to show (no related, no chips).
 */
export function renderRelatedHtml(related, fromPath, opts = {}) {
  const hasCards = related && related.length > 0;
  if (!hasCards && !opts.hasChips) return '';

  const cards = (related || []).map(r => {
    const e = r.entry || r;
    const reason = r.reason || null;
    const href = relativePath(fromPath, e.path);
    const cn = e.char || (e.title ? e.title.split('·')[0].trim() : '');
    const py = e.pinyin || '';
    const titleEn = e.title ? e.title.split('·').slice(1).join('·').trim() || e.title : '';
    const detail = cardDetail(e);
    const sizeClass = cn.length >= 4 ? ' rl-multi' : '';
    const cat = e.category || '';
    return `<a class="related-card${sizeClass}" href="${escapeHtml(href)}" data-category="${escapeHtml(cat)}">` +
             `<span class="rc-head">` +
               (cn ? `<span class="rc-cn">${escapeHtml(cn)}</span>` : '') +
               (py ? `<span class="rc-py">${escapeHtml(py)}</span>` : '') +
             `</span>` +
             `<span class="rc-en">${escapeHtml(titleEn)}</span>` +
             (detail ? `<span class="rc-detail">${escapeHtml(detail)}</span>` : '') +
             reasonChipHtml(reason) +
           `</a>`;
  }).join('\n        ');

  const cardsBlock = hasCards
    ? `\n      <div class="related-cards">\n        ${cards}\n      </div>`
    : '';

  // Chips placeholder — build.mjs replaces this with the hoisted .adj-wrap
  // block, including a `.related-chips-head` subhead, when the page has chips.
  const chipsSlot = opts.hasChips ? `\n      <!--RELATED_CHIPS_SLOT-->` : '';

  return `
    <span class="section-anchor" id="related"></span>
    <div class="section-head">
      <span class="sh-cn">相关</span>
      <span class="sh-py">xiāngguān</span>
      <span class="sh-en">Related</span>
      <span class="sh-rule"></span>
    </div>
    <section class="related" aria-labelledby="related-label">
      <span class="related-label sr-only" id="related-label">Related entries — pages and vocabulary in the neighbourhood of this one</span>${cardsBlock}${chipsSlot}
    </section>`;
}

export function renderAdjacencyHtml(adj, fromPath) {
  if (!adj || (!adj.prev && !adj.next)) return '';
  const linkHtml = (e, dir) => {
    if (!e) return `<span class="pn-empty"></span>`;
    const href = relativePath(fromPath, e.path);
    const cn = e.char || (e.title ? e.title.split('·')[0].trim() : '');
    const py = e.pinyin || '';
    const arrow = dir === 'prev' ? '←' : '→';
    return `<a class="pn-link pn-${dir}" href="${escapeHtml(href)}" rel="${dir}">
        <span class="pn-arrow">${arrow}</span>
        <span class="pn-meta">
          <span class="pn-label">${dir === 'prev' ? 'Previous' : 'Next'}</span>
          <span class="pn-title">${cn ? `<span class="pn-cn">${escapeHtml(cn)}</span>` : ''}${py ? ` <span class="pn-py">${escapeHtml(py)}</span>` : ''}</span>
        </span>
      </a>`;
  };
  return `
    <nav class="prev-next" aria-label="Within this section">
      ${linkHtml(adj.prev, 'prev')}
      ${linkHtml(adj.next, 'next')}
    </nav>`;
}

function relativePath(fromPath, toPath) {
  const fromParts = fromPath.split('/').slice(0, -1);
  const toParts = toPath.split('/');
  let common = 0;
  while (common < fromParts.length && common < toParts.length - 1 && fromParts[common] === toParts[common]) common++;
  const ups = fromParts.length - common;
  const downs = toParts.slice(common);
  return ('../'.repeat(ups) + downs.join('/')) || './';
}
