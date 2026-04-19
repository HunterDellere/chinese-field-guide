/**
 * Page-body augmentations applied at build time:
 *   - injectStrokeOrder: adds a Hanzi Writer mount point on character pages
 *   - autoLinkBody: links the first occurrence of other entries' chars/titles
 *   - addPinyinAudio: wraps pinyin spans with an audio trigger
 */

const HZ_RE = /[\u4e00-\u9fff]/;

/**
 * Strip inline onclick handlers from .toc-toggle buttons.
 * Reason: the JS handler in toc-scroll.js also toggles 'open' — running both
 * cancels the toggle on every click. Drop the inline handler at build time
 * and let JS own the behaviour.
 *
 * Also remove a duplicate .toc-toggle that some character pages embedded
 * INSIDE the sidebar (it's hidden on mobile until the sidebar opens, which
 * defeats its purpose).
 */
export function fixTocToggles(body) {
  // Remove any onclick="..." attribute on .toc-toggle buttons
  body = body.replace(
    /<button([^>]*?)class="toc-toggle"([^>]*?)\s*onclick="[^"]*"([^>]*?)>/g,
    '<button$1class="toc-toggle"$2$3>'
  );
  // Also handle when onclick comes BEFORE class
  body = body.replace(
    /<button([^>]*?)\s*onclick="[^"]*"([^>]*?)class="toc-toggle"([^>]*?)>/g,
    '<button$1$2class="toc-toggle"$3>'
  );
  // Remove a second .toc-toggle that lives inside the sidebar
  body = body.replace(
    /(<aside[^>]*class="sidebar"[^>]*>[\s\S]*?)<button[^>]*class="toc-toggle"[^>]*>[\s\S]*?<\/button>\s*/,
    '$1'
  );
  return body;
}

/**
 * Render a small Sources block from frontmatter.sources (array of strings).
 * Returns HTML block or empty string.
 */
export function renderSourcesHtml(fm) {
  if (!fm.sources || !Array.isArray(fm.sources) || fm.sources.length === 0) return '';
  const items = fm.sources.map(s => `<li>${escapeHtmlInline(s)}</li>`).join('\n        ');
  return `
    <aside class="sources" aria-label="Sources">
      <span class="sources-label">Sources</span>
      <ul class="sources-list">
        ${items}
      </ul>
    </aside>`;
}
function escapeHtmlInline(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Rewrite the minimal page-footer (footer-id + footer-back) into the full
 * unified footer: label+link meta grid (corrections, request, Ko-fi, share)
 * plus an id/back row. Replaces the old addErrataLink + addContentRequestLink
 * approach that bolted pill buttons on before footer-back.
 */
export function buildPageFooter(body, fm, slug, category) {
  if (!body.includes('class="page-footer"')) return body;

  const corrTitle = encodeURIComponent(`Correction: ${category}/${slug}`);
  const corrBody = encodeURIComponent(
    `Page: pages/${category}/${slug}.html\n\n` +
    `Describe the correction (quote the exact sentence or claim):\n\n`
  );
  const corrUrl = `https://github.com/HunterDellere/chinese-field-guide/issues/new?title=${corrTitle}&body=${corrBody}&labels=correction`;
  const reqTitle = encodeURIComponent('Request: ');
  const reqUrl = `https://github.com/HunterDellere/chinese-field-guide/issues/new?template=content-request.yml&title=${reqTitle}`;

  const idLabel = fm.char
    ? `${fm.char} ${fm.pinyin || ''} · ${slug}`
    : (fm.title ? `${fm.title.split('·')[0].trim()} · ${slug}` : slug);

  const newFooter = `<footer class="page-footer">
      <div class="page-footer-meta">
        <div>
          <div class="label">Corrections</div>
          <a href="${corrUrl}" target="_blank" rel="noopener noreferrer">Open an issue</a>
        </div>
        <div>
          <div class="label">Request an entry</div>
          <a href="${reqUrl}" target="_blank" rel="noopener noreferrer">Suggest a topic</a>
        </div>
        <div>
          <div class="label">Support</div>
          <a href="https://ko-fi.com/hdellere" target="_blank" rel="noopener">Buy me a coffee on Ko-fi</a>
        </div>
        <div>
          <div class="label">Share</div>
          <button type="button" class="page-footer-share" data-share>Copy link</button>
        </div>
      </div>
      <div class="page-footer-row">
        <span class="footer-id">書屋 · Shūwū · <span>${idLabel}</span></span>
        <a href="../../index.html" class="footer-back">← All Entries</a>
      </div>
    </footer>`;

  return body.replace(/<footer class="page-footer">[\s\S]*?<\/footer>/, newFooter);
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
 *
 * Character pages only — single-character entries with a single, unambiguous
 * pronunciation. Topic / vocab / grammar / chengyu pages are skipped because
 * many have multi-character titles or list multiple readings (会能可以,
 * 来去, 的得地, etc.) which TTS handles poorly: the engine speaks only the
 * first word, giving a misleading impression of the page.
 */
export function addPinyinAudio(body, fm) {
  if (fm.type !== 'character' || !fm.char) return body;
  // Hero pinyin (character pages): <div class="hero-pinyin">gǎn</div>
  body = body.replace(
    /<div class="hero-pinyin">([^<]+)<\/div>/,
    (m, py) => {
      return `<div class="hero-pinyin">${py}` +
             `<button type="button" class="audio-btn" data-audio="${escapeAttr(fm.char)}" aria-label="Play pronunciation">🔊</button>` +
             `</div>`;
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
