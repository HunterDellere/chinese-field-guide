/**
 * Page-body augmentations applied at build time:
 *   - injectStrokeOrder: adds a Hanzi Writer mount point on character pages
 *   - autoLinkBody: links the first occurrence of other entries' chars/titles
 *   - addPinyinAudio: wraps pinyin spans with an audio trigger
 */

const HZ_RE = /[\u4e00-\u9fff]/;


/**
 * Render a small Sources block from frontmatter. Merges fm.sources (general page
 * sources) with fm.content_sources (sources consulted for content review).
 * Returns HTML block or empty string.
 */
export function renderSourcesHtml(fm) {
  const general = Array.isArray(fm.sources) ? fm.sources : [];
  const factual = Array.isArray(fm.content_sources) ? fm.content_sources : [];
  if (general.length === 0 && factual.length === 0) return '';
  // Render as a single list; factual-specific sources get a subtle prefix.
  const seen = new Set();
  const items = [];
  for (const s of general) {
    const k = String(s).trim();
    if (seen.has(k) || !k) continue;
    seen.add(k);
    items.push(`<li>${escapeHtmlInline(k)}</li>`);
  }
  for (const s of factual) {
    const k = String(s).trim();
    if (seen.has(k) || !k) continue;
    seen.add(k);
    items.push(`<li>${escapeHtmlInline(k)}</li>`);
  }
  return `
    <aside class="sources" aria-label="Sources">
      <span class="sources-label">Sources</span>
      <ul class="sources-list">
        ${items.join('\n        ')}
      </ul>
    </aside>`;
}

function escapeHtmlInline(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Inject the full unified footer before </main>.
 * Removes any authored <footer class="page-footer">…</footer> stub first
 * (back-compat while content is being swept), then appends the canonical footer.
 */
export function buildPageFooter(body, fm, slug, category) {
  const corrTitle = encodeURIComponent(`Correction: ${category}/${slug}`);
  const corrBody = encodeURIComponent(
    `Page: pages/${category}/${slug}.html\n\n` +
    `Describe the correction (quote the exact sentence or claim):\n\n`
  );
  const corrUrl = `https://github.com/HunterDellere/jiaoluo-shuwu/issues/new?title=${corrTitle}&body=${corrBody}&labels=correction`;
  const reqTitle = encodeURIComponent('Request: ');
  const reqUrl = `https://github.com/HunterDellere/jiaoluo-shuwu/issues/new?template=content-request.yml&title=${reqTitle}`;

  const idLabel = fm.char
    ? `${fm.char} ${fm.pinyin || ''} · ${slug}`
    : (fm.title ? `${fm.title.split('·')[0].trim()} · ${slug}` : slug);

  const footer = `<footer class="page-footer">
      <div class="page-footer-actions">
        <div class="page-footer-buttons">
          <a class="pf-btn pf-btn-donate" href="https://ko-fi.com/hdellere" target="_blank" rel="noopener" aria-label="Donate — buy me a tea">Pour me a cup of <span class="pf-btn-cn-inline">茶</span></a>
          <button type="button" class="pf-btn pf-btn-share" data-share aria-label="Share this page">
            <svg class="pf-btn-icon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            <span data-share-label>Share</span>
          </button>
        </div>
        <div class="page-footer-links">
          <a href="${corrUrl}" class="pf-link" target="_blank" rel="noopener noreferrer">Corrections</a>
          <a href="${reqUrl}" class="pf-link" target="_blank" rel="noopener noreferrer">Request an entry</a>
        </div>
      </div>
      <div class="page-footer-row">
        <span class="footer-id">角落書屋 · Jiǎoluò Shūwū · <span>${idLabel}</span></span>
        <a href="../../index.html" class="footer-back">← All entries</a>
      </div>
    </footer>`;

  // Remove any authored footer stub
  body = body.replace(/[ \t]*<!--\s*FOOTER\s*-->\s*\n?/g, '');
  body = body.replace(/<footer class="page-footer">[\s\S]*?<\/footer>\s*/g, '');

  // Inject before closing </main>
  return body.replace('</main>', `\n    ${footer}\n  </main>`);
}

/**
 * Ensure <main class="main"> carries id="main-content" so the layout's
 * skip-link (<a class="skip-link" href="#main-content">) resolves. Idempotent:
 * pages that already author the id are left alone.
 */
export function ensureMainContentId(body) {
  if (/\bid="main-content"/.test(body)) return body;
  return body.replace('<main class="main">', '<main class="main" id="main-content">');
}

export function injectStrokeOrder(body, fm) {
  if (fm.type !== 'character' || !fm.char) return body;
  if (!body.includes('</header>')) {
    throw new Error(`injectStrokeOrder: character page "${fm.char}" has no </header> — the .hero block is required on character pages.`);
  }
  const block = `
    <!-- STROKE ORDER -->
    <section class="stroke-order" aria-label="Stroke order animation">
      <div class="so-head">
        <span class="so-label">笔顺 bǐshùn · Stroke order</span>
        <div class="so-controls">
          <button type="button" class="so-btn" data-so-action="play" aria-label="Play stroke animation">▶ Play</button>
          <button type="button" class="so-btn" data-so-action="step" aria-label="Step through strokes">Step</button>
          <button type="button" class="so-btn" data-so-action="quiz" aria-label="Try drawing the character">✎ Try drawing</button>
          <button type="button" class="so-btn" data-so-action="reset" aria-label="Reset">↻</button>
        </div>
      </div>
      <div class="so-stage" id="so-stage" data-char="${escapeAttr(fm.char)}"></div>
      <p class="so-hint" id="so-hint">Click the character to replay. Press <strong>Try drawing</strong> to write it yourself.</p>
    </section>`;
  return body.replace('</header>', `</header>\n${block}`);
}

/**
 * Build a lookup of strings → entry path for auto-linking.
 * Prefer Chinese strings (less ambiguous) over English titles.
 */
export function buildLinkMap(entries, currentEntry) {
  const map = [];
  for (const e of entries) {
    if (e.status !== 'complete') continue;
    if (e.path === currentEntry.path) continue;

    const phrases = new Set();

    // Character entries: link the glyph itself
    if (e.char) phrases.add(e.char);

    // Topic / vocab / chengyu / grammar: link the leading Chinese phrase from title
    // Title format: "春节 · Spring Festival" or "矛盾 · Contradiction"
    if (e.title) {
      const cn = e.title.split('·')[0].trim();
      if (cn && HZ_RE.test(cn)) phrases.add(cn);
    }

    for (const p of phrases) {
      if (p.length >= 1) map.push({ phrase: p, path: e.path });
    }
  }
  // Longest first so 春节 beats 春 when scanning
  map.sort((a, b) => b.phrase.length - a.phrase.length);
  return map;
}

const MAX_LINKS_PER_TARGET_PER_SECTION = 2;
const MAX_LINKS_PER_TARGET_GLOBAL = 6;

// Sentinel inserted while splitting into sections, stripped before returning.
const SECTION_BOUNDARY = '\x00SECTION\x00';

/**
 * Split body into per-section chunks so we can apply a per-section link budget.
 * Section boundaries are <span class="section-anchor"> or <section class="section-anchor">.
 * Returns array of strings; boundaries are represented by the SECTION_BOUNDARY sentinel.
 */
function splitIntoSections(body) {
  const sectionStart = /<(?:span|section)\s[^>]*class="section-anchor"[^>]*>/g;
  const parts = [];
  let last = 0;
  let m;
  while ((m = sectionStart.exec(body)) !== null) {
    if (m.index > last) parts.push(body.slice(last, m.index));
    parts.push(SECTION_BOUNDARY);
    parts.push(m[0]);
    last = m.index + m[0].length;
  }
  if (last < body.length) parts.push(body.slice(last));
  return parts;
}

export function autoLinkBody(body, linkMap, currentEntry) {
  if (!linkMap.length) return body;

  // Extract auto-link-skip sentinel blocks before any splitting so section
  // boundaries inside the block don't fracture the sentinel across chunks.
  const skipBlocks = [];
  body = body.replace(/<!--\s*auto-link-skip\s*-->[\s\S]*?<!--\s*\/auto-link-skip\s*-->/g, (m) => {
    const token = `\x00SKIP${skipBlocks.length}\x00`;
    skipBlocks.push(m);
    return token;
  });

  // Global usage counter: path → total links inserted across the whole page
  const globalCount = new Map();
  // Per-section usage counter: path → links inserted in the current section
  let sectionCount = new Map();

  // Walk the body section-by-section so we can reset the per-section counter
  const sectionChunks = splitIntoSections(body);
  const processedChunks = [];

  for (const chunk of sectionChunks) {
    if (chunk === SECTION_BOUNDARY) {
      // Reset per-section counts at each section boundary
      sectionCount = new Map();
      processedChunks.push(SECTION_BOUNDARY);
      continue;
    }

    // Split chunk into protected/unprotected segments and auto-link
    const segments = splitProtected(chunk);
    let result = '';
    for (const seg of segments) {
      if (seg.protected) {
        result += seg.text;
        continue;
      }
      // Build output left-to-right, advancing a cursor so already-inserted
      // link markup is never rescanned by subsequent phrase substitutions.
      let remaining = seg.text;
      let built = '';
      let anyReplaced = true;
      while (anyReplaced) {
        anyReplaced = false;
        // Find the earliest-occurring phrase in `remaining` that is within budget.
        let bestIdx = -1;
        let bestPhrase = null;
        let bestPath = null;
        for (const { phrase, path } of linkMap) {
          const secUsed = sectionCount.get(path) || 0;
          const globUsed = globalCount.get(path) || 0;
          if (secUsed >= MAX_LINKS_PER_TARGET_PER_SECTION) continue;
          if (globUsed >= MAX_LINKS_PER_TARGET_GLOBAL) continue;
          const idx = remaining.indexOf(phrase);
          if (idx === -1) continue;
          if (phrase.length === 1 && HZ_RE.test(phrase)) {
            const before = remaining[idx - 1] || '';
            const after  = remaining[idx + phrase.length] || '';
            if (HZ_RE.test(before) || HZ_RE.test(after)) continue;
          }
          if (bestIdx === -1 || idx < bestIdx) {
            bestIdx = idx;
            bestPhrase = phrase;
            bestPath = path;
          }
        }
        if (bestIdx !== -1) {
          const href = relativePath(currentEntry.path, bestPath);
          const replacement = `<a class="auto-link" href="${escapeAttr(href)}">${escapeHtml(bestPhrase)}</a>`;
          built += remaining.slice(0, bestIdx) + replacement;
          remaining = remaining.slice(bestIdx + bestPhrase.length);
          sectionCount.set(bestPath, (sectionCount.get(bestPath) || 0) + 1);
          globalCount.set(bestPath, (globalCount.get(bestPath) || 0) + 1);
          anyReplaced = true;
        }
      }
      result += built + remaining;
    }
    processedChunks.push(result);
  }

  // Re-join, stripping the section-boundary sentinels
  let result = processedChunks.join('').split(SECTION_BOUNDARY).join('');

  // Reinsert auto-link-skip blocks verbatim (also strip the sentinel comments)
  result = result.replace(/\x00SKIP(\d+)\x00/g, (_, i) => {
    const block = skipBlocks[Number(i)];
    // Strip the sentinel comment wrappers from the final output
    return block
      .replace(/^<!--\s*auto-link-skip\s*-->/, '')
      .replace(/<!--\s*\/auto-link-skip\s*-->$/, '');
  });
  return result;
}

/**
 * Wrap pinyin spans with a clickable audio trigger.
 *
 * - Character pages: button injected inside <div class="hero-pinyin">.
 * - Vocab pages: button injected after <span class="topic-hero-title-py">.
 *
 * Topic / grammar / hub / family pages skipped — their titles aren't always
 * pronounceable Chinese phrases (English topic names, particles with multiple
 * readings, etc.).
 *
 * Markup emitted:
 *   <button type="button" class="audio-btn" data-audio="感" data-pinyin="gǎn"
 *           aria-label="Play pronunciation">
 *     <svg class="audio-btn-ico" …></svg>
 *     <span class="audio-btn-voice" data-voice="xiaoxiao">女</span>
 *   </button>
 *
 * The voice indicator text is updated client-side to reflect the user's
 * cycled choice (女 / 男). Default is 女 (zh-CN-XiaoxiaoNeural).
 */
export function addPinyinAudio(body, fm) {
  if (fm.type === 'character' && fm.char) {
    return addCharacterAudio(body, fm);
  }
  if (fm.type === 'vocab') {
    return addVocabAudio(body, fm);
  }
  return body;
}

function addCharacterAudio(body, fm) {
  const before = body;
  body = body.replace(
    /<div class="hero-pinyin">([\s\S]*?)<\/div>/,
    (m, py) => `<div class="hero-pinyin">${py}${buildAudioButton(fm.char, fm.pinyin)}</div>`,
  );
  if (body === before) {
    throw new Error(`addPinyinAudio: no <div class="hero-pinyin">…</div> found for character "${fm.char}" — the audio button cannot be attached.`);
  }
  return body;
}

function addVocabAudio(body, fm) {
  // Vocab text is the CN portion of the title ("茶道 · the way of tea" → "茶道").
  const cn = fm.title ? fm.title.split('·')[0].trim() : '';
  if (!cn || !/[一-鿿]/.test(cn) || !fm.pinyin) return body;

  // Insert immediately after the closing </span> of topic-hero-title-py.
  const before = body;
  body = body.replace(
    /(<span class="topic-hero-title-py">[\s\S]*?<\/span>)/,
    (m) => `${m}${buildAudioButton(cn, fm.pinyin)}`,
  );
  // Silently no-op if the page has no topic-hero-title-py (e.g. an unusual
  // hand-authored vocab hero) — don't fail the build.
  return body === before ? body : body;
}

function buildAudioButton(text, pinyin, opts) {
  const inline = opts && opts.inline;
  const cls = inline ? 'audio-btn audio-btn--inline' : 'audio-btn';
  return (
    `<button type="button" class="${cls}" ` +
      `data-audio="${escapeAttr(text)}" ` +
      `data-pinyin="${escapeAttr(pinyin || '')}" ` +
      `aria-label="Play pronunciation (click to cycle voice)">` +
      `<svg class="audio-btn-ico" width="14" height="14" viewBox="0 0 24 24" ` +
        `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ` +
        `stroke-linejoin="round" aria-hidden="true" focusable="false">` +
        `<path d="M11 5 6 9H2v6h4l5 4V5z"/>` +
        `<path class="audio-btn-wave" d="M15.54 8.46a5 5 0 0 1 0 7.07"/>` +
        `<path class="audio-btn-wave audio-btn-wave--far" d="M19.07 4.93a10 10 0 0 1 0 14.14"/>` +
      `</svg>` +
      `<span class="audio-btn-voice" data-voice="xiaoxiao">女</span>` +
    `</button>`
  );
}

/**
 * Inject inline audio buttons next to <span class="cy-py"> (chengyu cards)
 * and <span class="card-py"> (vocab compound cards) wherever the preceding
 * sibling has a matching cn span. Each button references the same (text, pinyin)
 * pair the audio build module hashed for inline clips, so clicks resolve
 * cleanly through the manifest's `inline` section.
 *
 * Skip if a button already exists for that py span (idempotent re-run).
 */
export function injectInlineAudio(body) {
  // Chengyu pairs
  body = body.replace(
    /<span class="cy-cn">([\s\S]*?)<\/span>(\s*)<span class="cy-py">([\s\S]*?)<\/span>/g,
    (m, cnInner, ws, pyInner) => {
      const text   = stripTags(cnInner).trim();
      const pinyin = stripTags(pyInner).trim();
      if (!text || !pinyin || !/[一-鿿]/.test(text)) return m;
      // If a button already follows, skip
      return `<span class="cy-cn">${cnInner}</span>${ws}<span class="cy-py">${pyInner}</span>${buildAudioButton(text, pinyin, { inline: true })}`;
    },
  );

  // Vocab-compound card pairs
  body = body.replace(
    /<span class="card-cn">([\s\S]*?)<\/span>(\s*)<span class="card-py">([\s\S]*?)<\/span>/g,
    (m, cnInner, ws, pyInner) => {
      const text   = stripTags(cnInner).trim();
      const pinyin = stripTags(pyInner).trim();
      if (!text || !pinyin || !/[一-鿿]/.test(text)) return m;
      return `<span class="card-cn">${cnInner}</span>${ws}<span class="card-py">${pyInner}</span>${buildAudioButton(text, pinyin, { inline: true })}`;
    },
  );

  return body;
}

function stripTags(s) {
  return String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

// ── helpers ────────────────────────────────────────────────────────────────

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * Split body into segments, marking ranges that must not be modified:
 *   - inside any HTML tag
 *   - inside <a>...</a>
 *   - inside <code>, <pre>, <script>, <style>
 *   - inside ex-cn / ex-py / ex-en spans (example sentences should stay clean)
 *   - inside the hero block (already structured)
 */
function splitProtected(body) {
  const segs = [];
  const protectedTags = ['a', 'code', 'pre', 'script', 'style'];
  const re = new RegExp(
    `<!--\\s*auto-link-skip\\s*-->[\\s\\S]*?<!--\\s*\\/auto-link-skip\\s*-->|` + // skip sentinel
    `<(${protectedTags.join('|')})\\b[^>]*>[\\s\\S]*?<\\/\\1>|` + // protected element trees
    `<header class="hero">[\\s\\S]*?<\\/header>|` +                // hero
    `<header class="topic-hero">[\\s\\S]*?<\\/header>|` +
    `<section class="related"[^>]*>[\\s\\S]*?<\\/section>|` +
    `<nav class="prev-next">[\\s\\S]*?<\\/nav>|` +
    `<section class="stroke-order">[\\s\\S]*?<\\/section>|` +
    `<aside class="sidebar"[^>]*>[\\s\\S]*?<\\/aside>|` +          // sidebar TOC
    `<[^>]+>`,                                                      // any single tag
    'g'
  );
  let last = 0, m;
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) segs.push({ text: body.slice(last, m.index), protected: false });
    segs.push({ text: m[0], protected: true });
    last = m.index + m[0].length;
  }
  if (last < body.length) segs.push({ text: body.slice(last), protected: false });
  return segs;
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

/**
 * Build a chip lookup: Chinese phrase → { path, category }. Used by
 * linkifyAdjChips to upgrade adj chips matching an existing page into
 * clickable, color-coded links.
 */
export function buildChipLinkMap(entries, currentEntry) {
  const map = new Map();
  for (const e of entries) {
    if (e.status !== 'complete') continue;
    if (e.path === currentEntry.path) continue;
    const phrases = new Set();
    if (e.char) phrases.add(e.char);
    if (e.title) {
      const cn = e.title.split('·')[0].trim();
      if (cn && HZ_RE.test(cn)) phrases.add(cn);
    }
    for (const p of phrases) {
      // First entry wins: characters are added before topics in entries.json,
      // so a chip like 道 prefers the character page over a topic page.
      if (!map.has(p)) map.set(p, { path: e.path, category: e.category || '' });
    }
  }
  return map;
}

/**
 * Upgrade <span class="adj"> chips into <a class="adj"> when their .a-cn
 * text matches a built page. Adds a `data-category` attr for color signaling.
 * Preserves any existing data-* attributes (e.g. data-relation, data-distinct).
 * Idempotent: chips already wrapped in <a> are left alone.
 */
export function linkifyAdjChips(body, chipMap, fromPath) {
  if (!chipMap || chipMap.size === 0) return body;
  // Match the canonical chip shape:
  //   <span class="adj"[attrs]><span class="a-cn">PHRASE</span><span class="a-py">…</span><span class="a-en">…</span></span>
  // Tight, ordered match avoids the nested-</span> ambiguity.
  const chipRe = /<span\s+class="adj"([^>]*)>(<span class="a-cn">([^<]+)<\/span><span class="a-py">[^<]*<\/span><span class="a-en">[^<]*<\/span>)<\/span>/g;
  return body.replace(chipRe, (full, restAttrs, inner, phraseRaw) => {
    const phrase = phraseRaw.trim();
    const target = chipMap.get(phrase);
    if (!target) return full;
    const href = relativePath(fromPath, target.path);
    const cat = target.category;
    return `<a class="adj"${restAttrs} href="${href}" data-category="${cat}">${inner}</a>`;
  });
}
