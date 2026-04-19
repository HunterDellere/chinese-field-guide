/**
 * Page-body augmentations applied at build time:
 *   - injectStrokeOrder: adds a Hanzi Writer mount point on character pages
 *   - autoLinkBody: links the first occurrence of other entries' chars/titles
 *   - addPinyinAudio: wraps pinyin spans with an audio trigger
 */

const HZ_RE = /[\u4e00-\u9fff]/;

/**
 * Add an errata mailto link to the page footer.
 * Footer pattern across content pages:
 *   <span class="footer-id">...</span>
 *   <a href="../../index.html" class="footer-back">← All Entries</a>
 */
export function addErrataLink(body, fm, slug) {
  if (!body.includes('class="footer-back"')) return body;
  const subject = encodeURIComponent(`Field Notes correction: ${slug}`);
  const errata = `<a class="footer-errata" href="mailto:hunter@bootle.io?subject=${subject}" rel="noopener">Suggest a correction</a>`;
  return body.replace(
    /<a([^>]*?)class="footer-back"/,
    `${errata}\n      <a$1class="footer-back"`
  );
}

export function injectStrokeOrder(body, fm) {
  if (fm.type !== 'character' || !fm.char) return body;
  if (!body.includes('</header>')) return body;
  const block = `
    <!-- STROKE ORDER -->
    <section class="stroke-order" aria-label="Stroke order animation">
      <div class="so-head">
        <span class="so-label">笔顺 bǐshùn · Stroke order</span>
        <div class="so-controls">
          <button type="button" class="so-btn" data-so-action="play" aria-label="Play stroke animation">▶ Play</button>
          <button type="button" class="so-btn" data-so-action="step" aria-label="Step through strokes">Step</button>
          <button type="button" class="so-btn" data-so-action="reset" aria-label="Reset and replay">↻</button>
        </div>
      </div>
      <div class="so-stage" id="so-stage" data-char="${escapeAttr(fm.char)}"></div>
      <p class="so-hint">Click the character to replay. Drag to draw it yourself in quiz mode.</p>
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

export function autoLinkBody(body, linkMap, currentEntry) {
  if (!linkMap.length) return body;
  const used = new Set(); // one auto-link per target per page

  // Split body into segments, never modifying within tags or already-linked spans
  const segments = splitProtected(body);
  let result = '';
  for (const seg of segments) {
    if (seg.protected) {
      result += seg.text;
      continue;
    }
    let text = seg.text;
    for (const { phrase, path } of linkMap) {
      if (used.has(path)) continue;
      const idx = text.indexOf(phrase);
      if (idx === -1) continue;
      // Skip if phrase sits inside a longer Chinese run that probably means
      // something else (avoid linking 心 inside 关心 etc.). For Chinese phrases
      // we require the phrase to NOT be flanked by other CJK characters,
      // unless the phrase length is >= 2 (multi-char terms are safe).
      if (phrase.length === 1 && HZ_RE.test(phrase)) {
        const before = text[idx - 1] || '';
        const after  = text[idx + phrase.length] || '';
        if (HZ_RE.test(before) || HZ_RE.test(after)) continue;
      }
      const href = relativePath(currentEntry.path, path);
      const replacement = `<a class="auto-link" href="${escapeAttr(href)}">${escapeHtml(phrase)}</a>`;
      text = text.slice(0, idx) + replacement + text.slice(idx + phrase.length);
      used.add(path);
    }
    result += text;
  }
  return result;
}

/**
 * Wrap pinyin spans with a clickable audio trigger.
 * Targets .hero-pinyin and .topic-hero-title-py only — high-signal placements.
 * In-prose pinyin is left alone to avoid clutter.
 */
export function addPinyinAudio(body, fm) {
  // Hero pinyin (character pages): <div class="hero-pinyin">gǎn</div>
  body = body.replace(
    /<div class="hero-pinyin">([^<]+)<\/div>/,
    (m, py) => {
      const char = fm.char || '';
      return `<div class="hero-pinyin">${py}` +
             `<button type="button" class="audio-btn" data-audio="${escapeAttr(char || py)}" aria-label="Play pronunciation">🔊</button>` +
             `</div>`;
    }
  );

  // Topic hero pinyin: <span class="topic-hero-title-py">Chūnjié</span>
  body = body.replace(
    /<span class="topic-hero-title-py">([^<]+)<\/span>/,
    (m, py) => {
      // Use the leading Chinese phrase from title as audio source if available
      let audioSource = py;
      if (fm.title) {
        const cn = fm.title.split('·')[0].trim();
        if (cn && HZ_RE.test(cn)) audioSource = cn;
      }
      return `<span class="topic-hero-title-py">${py}` +
             `<button type="button" class="audio-btn" data-audio="${escapeAttr(audioSource)}" aria-label="Play pronunciation">🔊</button>` +
             `</span>`;
    }
  );

  return body;
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
    `<(${protectedTags.join('|')})\\b[^>]*>[\\s\\S]*?<\\/\\1>|` + // protected element trees
    `<header class="hero">[\\s\\S]*?<\\/header>|` +                // hero
    `<header class="topic-hero">[\\s\\S]*?<\\/header>|` +
    `<aside class="related">[\\s\\S]*?<\\/aside>|` +
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
