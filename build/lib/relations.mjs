/**
 * Compute related entries by Jaccard similarity over tags + structural signals.
 * Returns Map<entryPath, RelatedEntry[]> with up to MAX_RELATED per entry.
 *
 * Scorer bonuses (additive, tunable):
 *   BONUS_SAME_CATEGORY       — entries in the same category
 *   BONUS_SHARED_RADICAL      — character entries sharing the same radical
 *   BONUS_HSK_PROXIMITY       — both have HSK and are within 1 level of each other
 *   BONUS_CONTAINS_CHARACTER  — one entry's char appears in the other's CN title prefix
 */

const MAX_RELATED = 5;
const MIN_SCORE = 0.15;

const BONUS_SAME_CATEGORY      = 0.08;
const BONUS_SHARED_RADICAL     = 0.20;
const BONUS_HSK_PROXIMITY      = 0.08;
const BONUS_CONTAINS_CHARACTER = 0.25;

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

function score(a, b) {
  const tagsA = new Set(a.tags || []);
  const tagsB = new Set(b.tags || []);
  let s = 0;

  // Tag Jaccard
  if (tagsA.size > 0 || tagsB.size > 0) {
    let intersect = 0;
    for (const t of tagsA) if (tagsB.has(t)) intersect++;
    const union = tagsA.size + tagsB.size - intersect;
    if (union > 0) s += intersect / union;
  }

  if (a.category === b.category) s += BONUS_SAME_CATEGORY;

  // Shared radical (character pages only)
  if (a.radical && b.radical && a.radical === b.radical) s += BONUS_SHARED_RADICAL;

  // HSK proximity (within 1 level)
  const ha = hskMid(a.hsk);
  const hb = hskMid(b.hsk);
  if (ha !== null && hb !== null && Math.abs(ha - hb) <= 1) s += BONUS_HSK_PROXIMITY;

  // Contains-the-character: one entry's char appears in the other's CN title prefix
  if (a.char && cnPrefix(b.title).includes(a.char)) s += BONUS_CONTAINS_CHARACTER;
  if (b.char && cnPrefix(a.title).includes(b.char)) s += BONUS_CONTAINS_CHARACTER;

  return s;
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
  const relations = new Map();

  for (const a of complete) {
    // Explicit author-specified related entries come first (deduped below)
    const explicit = resolveExplicit(a.related, complete);
    const explicitPaths = new Set(explicit.map(e => e.path));

    const scored = [];
    for (const b of complete) {
      if (a.path === b.path) continue;
      if (explicitPaths.has(b.path)) continue; // already in explicit list
      const s = score(a, b);
      if (s >= MIN_SCORE) scored.push({ entry: b, s });
    }
    scored.sort((x, y) => y.s - x.s || x.entry.title.localeCompare(y.entry.title));

    const derived = scored.slice(0, MAX_RELATED).map(x => x.entry);
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

export function renderRelatedHtml(related, fromPath) {
  if (!related || related.length === 0) return '';
  const fromDir = fromPath.split('/').slice(0, -1).join('/');
  const items = related.map(e => {
    const href = relativePath(fromPath, e.path);
    const cn = e.char || (e.title ? e.title.split('·')[0].trim() : '');
    const py = e.pinyin || '';
    const titleEn = e.title ? e.title.split('·').slice(1).join('·').trim() || e.title : '';
    const sizeClass = cn.length >= 4 ? ' rl-multi' : '';
    return `<a class="related-link${sizeClass}" href="${escapeHtml(href)}">` +
           (cn ? `<span class="rl-cn">${escapeHtml(cn)}</span>` : '') +
           (py ? `<span class="rl-py">${escapeHtml(py)}</span>` : '') +
           `<span class="rl-en">${escapeHtml(titleEn)}</span>` +
           `</a>`;
  }).join('\n      ');

  return `
    <aside class="related" aria-labelledby="related-label">
      <span class="related-label" id="related-label">Related entries</span>
      <div class="related-list">
      ${items}
      </div>
    </aside>`;
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
