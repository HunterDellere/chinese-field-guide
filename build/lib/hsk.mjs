/**
 * HSK list renderer.
 *
 * Parses the raw reference markdown in content/hsk/_source/hsk-*.md into
 * structured HTML blocks — Characters, Vocabulary, Grammar — that can be
 * injected into an HSK level page body. Cross-references data/entries.json
 * so each row is linked when a full entry exists for that character/word.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const CHAR_LINE = /^\s*-\s*(.+?)\s*$/;

function parseSection(src, heading) {
  const lines = src.split('\n');
  let i = 0;
  while (i < lines.length && !lines[i].trim().startsWith(`## ${heading}`)) i++;
  if (i >= lines.length) return [];
  i++;
  const rows = [];
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith('## ')) break;
    if (line.trim().startsWith('---')) { i++; continue; }
    const m = line.match(CHAR_LINE);
    if (m) rows.push(m[1]);
    i++;
  }
  return rows;
}

function splitSimpTrad(token) {
  // "爱 / 愛" → { simp: "爱", trad: "愛" }
  const parts = token.split('/').map(s => s.trim());
  return { simp: parts[0], trad: parts[1] || null };
}

function parseCharRow(raw) {
  return splitSimpTrad(raw);
}

function parseVocabRow(raw) {
  // Format: "simplified [/ trad] — pinyin — POS — English gloss"
  // Some rows have multiple em-dashes inside the gloss, so split on the first three occurrences.
  const parts = raw.split('—').map(s => s.trim());
  const head = parts[0] || '';
  const pinyin = parts[1] || '';
  const pos = parts[2] || '';
  const gloss = parts.slice(3).join(' — ').trim();
  const hz = splitSimpTrad(head);
  return { ...hz, pinyin, pos, gloss };
}

function parseGrammarRow(raw) {
  // Grammar entries are a free-form string; trim and keep as-is.
  return { text: raw.trim() };
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildCharLookup(entries) {
  // char → entry path (character entries only)
  const map = new Map();
  for (const e of entries) {
    if (e.status !== 'complete') continue;
    if (e.type === 'character' && e.char) map.set(e.char, e);
  }
  return map;
}

function buildWordLookup(entries) {
  // Chinese word (extracted from title) → entry path (vocab/chengyu)
  const map = new Map();
  for (const e of entries) {
    if (e.status !== 'complete') continue;
    if (e.type !== 'vocab' && e.category !== 'chengyu') continue;
    if (!e.title) continue;
    const head = e.title.split('·')[0].trim();
    const hz = head.match(/^[\u4e00-\u9fff]+/);
    if (hz) map.set(hz[0], e);
  }
  return map;
}

function charLink(ch, lookup, basePath = '../../') {
  if (!ch) return '';
  const entry = lookup.get(ch);
  if (!entry) return `<span class="hsk-ch">${escapeHtml(ch)}</span>`;
  return `<a class="hsk-ch hsk-ch-linked" href="${basePath}${entry.path}">${escapeHtml(ch)}</a>`;
}

function wordLink(word, lookup, basePath = '../../') {
  if (!word) return '';
  const entry = lookup.get(word);
  if (!entry) return `<span class="hsk-wd">${escapeHtml(word)}</span>`;
  return `<a class="hsk-wd hsk-wd-linked" href="${basePath}${entry.path}">${escapeHtml(word)}</a>`;
}

/**
 * Render the body HTML for one HSK level page.
 *
 * @param {string} level   e.g. '1', '2', ..., '7-9'
 * @param {Array}  entries all complete entries (used to cross-link)
 * @param {string} rootDir project root
 */
export function renderHskBody(level, entries, rootDir) {
  const srcPath = join(rootDir, 'content', 'hsk', '_source', `hsk-${level}.md`);
  if (!existsSync(srcPath)) {
    return `<p>Source list not found for HSK ${level}.</p>`;
  }
  const src = readFileSync(srcPath, 'utf8');

  const charRowsRaw = parseSection(src, 'Characters');
  const vocabRowsRaw = parseSection(src, 'Vocabulary');
  const grammarRowsRaw = parseSection(src, 'Grammar');

  const chars = charRowsRaw.map(parseCharRow);
  const vocab = vocabRowsRaw.map(parseVocabRow);
  const grammar = grammarRowsRaw.map(parseGrammarRow);

  const charLookup = buildCharLookup(entries);
  const wordLookup = buildWordLookup(entries);

  let linkedChars = 0;
  for (const c of chars) if (charLookup.has(c.simp)) linkedChars++;
  let linkedVocab = 0;
  for (const v of vocab) if (wordLookup.has(v.simp) || charLookup.has(v.simp)) linkedVocab++;

  const levelLabel = level === '7-9' ? '7–9' : level;
  const titleCn = level === '7-9' ? '高级 · HSK 7-9' : `第${['', '一','二','三','四','五','六'][Number(level)]||level}级 · HSK ${level}`;

  const charHtml = chars.map(c => {
    const simp = charLink(c.simp, charLookup);
    const trad = c.trad ? ` <span class="hsk-trad">/ ${escapeHtml(c.trad)}</span>` : '';
    return `<li class="hsk-char-item">${simp}${trad}</li>`;
  }).join('\n        ');

  const vocabHtml = vocab.map(v => {
    const link = wordLookup.get(v.simp) ? wordLink(v.simp, wordLookup) : charLink(v.simp, charLookup);
    const trad = v.trad ? ` <span class="hsk-trad">/ ${escapeHtml(v.trad)}</span>` : '';
    const metaParts = [
      v.pinyin ? `<span class="hsk-vocab-py">${escapeHtml(v.pinyin)}</span>` : '',
      v.pos ? `<span class="hsk-vocab-pos">${escapeHtml(v.pos)}</span>` : '',
    ].filter(Boolean).join('');
    return `<li class="hsk-vocab-item">
          <span class="hsk-vocab-hz">${link}${trad}</span>
          ${metaParts ? `<span class="hsk-vocab-meta">${metaParts}</span>` : ''}
          ${v.gloss ? `<span class="hsk-vocab-gloss">${escapeHtml(v.gloss)}</span>` : ''}
        </li>`;
  }).join('\n        ');

  const grammarHtml = grammar.map(g => `<li class="hsk-grammar-item">${escapeHtml(g.text)}</li>`).join('\n        ');

  return `
<div class="shell">

  <aside class="sidebar" id="sidebar">
    <span class="toc-topic">HSK ${escapeHtml(levelLabel)}</span>
    <span class="toc-topic-en">Level list</span>
    <div class="toc-divider"></div>
    <span class="toc-label">On this page</span>
    <ul class="toc-list">
      <li><a href="#characters"><span class="toc-cn">汉字</span> Characters<span class="toc-sub">${chars.length} hànzì</span></a></li>
      <li><a href="#vocabulary"><span class="toc-cn">词汇</span> Vocabulary<span class="toc-sub">${vocab.length} cíhuì</span></a></li>
      <li><a href="#grammar"><span class="toc-cn">语法</span> Grammar<span class="toc-sub">${grammar.length} yǔfǎ</span></a></li>
    </ul>
  </aside>

  <main class="main" id="main-content">
    <header class="topic-hero">
      <span class="topic-hero-eyebrow">HSK · 汉语水平考试 Hànyǔ Shuǐpíng Kǎoshì</span>
      <h1 class="topic-hero-title">${escapeHtml(titleCn)}</h1>
      <span class="topic-hero-title-py">HSK ${escapeHtml(levelLabel)}</span>
      <p class="topic-hero-desc">The full vocabulary, character, and grammar list for HSK ${escapeHtml(levelLabel)}, sourced from the 2021 国际中文教育中文水平等级标准. Entries linked to a full Jiǎoluò Shūwū page when one exists.</p>
      <div class="hsk-stats">
        <span class="hsk-stat"><strong>${chars.length}</strong> characters${linkedChars ? ` · <em>${linkedChars} linked</em>` : ''}</span>
        <span class="hsk-stat"><strong>${vocab.length}</strong> words${linkedVocab ? ` · <em>${linkedVocab} linked</em>` : ''}</span>
        <span class="hsk-stat"><strong>${grammar.length}</strong> grammar points</span>
      </div>
    </header>

    <span class="section-anchor" id="characters"></span>
    <div class="section-head"><h2>Characters · 汉字</h2></div>
    <ul class="hsk-char-grid">
      ${charHtml}
    </ul>

    <span class="section-anchor" id="vocabulary"></span>
    <div class="section-head"><h2>Vocabulary · 词汇</h2></div>
    <ul class="hsk-vocab-list">
      ${vocabHtml}
    </ul>

    <span class="section-anchor" id="grammar"></span>
    <div class="section-head"><h2>Grammar · 语法</h2></div>
    <ul class="hsk-grammar-list">
      ${grammarHtml}
    </ul>
  </main>

</div>
`.trim();
}
