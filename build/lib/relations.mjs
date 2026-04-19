/**
 * Compute related entries by Jaccard similarity over tags + category.
 * Returns Map<entryPath, RelatedEntry[]> with up to MAX_RELATED per entry.
 */

const MAX_RELATED = 5;
const MIN_SCORE = 0.15;

function score(a, b) {
  const tagsA = new Set(a.tags || []);
  const tagsB = new Set(b.tags || []);
  if (tagsA.size === 0 && tagsB.size === 0) return 0;

  let intersect = 0;
  for (const t of tagsA) if (tagsB.has(t)) intersect++;
  const union = tagsA.size + tagsB.size - intersect;
  let s = union === 0 ? 0 : intersect / union;

  // Same-category nudge so long-tail tags don't drown out topical neighbours
  if (a.category === b.category) s += 0.08;
  return s;
}

export function buildRelations(entries) {
  const complete = entries.filter(e => e.status === 'complete');
  const relations = new Map();

  for (const a of complete) {
    const scored = [];
    for (const b of complete) {
      if (a.path === b.path) continue;
      const s = score(a, b);
      if (s >= MIN_SCORE) scored.push({ entry: b, s });
    }
    scored.sort((x, y) => y.s - x.s || x.entry.title.localeCompare(y.entry.title));
    relations.set(a.path, scored.slice(0, MAX_RELATED).map(x => x.entry));
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
    const cn = e.char || (e.title ? e.title.split('·')[0].trim().split(' ')[0] : '');
    const py = e.pinyin || '';
    const titleEn = e.title ? e.title.split('·').slice(1).join('·').trim() || e.title : '';
    return `<a class="related-link" href="${escapeHtml(href)}">` +
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
    const cn = e.char || (e.title ? e.title.split('·')[0].trim().split(' ')[0] : '');
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
