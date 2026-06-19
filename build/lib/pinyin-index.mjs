/**
 * pinyin-index.mjs — group character entries by toneless base syllable
 * and render disambiguation pages at /pages/pinyin/<syllable>.html.
 *
 * Captures the long-tail "[pinyin] chinese character" search query — readers
 * who type "ai pinyin" or "gan3" land on a hub that lists every reading +
 * sample compounds, then funnels into the relevant character page.
 *
 * Toneless aggregation only this session: ai → 爱 ài / 哀 āi / 矮 ǎi /…
 * One page per distinct base syllable. Tone splits can come later if data
 * warrants it.
 */

import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pinyinToNumericSyllables } from './pinyin.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const LAYOUT = readFileSync(join(ROOT, 'templates/_layout.html'), 'utf8');

const SITE_URL = 'https://jiaoshoo.com';

const TONE_MARK_MAP = {
  'ā':'a','á':'a','ǎ':'a','à':'a',
  'ē':'e','é':'e','ě':'e','è':'e',
  'ī':'i','í':'i','ǐ':'i','ì':'i',
  'ō':'o','ó':'o','ǒ':'o','ò':'o',
  'ū':'u','ú':'u','ǔ':'u','ù':'u',
  'ǖ':'u','ǘ':'u','ǚ':'u','ǜ':'u','ü':'u',
};

/**
 * Strip tone marks from a single pinyin syllable and lowercase it.
 * "Ài" → "ai", "lüè" → "lue", "zhōng" → "zhong"
 */
export function syllableBase(syllable) {
  if (!syllable) return '';
  let out = '';
  for (const ch of String(syllable)) {
    out += TONE_MARK_MAP[ch] ?? TONE_MARK_MAP[ch.toLowerCase?.()] ?? ch;
  }
  return out.toLowerCase().replace(/[^a-z]/g, '');
}

/** Tone number from a single toned syllable. Returns 5 (neutral) if untoned. */
export function syllableTone(syllable) {
  for (const ch of String(syllable || '')) {
    if ('āēīōūǖ'.includes(ch)) return 1;
    if ('áéíóúǘ'.includes(ch)) return 2;
    if ('ǎěǐǒǔǚ'.includes(ch)) return 3;
    if ('àèìòùǜ'.includes(ch)) return 4;
  }
  return 5;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Walk entries.json and group character pages by toneless base syllable.
 * Returns Map<baseSyllable, { entries: [...], compounds: [...] }>.
 *
 * - entries: character pages whose pinyin starts with this syllable.
 * - compounds: vocab/chengyu/grammar pages whose pinyin contains this
 *   syllable as one of its tokens. Capped at 24 per syllable in render.
 */
export function buildPinyinIndex(entries) {
  const index = new Map();

  for (const e of entries) {
    if (e.status !== 'complete') continue;
    if (!e.pinyin) continue;

    if (e.type === 'character') {
      const base = syllableBase(e.pinyin);
      if (!base) continue;
      if (!index.has(base)) index.set(base, { entries: [], compounds: [] });
      index.get(base).entries.push(e);
    } else if (e.type === 'vocab' || e.type === 'grammar' || e.category === 'chengyu') {
      // Tokenize multi-syllable pinyin (handles "zìrán" with no separator,
      // "lǎo shī" with whitespace, "Zhōng-guó" with hyphen). pinyin.mjs
      // already does this; numeric syllables look like "zi4" so strip the
      // trailing tone digit to get the toneless base.
      const seen = new Set();
      for (const numSyl of pinyinToNumericSyllables(e.pinyin)) {
        const base = numSyl.replace(/[1-5]$/, '');
        if (!base || seen.has(base)) continue;
        seen.add(base);
        if (!index.has(base)) index.set(base, { entries: [], compounds: [] });
        index.get(base).compounds.push(e);
      }
    }
  }

  // Sort character entries within each syllable: by tone, then by hsk (lower first), then by pinyin
  for (const [, group] of index) {
    group.entries.sort((a, b) => {
      const ta = a.tone ?? syllableTone(a.pinyin);
      const tb = b.tone ?? syllableTone(b.pinyin);
      if (ta !== tb) return ta - tb;
      const ha = typeof a.hsk === 'number' ? a.hsk : 99;
      const hb = typeof b.hsk === 'number' ? b.hsk : 99;
      if (ha !== hb) return ha - hb;
      return String(a.pinyin).localeCompare(String(b.pinyin));
    });
    // Compounds: by tone of matching syllable is hard — stable by pinyin/title
    group.compounds.sort((a, b) =>
      String(a.pinyin || '').localeCompare(String(b.pinyin || '')) ||
      String(a.title || '').localeCompare(String(b.title || ''))
    );
  }

  return index;
}

const TONE_LABEL = {
  1: { mark: '◌̄', name: 'first tone',  pinyin: 'high level',     color: 'c-teal',   exemplar: 'mā', ord: '一', short: '1st' },
  2: { mark: '◌́', name: 'second tone', pinyin: 'rising',         color: 'c-ochre',  exemplar: 'má', ord: '二', short: '2nd' },
  3: { mark: '◌̌', name: 'third tone',  pinyin: 'low / dipping',  color: 'c-violet', exemplar: 'mǎ', ord: '三', short: '3rd' },
  4: { mark: '◌̀', name: 'fourth tone', pinyin: 'falling',        color: 'c-red',    exemplar: 'mà', ord: '四', short: '4th' },
  5: { mark: '·',  name: 'neutral tone', pinyin: 'unstressed',     color: 'c-sienna', exemplar: 'ma', ord: '·', short: 'n' },
};

/**
 * Inline SVG of a tone's pitch contour, drawn in a 36×18 box. The shape is
 * the standard pinyin pitch diagram: tone 1 flat-high, tone 2 rising, tone 3
 * dipping (low V), tone 4 falling. The path uses currentColor so it inherits
 * the tone color from CSS and adapts to dark mode.
 */
function pitchCurveSvg(tone, opts = {}) {
  const cls = opts.cls || 'pitch-curve';
  // The 5-line musical staff convention: y=2 is highest pitch, y=16 is lowest.
  const paths = {
    1: 'M 3 4 L 33 4',                         // flat high
    2: 'M 3 14 L 33 4',                        // rising
    3: 'M 3 7 Q 9 17 18 16 Q 27 14 33 4',     // dipping V
    4: 'M 3 4 L 33 16',                        // falling
    5: 'M 3 10 L 33 10',                       // neutral (flat mid)
  };
  const d = paths[tone] || paths[5];
  return `<svg class="${cls}" data-tone="${tone}" width="36" height="18" viewBox="0 0 36 18" aria-hidden="true" focusable="false"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/**
 * Highlight occurrences of a base syllable inside a pinyin string so readers
 * can see WHERE a target syllable falls in a compound. Matches are case-
 * insensitive and tolerant of tone marks. "shī cí" with target "shi" →
 * "<mark>shī</mark> cí".
 */
function highlightSyllable(pinyin, baseSyl) {
  if (!pinyin || !baseSyl) return escapeHtml(pinyin || '');
  // Tokenise on whitespace / hyphen so we can compare token-by-token without
  // splitting tone-marked vowels.
  const out = [];
  const re = /([\s\-]+)/;
  const parts = String(pinyin).split(re);
  for (const part of parts) {
    if (!part) continue;
    if (re.test(part)) { out.push(escapeHtml(part)); continue; }
    // Strip tone marks and trailing tone digits to compare.
    const stripped = syllableBase(part);
    if (stripped === baseSyl.toLowerCase()) {
      out.push(`<mark class="pinyin-syl-hit">${escapeHtml(part)}</mark>`);
    } else {
      out.push(escapeHtml(part));
    }
  }
  return out.join('');
}

function renderToneGroup(tone, items, syllableBaseStr) {
  const label = TONE_LABEL[tone] || TONE_LABEL[5];
  const cards = items.map(e => {
    const englishGloss = (() => {
      if (e.title && e.title.includes('·')) {
        const after = e.title.split('·').slice(1).join('·').trim();
        return after.split('—')[0].trim();
      }
      return '';
    })();
    const hskChip = (typeof e.hsk === 'number') ? `<span class="card-tag tag-n">HSK ${e.hsk}</span>` : '';
    const path = `../${e.path.replace(/^pages\//, '')}`;
    return `
        <a class="card ${label.color}" href="${path}">
          <div class="card-head">
            <span class="card-title" lang="zh">${escapeHtml(e.char)}</span>
            <span class="card-pinyin">${escapeHtml(e.pinyin)}</span>
            ${hskChip}
          </div>
          ${englishGloss ? `<div class="card-body">${escapeHtml(englishGloss)}</div>` : ''}
        </a>`;
  }).join('');

  // Section head shows the tone-marked exemplar (mā / má / mǎ / mà / ma)
  // mapped onto this syllable base — a quick reference for what the tone
  // sounds like, in the actual reader's syllable.
  const toneOnBase = applyToneToBase(syllableBaseStr, tone);
  const count = items.length;

  return `
    <span class="section-anchor" id="tone-${tone}"></span>
    <div class="section-head pinyin-tone-head" data-tone="${tone}">
      <span class="sh-cn">${escapeHtml(toneOnBase)}${pitchCurveSvg(tone, { cls: 'pinyin-tone-head-curve' })}</span>
      <span class="sh-py">tone ${tone} · ${escapeHtml(label.pinyin)}</span>
      <span class="sh-en">${count} reading${count === 1 ? '' : 's'}</span>
    </div>
    <div class="cards">${cards}
    </div>
`;
}

/**
 * Apply a tone mark to a toneless syllable base for display — "ai" + 4 → "ài".
 * Follows standard pinyin tone-placement rules (a → o → e → final i/u/ü).
 */
function applyToneToBase(base, tone) {
  if (tone === 5 || !tone) return base;
  const marks = {
    a: ['a','ā','á','ǎ','à'],
    e: ['e','ē','é','ě','è'],
    i: ['i','ī','í','ǐ','ì'],
    o: ['o','ō','ó','ǒ','ò'],
    u: ['u','ū','ú','ǔ','ù'],
    'ü': ['ü','ǖ','ǘ','ǚ','ǜ'],
  };
  // Placement priority for tone marks
  const order = ['a','o','e','i','u','ü'];
  for (const target of order) {
    const idx = base.lastIndexOf(target);
    if (idx >= 0) {
      const marked = marks[target] && marks[target][tone];
      if (!marked) return base;
      return base.slice(0, idx) + marked + base.slice(idx + 1);
    }
  }
  return base;
}

function renderCompoundList(compounds, syllableBaseStr) {
  if (!compounds.length) return '';
  const capped = compounds.slice(0, 24);
  const more = compounds.length > 24
    ? `<p class="pinyin-compounds-more">… and ${compounds.length - 24} more on individual entry pages.</p>`
    : '';
  const TYPE_GLYPH = { vocab: '词', grammar: '法', chengyu: '语' };
  const items = capped.map(e => {
    const path = `../${e.path.replace(/^pages\//, '')}`;
    const cn = e.title?.split('·')[0]?.trim() || e.char || '';
    const en = (e.title && e.title.includes('·'))
      ? e.title.split('·').slice(1).join('·').trim().split('—')[0].trim()
      : '';
    const typeKey = e.category === 'chengyu' ? 'chengyu' : (e.type || 'vocab');
    const glyph = TYPE_GLYPH[typeKey] || '词';
    const pyHtml = highlightSyllable(e.pinyin || '', syllableBaseStr);
    return `      <a class="pinyin-compound" href="${path}" data-type="${escapeHtml(typeKey)}">
        <span class="pc-mark" aria-hidden="true">${glyph}</span>
        <span class="pc-cn" lang="zh">${escapeHtml(cn)}</span>
        <span class="pc-py">${pyHtml}</span>
        ${en ? `<span class="pc-en">${escapeHtml(en)}</span>` : ''}
      </a>`;
  }).join('\n');

  return `
    <span class="section-anchor" id="compounds"></span>
    <div class="section-head">
      <span class="sh-cn">复合词</span>
      <span class="sh-py">fùhécí</span>
      <span class="sh-en">Words and phrases containing ${escapeHtml(syllableBaseStr)}</span>
    </div>
    <div class="pinyin-compounds">
${items}
    </div>
    ${more}
`;
}

// Pull the English gloss out of an entry's title ("字 · gloss — extra" → "gloss").
function entryGloss(e) {
  if (e.title && e.title.includes('·')) {
    const after = e.title.split('·').slice(1).join('·').trim();
    return after.split('—')[0].trim();
  }
  return '';
}

// A compact "字 (pinyin) gloss" descriptor for one entry, used in prose + meta.
function entryDescriptor(e) {
  const gloss = entryGloss(e);
  return gloss ? `${e.char} (${e.pinyin}, ${gloss})` : `${e.char} (${e.pinyin})`;
}

// SEO title that leads with the literal "<syllable> pinyin" query people type,
// then names the characters. "qu pinyin: qù, qū and 2 more characters".
function pinyinSeoTitle(syllable, group) {
  const chars = group.entries.map(e => e.char);
  const n = chars.length;
  if (n === 0) return `${syllable} pinyin — Chinese characters`;
  const shown = chars.slice(0, 3).join(' ');
  const more = n > 3 ? ` and ${n - 3} more` : '';
  return `${syllable} pinyin: ${shown}${more} — ${n} character${n === 1 ? '' : 's'}`;
}

// Unique, character-naming meta description (kills the boilerplate-duplicate
// signal across 128 pages and gives Google liftable text).
function pinyinMetaDesc(syllable, group) {
  const n = group.entries.length;
  if (n === 0) return `Chinese characters read ${syllable} in pinyin.`;
  const list = group.entries.slice(0, 4).map(entryDescriptor).join('; ');
  const tones = new Set(group.entries.map(e => e.tone ?? syllableTone(e.pinyin)));
  const toneNote = tones.size > 1
    ? `Spread across ${tones.size} tones, so the tone tells them apart.`
    : '';
  return `The ${n} Chinese character${n === 1 ? '' : 's'} read ${syllable} in pinyin: ${list}. ${toneNote}`.trim();
}

// FAQPage JSON-LD targeting the "<syllable> pinyin" / "how to write X" queries.
function pinyinFaqJsonLd(syllable, group) {
  const n = group.entries.length;
  if (n === 0) return '';
  const list = group.entries.slice(0, 6).map(entryDescriptor).join('; ');
  const tones = new Set(group.entries.map(e => e.tone ?? syllableTone(e.pinyin)));
  const qa = [
    {
      q: `What Chinese characters are pronounced ${syllable}?`,
      a: `${n} character${n === 1 ? '' : 's'} on this site ${n === 1 ? 'is' : 'are'} read ${syllable}: ${list}. The tone mark and meaning tell them apart.`,
    },
    {
      q: `How do you write ${syllable} in Chinese?`,
      a: `It depends which ${syllable} you mean. ${group.entries.slice(0, 3).map(e => `${entryGloss(e) || 'a character'} is ${e.char} (${e.pinyin})`).join(', ')}. Pick the character by the tone and the meaning you intend.`,
    },
  ];
  if (tones.size > 1) {
    qa.push({
      q: `What tone is ${syllable}?`,
      a: `${syllable} appears in ${tones.size} different tones depending on the character, which is why the tone mark matters: ${group.entries.slice(0, 4).map(e => `${e.pinyin} (${e.char})`).join(', ')}.`,
    });
  }
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: qa.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
  return `<script type="application/ld+json">${JSON.stringify(faq)}</script>`;
}

// Visible quick-answer intro paragraph for the page body. Named characters give
// the page real, unique, rankable prose instead of a thin card list.
function pinyinIntro(syllable, group) {
  const n = group.entries.length;
  if (n === 0) return '';
  const list = group.entries.slice(0, 5).map(e => {
    const gloss = entryGloss(e);
    return `<strong lang="zh">${escapeHtml(e.char)}</strong> (${escapeHtml(e.pinyin)}${gloss ? `, ${escapeHtml(gloss)}` : ''})`;
  }).join(', ');
  const tones = new Set(group.entries.map(e => e.tone ?? syllableTone(e.pinyin)));
  const toneSentence = tones.size > 1
    ? ` They split across ${tones.size} tones, so the tone is what separates them.`
    : '';
  return `<p class="pinyin-intro">If you have the sound <em>${escapeHtml(syllable)}</em> but not the character, here are the ${n} character${n === 1 ? '' : 's'} read this way: ${list}.${toneSentence}</p>`;
}

function renderBody(syllable, group, allSyllables) {
  const characters = group.entries;
  const compounds = group.compounds;

  // Group characters by tone
  const byTone = new Map();
  for (const e of characters) {
    const t = e.tone ?? syllableTone(e.pinyin);
    if (!byTone.has(t)) byTone.set(t, []);
    byTone.get(t).push(e);
  }
  const toneSections = [...byTone.keys()]
    .sort((a, b) => a - b)
    .map(t => renderToneGroup(t, byTone.get(t), syllable))
    .join('\n');

  // Sidebar: tone anchors + sibling pinyin pages (alpha-near)
  const tocItems = [...byTone.keys()].sort((a, b) => a - b).map(t => {
    const label = TONE_LABEL[t] || TONE_LABEL[5];
    return `      <li><a href="#tone-${t}"><span class="toc-cn">${label.mark}</span> ${escapeHtml(label.name)}</a></li>`;
  }).join('\n');

  // Browse-sideways: previous + next pinyin alphabetically. Two links is
  // less noisy than a strip of 8.
  const sortedSyl = [...allSyllables].sort();
  const idx = sortedSyl.indexOf(syllable);
  const prevSyl = idx > 0 ? sortedSyl[idx - 1] : null;
  const nextSyl = idx < sortedSyl.length - 1 ? sortedSyl[idx + 1] : null;

  const compoundsToc = compounds.length
    ? `      <li><a href="#compounds"><span class="toc-cn">词</span> Compounds</a></li>`
    : '';

  return `<div class="shell">

  <aside class="sidebar" id="sidebar">
    <span class="toc-topic">${escapeHtml(syllable)}</span>
    <span class="toc-topic-en">pinyin index</span>
    <div class="toc-divider"></div>
    <span class="toc-label">Readings</span>
    <ul class="toc-list">
${tocItems}
${compoundsToc}
    </ul>
    <div class="toc-divider"></div>
    <span class="toc-label">Browse pinyin</span>
    <ul class="toc-list">
      <li><a href="index.html"><span class="toc-cn">拼音</span> All syllables</a></li>
    </ul>
  </aside>

  <main class="main" id="main-content">

    <header class="topic-hero pinyin-hero">
      <span class="topic-hero-eyebrow">Pinyin · 拼音 pīnyīn</span>
      <h1 class="topic-hero-title pinyin-hero-title" lang="en">${escapeHtml(syllable)}</h1>
      <p class="topic-hero-desc pinyin-hero-desc">Every character on Jiǎoluò Shūwū read as <em>${escapeHtml(syllable)}</em> in any tone — <strong>${characters.length}</strong> reading${characters.length === 1 ? '' : 's'} total across the four tones. Pick the tone you mean.</p>
      <div class="pinyin-tone-deck" role="list">
        ${[1,2,3,4].map(t => {
          const tlabel = TONE_LABEL[t];
          const count = byTone.has(t) ? byTone.get(t).length : 0;
          const present = count > 0;
          const marked = applyToneToBase(syllable, t);
          const tag = present ? 'a' : 'div';
          const href = present ? ` href="#tone-${t}"` : '';
          const stateAttr = present ? '' : ' data-empty="1"';
          return `<${tag} class="pinyin-tone-card" data-tone="${t}"${stateAttr}${href} role="listitem">
          <span class="ptc-ord">${escapeHtml(tlabel.ord)}</span>
          <span class="ptc-syl">${escapeHtml(marked)}</span>
          ${pitchCurveSvg(t, { cls: 'ptc-curve' })}
          <span class="ptc-meta">
            <span class="ptc-name">${escapeHtml(tlabel.short)} · ${escapeHtml(tlabel.pinyin)}</span>
            <span class="ptc-count">${present ? `${count} reading${count === 1 ? '' : 's'}` : 'no entries yet'}</span>
          </span>
        </${tag}>`;
        }).join('')}
      </div>
    </header>${characters.length === 0 ? '<!--EMPTY-->' : ''}

    ${pinyinIntro(syllable, group)}

    ${toneSections}

    ${renderCompoundList(compounds, syllable)}

    ${(prevSyl || nextSyl) ? `
    <nav class="prev-next pinyin-prev-next" aria-label="Adjacent pinyin syllables">
      ${prevSyl
        ? `<a class="pn-link pn-prev" href="${prevSyl}.html" rel="prev"><span class="pn-arrow">←</span><span class="pn-meta"><span class="pn-label">Previous syllable</span><span class="pn-title"><span class="pn-cn" lang="zh">${escapeHtml(prevSyl)}</span></span></span></a>`
        : `<span class="pn-empty"></span>`}
      ${nextSyl
        ? `<a class="pn-link pn-next" href="${nextSyl}.html" rel="next"><span class="pn-arrow">→</span><span class="pn-meta"><span class="pn-label">Next syllable</span><span class="pn-title"><span class="pn-cn" lang="zh">${escapeHtml(nextSyl)}</span></span></span></a>`
        : `<span class="pn-empty"></span>`}
    </nav>
    ` : ''}

    <footer class="page-footer">
      <span class="footer-id">Jiǎoluò Shūwū · 角落書屋 · <span>pinyin / ${escapeHtml(syllable)}</span></span>
      <a href="../../index.html" class="footer-back">← All Entries</a>
    </footer>

  </main>

</div>
`;
}

function renderJsonLd(syllable, group) {
  const url = `${SITE_URL}/pages/pinyin/${syllable}.html`;
  const collection = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${syllable} — pinyin reading index`,
    description: `Every Chinese character read as ${syllable} in any tone, with compounds and phrases.`,
    url,
    inLanguage: 'en',
    isPartOf: { '@type': 'WebSite', name: 'Jiǎoluò Shūwū · 角落書屋', url: SITE_URL + '/' },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: group.entries.map((e, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE_URL}/${e.path}`,
        name: `${e.char} ${e.pinyin}`,
      })),
    },
  };
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Jiǎoluò Shūwū', item: SITE_URL + '/' },
      { '@type': 'ListItem', position: 2, name: 'Pinyin index', item: SITE_URL + '/pages/pinyin/index.html' },
      { '@type': 'ListItem', position: 3, name: syllable, item: url },
    ],
  };
  return [
    `<script type="application/ld+json">${JSON.stringify(collection)}</script>`,
    `<script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>`,
  ].join('\n');
}

function renderOgTags(syllable, group) {
  const url = `${SITE_URL}/pages/pinyin/${syllable}.html`;
  const title = pinyinSeoTitle(syllable, group);
  const desc = pinyinMetaDesc(syllable, group);
  return [
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(desc)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:site_name" content="Jiǎoluò Shūwū · 角落書屋">`,
    `<meta property="og:locale" content="en_US">`,
    `<meta name="twitter:card" content="summary">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(desc)}">`,
  ].join('\n');
}

const FAVICON = "data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%20100%20100'%3E%3Crect%20width%3D'100'%20height%3D'100'%20rx%3D'18'%20fill%3D'%23f2e8d5'%2F%3E%3Ctext%20x%3D'50'%20y%3D'50'%20text-anchor%3D'middle'%20dominant-baseline%3D'central'%20font-family%3D'Noto%20Serif%20SC%2C%20serif'%20font-size%3D'72'%20font-weight%3D'700'%20fill%3D'%238b1a1a'%3E%E6%8B%BC%3C%2Ftext%3E%3C%2Fsvg%3E";

function renderPage(syllable, group, allSyllables) {
  const meta = { type: 'topic', category: 'pinyin', syllable, status: 'complete' };
  const metaComment = JSON.stringify(meta);
  const title = pinyinSeoTitle(syllable, group);
  const desc = pinyinMetaDesc(syllable, group);
  const canonicalUrl = `${SITE_URL}/pages/pinyin/${syllable}.html`;
  const faqJsonLd = pinyinFaqJsonLd(syllable, group);

  return LAYOUT
    .replace('{{{metaComment}}}', metaComment)
    .replace('{{{pageTitle}}}', title)
    .replace('{{{metaDesc}}}', desc)
    .replace('{{{jsonLd}}}', [renderJsonLd(syllable, group), faqJsonLd].filter(Boolean).join('\n'))
    .replace('{{{ogTags}}}', renderOgTags(syllable, group))
    .replace('{{{favicon}}}', FAVICON)
    .replace('{{{robotsMeta}}}', '')
    .replace('{{{prevNextLinks}}}', '')
    .replace('{{{canonicalUrl}}}', canonicalUrl)
    .replace('{{{pageBody}}}', renderBody(syllable, group, allSyllables));
}

function renderIndexBody(index) {
  const all = [...index.keys()].sort();
  // Group by initial letter
  const byLetter = new Map();
  for (const s of all) {
    const init = s[0] || '?';
    if (!byLetter.has(init)) byLetter.set(init, []);
    byLetter.get(init).push(s);
  }

  // Aggregate stats for the hero band
  let totalReadings = 0;
  const toneTotals = { 1: 0, 2: 0, 3: 0, 4: 0 };
  let polyphoneSyllables = 0; // syllables with 2+ tones present
  for (const [, group] of index) {
    totalReadings += group.entries.length;
    const tonesHere = new Set();
    for (const e of group.entries) {
      const t = e.tone || syllableTone(e.pinyin);
      if (t >= 1 && t <= 4) toneTotals[t] += 1;
      tonesHere.add(t);
    }
    if (tonesHere.size > 1) polyphoneSyllables += 1;
  }

  const sections = [...byLetter.keys()].sort().map(letter => {
    const items = byLetter.get(letter).map(s => {
      const group = index.get(s);
      const count = group.entries.length;
      // Tone availability: which tones have a reading for this syllable.
      const tones = new Set(group.entries.map(e => e.tone || syllableTone(e.pinyin)));
      // Build a row of 4 mini toned variants. Present ones are crisp; absent
      // ones are faded — readers see at a glance which tones exist.
      const toneRow = [1,2,3,4].map(t => {
        const marked = applyToneToBase(s, t);
        const cls = tones.has(t) ? 'pl-tone-syl is-on' : 'pl-tone-syl';
        return `<span class="${cls}" data-tone="${t}">${escapeHtml(marked)}</span>`;
      }).join('');
      const countHtml = count > 1
        ? `<span class="pl-count" title="${count} character readings">${count}</span>`
        : '';
      return `      <li><a class="pinyin-letter-item" href="${s}.html"><span class="pl-syl" lang="en">${escapeHtml(s)}</span>${countHtml}<span class="pl-tone-row">${toneRow}</span></a></li>`;
    }).join('\n');
    return `
    <span class="section-anchor" id="letter-${letter}"></span>
    <div class="section-head pinyin-letter-head">
      <span class="sh-cn">${letter.toUpperCase()}</span>
      <span class="sh-py">— ${byLetter.get(letter).length} syllable${byLetter.get(letter).length === 1 ? '' : 's'}</span>
    </div>
    <ul class="pinyin-letter-grid">
${items}
    </ul>
`;
  }).join('\n');

  const letterToc = [...byLetter.keys()].sort()
    .map(l => `      <li><a href="#letter-${l}"><span class="toc-cn">${l.toUpperCase()}</span></a></li>`).join('\n');

  // Hero stats — quick at-a-glance facts about the corpus
  const toneStat = (t) => {
    const tlabel = TONE_LABEL[t];
    return `<div class="pix-stat" data-tone="${t}">
        <span class="pix-stat-num">${toneTotals[t]}</span>
        ${pitchCurveSvg(t, { cls: 'pix-stat-curve' })}
        <span class="pix-stat-label">${escapeHtml(tlabel.short)} · ${escapeHtml(tlabel.pinyin)}</span>
      </div>`;
  };

  return `<div class="shell">

  <aside class="sidebar" id="sidebar">
    <span class="toc-topic">拼音</span>
    <span class="toc-topic-en">Pinyin index</span>
    <div class="toc-divider"></div>
    <span class="toc-label">By letter</span>
    <ul class="toc-list">
${letterToc}
    </ul>
  </aside>

  <main class="main" id="main-content">

    <header class="topic-hero pinyin-index-hero">
      <span class="topic-hero-eyebrow">Pinyin · 拼音 pīnyīn</span>
      <h1 class="topic-hero-title">Pinyin index</h1>
      <span class="topic-hero-title-py">${all.length} syllables · ${totalReadings} readings</span>
      <p class="topic-hero-desc">Every distinct pinyin reading on Jiǎoluò Shūwū. Click a syllable to see all characters that share it across the four tones — useful when you have the sound but not the character.</p>
      <div class="pinyin-index-stats" role="list">
        ${[1,2,3,4].map(toneStat).join('\n        ')}
        <div class="pix-stat pix-stat-poly">
          <span class="pix-stat-num">${polyphoneSyllables}</span>
          <span class="pix-stat-mark" aria-hidden="true">多</span>
          <span class="pix-stat-label">polyphone syllables</span>
        </div>
      </div>
    </header>

${sections}

    <footer class="page-footer">
      <span class="footer-id">Jiǎoluò Shūwū · 角落書屋 · <span>pinyin index</span></span>
      <a href="../../index.html" class="footer-back">← All Entries</a>
    </footer>

  </main>

</div>
`;
}

function renderIndexPage(index) {
  const all = [...index.keys()].sort();
  const meta = { type: 'topic', category: 'pinyin', status: 'complete' };
  const metaComment = JSON.stringify(meta);
  const title = `Pinyin index — ${all.length} syllables`;
  const desc = `Browse Chinese characters by pinyin reading. ${all.length} distinct syllables, every reading on Jiǎoluò Shūwū.`;
  const canonicalUrl = `${SITE_URL}/pages/pinyin/index.html`;

  const jsonLd = `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description: desc,
    url: canonicalUrl,
    inLanguage: 'en',
    isPartOf: { '@type': 'WebSite', name: 'Jiǎoluò Shūwū · 角落書屋', url: SITE_URL + '/' },
  })}</script>`;

  const ogTags = [
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(desc)}">`,
    `<meta property="og:url" content="${canonicalUrl}">`,
    `<meta property="og:site_name" content="Jiǎoluò Shūwū · 角落書屋">`,
    `<meta property="og:locale" content="en_US">`,
    `<meta name="twitter:card" content="summary">`,
  ].join('\n');

  return LAYOUT
    .replace('{{{metaComment}}}', metaComment)
    .replace('{{{pageTitle}}}', title)
    .replace('{{{metaDesc}}}', desc)
    .replace('{{{jsonLd}}}', jsonLd)
    .replace('{{{ogTags}}}', ogTags)
    .replace('{{{favicon}}}', FAVICON)
    .replace('{{{robotsMeta}}}', '')
    .replace('{{{prevNextLinks}}}', '')
    .replace('{{{canonicalUrl}}}', canonicalUrl)
    .replace('{{{pageBody}}}', renderIndexBody(index));
}

/**
 * Generate all pinyin pages: pages/pinyin/<syllable>.html + pages/pinyin/index.html.
 * Returns an array of generated paths (relative to ROOT) for sitemap inclusion.
 */
export function emitPinyinPages(entries, pagesDir) {
  const index = buildPinyinIndex(entries);
  const pinyinDir = join(pagesDir, 'pinyin');
  mkdirSync(pinyinDir, { recursive: true });

  // Only emit syllables with at least one character entry — compounds-only
  // syllables would have no readings to display, and linking to them from
  // sibling lists would break.
  const emittedSyllables = [...index.keys()].filter(s => index.get(s).entries.length > 0);
  const generated = [];

  for (const syllable of emittedSyllables) {
    const group = index.get(syllable);
    const html = renderPage(syllable, group, emittedSyllables);
    writeFileSync(join(pinyinDir, `${syllable}.html`), html, 'utf8');
    generated.push(`pages/pinyin/${syllable}.html`);
  }

  // Index page lists only emitted syllables, for the same reason
  const emittedIndex = new Map();
  for (const s of emittedSyllables) emittedIndex.set(s, index.get(s));
  writeFileSync(join(pinyinDir, 'index.html'), renderIndexPage(emittedIndex), 'utf8');
  generated.push('pages/pinyin/index.html');

  return { generated, index };
}
