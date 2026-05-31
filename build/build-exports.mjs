#!/usr/bin/env node
/**
 * build-exports.mjs — emit Pleco + Anki flashcard exports of the corpus.
 *
 * Generated artifacts (under data/exports/):
 *   pleco-characters.txt   tab-separated: simplified TAB pinyin TAB definition
 *   pleco-vocab.txt        same shape
 *   pleco-chengyu.txt      same shape
 *   pleco-all.txt          concat of the three
 *   anki-characters.tsv    columns: hanzi pinyin english hsk radical tags
 *   anki-vocab.tsv         columns: hanzi pinyin english hsk tags
 *   anki-chengyu.tsv       columns: hanzi pinyin literal figurative tags
 *   anki-all.apkg          one combined Anki deck (apkg = zipped sqlite + media)
 *   characters.apkg        per-type Anki decks
 *   vocab.apkg
 *   chengyu.apkg
 *
 * Card extraction rules:
 *   - characters: one card per content/characters/*.md (status:complete)
 *   - vocab:      one card per content/vocab/*.md where category === 'vocab'
 *   - chengyu:    one card per content/{vocab,chengyu}/*.md where category === 'chengyu'
 *
 * Pleco import: open Pleco → Settings → Flashcards → Import → choose
 * pleco-*.txt → field order "Simplified, Pinyin, Definition", separator
 * "Tab". Each file starts with a `//角落書屋/<sub>` header so cards land
 * in a named folder rather than Pleco's default catch-all category.
 *
 * Anki TSV import: File → Import → choose anki-*.tsv → set Type to Basic
 * (or a custom note type) → map columns to fields → Import.
 *
 * Anki .apkg import: double-click *.apkg or File → Import. The deck will
 * appear under "角落書屋 · <type>".
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApkg } from './lib/anki-apkg.mjs';
import { buildSlices, buildCharHskMap, normalizeHsk } from './lib/export-slices.mjs';
import { splitToSyllables } from './lib/pinyin.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENTRIES = JSON.parse(readFileSync(join(ROOT, 'data/entries.json'), 'utf8'));
const OUT_DIR = join(ROOT, 'data/exports');
mkdirSync(OUT_DIR, { recursive: true });

// ────────────────────── Card extraction ──────────────────────

// Parse the CN form out of "X · Y" titles. Vocab/chengyu pages don't carry
// a `char` field — the title has the canonical form first.
function cnFromTitle(title) {
  if (!title) return '';
  const sep = title.indexOf('·');
  if (sep < 0) return title.trim();
  return title.slice(0, sep).trim();
}
function enFromTitle(title) {
  if (!title) return '';
  const sep = title.indexOf('·');
  if (sep < 0) return '';
  return title.slice(sep + 1).trim();
}

// Pleco's "definition" field accepts plain text. We keep it short enough to
// flash-card naturally: English gloss + one-line desc. Strip newlines and
// flatten whitespace so the field stays one line per Pleco's TSV expectation.
function plecoDefinition(card) {
  const parts = [];
  if (card.english) parts.push(card.english);
  if (card.desc) parts.push(card.desc);
  return parts.join(' — ').replace(/\s+/g, ' ').trim();
}

function extractCards() {
  const characters = [];
  const vocab = [];
  const chengyu = [];
  const grammar = [];

  for (const e of ENTRIES) {
    if (e.status !== 'complete') continue;

    if (e.type === 'character') {
      characters.push({
        _type: 'character',
        hanzi: e.char || cnFromTitle(e.title),
        pinyin: e.pinyin || '',
        english: enFromTitle(e.title),
        desc: e.desc || '',
        hsk: e.hsk || '',
        radical: e.radical || '',
        tone: e.tone || '',
        tags: e.tags || [],
        category: e.category || 'characters',
        path: e.path
      });
    } else if (e.type === 'vocab' && e.category === 'vocab') {
      vocab.push({
        _type: 'vocab',
        hanzi: cnFromTitle(e.title),
        pinyin: e.pinyin || '',
        english: enFromTitle(e.title),
        desc: e.desc || '',
        hsk: e.hsk || '',
        tags: e.tags || [],
        category: e.category || 'vocab',
        path: e.path
      });
    } else if (e.category === 'chengyu') {
      chengyu.push({
        _type: 'chengyu',
        hanzi: cnFromTitle(e.title),
        pinyin: e.pinyin || '',
        english: enFromTitle(e.title),
        desc: e.desc || '',
        hsk: e.hsk || '',
        tags: e.tags || [],
        category: e.category || 'chengyu',
        path: e.path
      });
    } else if (e.type === 'grammar') {
      grammar.push({
        _type: 'grammar',
        hanzi: cnFromTitle(e.title),
        pinyin: e.pinyin || '',
        english: enFromTitle(e.title),
        desc: e.desc || '',
        hsk: e.hsk || '',
        tags: e.tags || [],
        category: e.category || 'grammar',
        path: e.path
      });
    }
  }

  // Stable sort by hanzi so day-to-day rebuilds produce diffable exports.
  const byHanzi = (a, b) => (a.hanzi || '').localeCompare(b.hanzi || '', 'zh');
  characters.sort(byHanzi);
  vocab.sort(byHanzi);
  chengyu.sort(byHanzi);
  grammar.sort(byHanzi);
  return { characters, vocab, chengyu, grammar };
}

// ────────────────────── Pleco TSV ──────────────────────
// Format: simplified[TAB]pinyin[TAB]definition\n
// Pleco accepts UTF-8 with no BOM. No header row.

function tsvEscape(s) {
  // Pleco's TSV doesn't support escaped tabs/newlines — strip them.
  return String(s || '').replace(/[\t\r\n]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Pleco renders pinyin per-syllable (tone colors, audio), so multi-syllable
// pinyin must be space-separated. Source frontmatter writes vocab as one
// token (`bǐjiào`) for prose display; expand here on the way out.
function plecoPinyin(pinyin) {
  const syllables = splitToSyllables(pinyin);
  return syllables.length ? syllables.join(' ') : String(pinyin || '');
}

// Pleco honors `//Category/Subcategory` lines in its custom-card import,
// filing the cards that follow under that category. Without one, every
// card lands in Pleco's default catch-all, leaving the user to drag them
// into folders by hand. Always prefix with a Jiǎoluò Shūwū namespace so
// importing this deck never overwrites the user's existing categories.
const PLECO_ROOT = '角落書屋';
function plecoCategoryHeader(sub) {
  return `//${PLECO_ROOT}/${sub}`;
}

function plecoRows(cards) {
  return cards
    .filter(c => c.hanzi && c.pinyin)
    .map(c => `${tsvEscape(c.hanzi)}\t${tsvEscape(plecoPinyin(c.pinyin))}\t${tsvEscape(plecoDefinition(c))}`);
}

function emitPleco(cards, file, categorySub) {
  const rows = plecoRows(cards);
  const body = categorySub
    ? [plecoCategoryHeader(categorySub), ...rows]
    : rows;
  writeFileSync(join(OUT_DIR, file), body.join('\n') + '\n', 'utf8');
  return rows.length;
}

function emitPlecoMulti(groups, file) {
  const out = [];
  for (const { cards, sub } of groups) {
    const rows = plecoRows(cards);
    if (!rows.length) continue;
    out.push(plecoCategoryHeader(sub), ...rows);
  }
  writeFileSync(join(OUT_DIR, file), out.join('\n') + '\n', 'utf8');
  return out.filter(line => !line.startsWith('//')).length;
}

// ────────────────────── Anki TSV ──────────────────────
// Anki accepts TSV via File → Import; users map columns to fields. We emit
// a header comment row Anki ignores (lines starting with '#' are treated as
// pragmas/comments) so the file is self-documenting.

function emitAnkiTsv(cards, file, columns) {
  // columns: [{key, header, derive?}]. `derive` always wins when present —
  // otherwise we'd accidentally `String(array)` truthy fields like c.tags
  // and end up with comma-joined output instead of space-separated.
  const header = '#fields:' + columns.map(c => c.header).join('\t');
  const rows = cards.map(c =>
    columns.map(col => {
      const v = col.derive ? col.derive(c) : c[col.key];
      return tsvEscape(v == null ? '' : v);
    }).join('\t')
  );
  writeFileSync(join(OUT_DIR, file), header + '\n' + rows.join('\n') + '\n', 'utf8');
  return rows.length;
}

// ────────────────────── Main ──────────────────────

const { characters, vocab, chengyu, grammar } = extractCards();

const plecoCharCount  = emitPleco(characters, 'pleco-characters.txt', 'Characters');
const plecoVocabCount = emitPleco(vocab,      'pleco-vocab.txt',      'Vocabulary');
const plecoCyCount    = emitPleco(chengyu,    'pleco-chengyu.txt',    'Chengyu');

// pleco-all keeps each type in its own Pleco category, so users importing
// the combined file get three pre-sorted folders rather than one bucket.
emitPlecoMulti([
  { cards: characters, sub: 'Characters' },
  { cards: vocab,      sub: 'Vocabulary' },
  { cards: chengyu,    sub: 'Chengyu' }
], 'pleco-all.txt');

const ankiTagify = c => (c.tags || []).join(' ');
const ankiCharCount = emitAnkiTsv(characters, 'anki-characters.tsv', [
  { key: 'hanzi', header: 'Hanzi' },
  { key: 'pinyin', header: 'Pinyin' },
  { key: 'english', header: 'English', derive: c => c.english || c.desc },
  { key: 'hsk', header: 'HSK' },
  { key: 'radical', header: 'Radical' },
  { key: 'desc', header: 'Notes' },
  { key: 'tags', header: 'Tags', derive: ankiTagify }
]);
const ankiVocabCount = emitAnkiTsv(vocab, 'anki-vocab.tsv', [
  { key: 'hanzi', header: 'Hanzi' },
  { key: 'pinyin', header: 'Pinyin' },
  { key: 'english', header: 'English', derive: c => c.english || c.desc },
  { key: 'hsk', header: 'HSK' },
  { key: 'desc', header: 'Notes' },
  { key: 'tags', header: 'Tags', derive: ankiTagify }
]);
const ankiCyCount = emitAnkiTsv(chengyu, 'anki-chengyu.tsv', [
  { key: 'hanzi', header: 'Hanzi' },
  { key: 'pinyin', header: 'Pinyin' },
  { key: 'english', header: 'Literal', derive: c => c.english || '' },
  { key: 'desc', header: 'Figurative' },
  { key: 'tags', header: 'Tags', derive: ankiTagify }
]);

// ────────────────────── Anki .apkg decks ──────────────────────
// Builds proper Anki deck packages (zipped sqlite + media). Uses our own
// build/lib/anki-apkg.mjs (better-sqlite3 + jszip) to dodge the 16 MB
// WASM-heap cap of the older sql.js-based libraries.
async function emitApkg(cards, deckName, file, formatBack) {
  const ankiCards = cards
    .filter(c => c.hanzi)
    .map(c => ({
      front: `<div style="font-size:42px;font-family:'Noto Serif SC',serif;">${escapeHtml(c.hanzi)}</div>`,
      back: formatBack(c),
      tags: (c.tags || []).filter(t => t && /^[\w-]+$/.test(t))
    }));
  const buf = await buildApkg({ deckName, cards: ankiCards });
  writeFileSync(join(OUT_DIR, file), buf);
  return ankiCards.length;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function backCharacter(c) {
  return [
    `<div style="font-family:monospace;color:#a06428;font-size:18px;">${escapeHtml(c.pinyin)}</div>`,
    c.english ? `<div style="margin:8px 0 4px;font-weight:600;">${escapeHtml(c.english)}</div>` : '',
    c.desc ? `<div style="font-style:italic;color:#5c3821;">${escapeHtml(c.desc)}</div>` : '',
    `<div style="margin-top:10px;font-size:12px;color:#888;">` +
      [c.hsk ? `HSK ${c.hsk}` : '', c.radical ? `radical ${c.radical}` : ''].filter(Boolean).join(' · ') +
    `</div>`
  ].filter(Boolean).join('');
}
function backVocab(c) {
  return [
    `<div style="font-family:monospace;color:#a06428;font-size:18px;">${escapeHtml(c.pinyin)}</div>`,
    c.english ? `<div style="margin:8px 0 4px;font-weight:600;">${escapeHtml(c.english)}</div>` : '',
    c.desc ? `<div style="font-style:italic;color:#5c3821;">${escapeHtml(c.desc)}</div>` : '',
    c.hsk ? `<div style="margin-top:10px;font-size:12px;color:#888;">HSK ${c.hsk}</div>` : ''
  ].filter(Boolean).join('');
}
function backChengyu(c) {
  return [
    `<div style="font-family:monospace;color:#a06428;font-size:18px;">${escapeHtml(c.pinyin)}</div>`,
    c.english ? `<div style="margin:8px 0 4px;font-weight:600;">${escapeHtml(c.english)}</div>` : '',
    c.desc ? `<div style="font-style:italic;color:#5c3821;">${escapeHtml(c.desc)}</div>` : ''
  ].filter(Boolean).join('');
}

// Per-type apkg decks plus a combined deck for users who want one import.
const apkgCharCount  = await emitApkg(characters, '角落書屋 · Characters', 'characters.apkg', backCharacter);
const apkgVocabCount = await emitApkg(vocab,      '角落書屋 · Vocabulary', 'vocab.apkg',      backVocab);
const apkgCyCount    = await emitApkg(chengyu,    '角落書屋 · Chengyu',    'chengyu.apkg',    backChengyu);

// Combined deck — same cards, single deck. Uses the per-type back formatters
// via a tag-routed _back, plus a content-type tag so Anki users can filter
// or sub-deck after import.
const allCards = [
  ...characters.map(c => ({ ...c, tags: [...(c.tags || []), 'character'], _back: backCharacter })),
  ...vocab.map(c =>      ({ ...c, tags: [...(c.tags || []), 'vocab'],     _back: backVocab })),
  ...chengyu.map(c =>    ({ ...c, tags: [...(c.tags || []), 'chengyu'],   _back: backChengyu }))
];
const apkgAllCount = await (async () => {
  const ankiCards = allCards
    .filter(c => c.hanzi)
    .map(c => ({
      front: `<div style="font-size:42px;font-family:'Noto Serif SC',serif;">${escapeHtml(c.hanzi)}</div>`,
      back: c._back(c),
      tags: (c.tags || []).filter(t => t && /^[\w-]+$/.test(t))
    }));
  const buf = await buildApkg({ deckName: '角落書屋 · All', cards: ankiCards });
  writeFileSync(join(OUT_DIR, 'all.apkg'), buf);
  return ankiCards.length;
})();

// ────────────────────── Sliced decks ──────────────────────
// Builds targeted Anki .apkg + Pleco TSV per slice (HSK level, HSK ladder,
// topic, tag, intent). Slice definitions live in build/lib/export-slices.mjs.
// Files land under data/exports/slices/ so the top-level dir stays focused
// on the core 11 files; manifest references both layers.

const SLICES_DIR = join(OUT_DIR, 'slices');
mkdirSync(SLICES_DIR, { recursive: true });

// Combined corpus (all four types) for the slicer. Each card already has
// _type, hanzi, pinyin, english, desc, hsk, tags, category, path.
const corpus = [...characters, ...vocab, ...chengyu, ...grammar];
const charHskMap = buildCharHskMap(ENTRIES);
const slices = buildSlices(corpus, charHskMap);

// Emit a single combined cards.json that the in-browser builder filters.
// Trimmed to the minimum the builder needs (no _back functions, no
// internal-only fields). One source of truth: same objects the slicer
// just operated on, so cards.json and slices/* always agree.
const cardsJson = corpus
  .filter(c => c.hanzi && c.pinyin)
  .map(c => ({
    h: c.hanzi,
    p: c.pinyin,
    e: c.english || '',
    d: c.desc || '',
    t: c._type,                          // character | vocab | chengyu | grammar
    hsk: c._resolvedHsk == null ? null : c._resolvedHsk,
    hskI: c._hskInferred ? 1 : 0,        // inferred flag (0/1 to keep payload tight)
    tags: (c.tags || []).filter(Boolean),
    r: c.radical || undefined,           // characters only
  }));
writeFileSync(join(OUT_DIR, 'cards.json'), JSON.stringify(cardsJson));

// Pick the right card-back formatter based on the card's _type. Grammar
// uses backVocab (same fields render usefully).
function backFor(card) {
  if (card._type === 'character') return backCharacter(card);
  if (card._type === 'chengyu')   return backChengyu(card);
  return backVocab(card);
}

// Tags emitted to Anki must be [\w-]+ — Anki splits on whitespace so we
// also include slice-identifying tags (`hsk-3`, `topic-religion`, etc.)
// to make in-Anki sub-deck filtering possible after import.
function ankiTagsForSlice(card, slice) {
  const baseTags = (card.tags || []).filter(t => t && /^[\w-]+$/.test(t));
  const sliceTag = `${slice.dimension}-${slice.criterion}`.replace(/[^\w-]/g, '-');
  const typeTag = card._type;
  return [...new Set([...baseTags, sliceTag, typeTag])];
}

async function emitSliceApkg(slice) {
  const ankiCards = slice.cards
    .filter(c => c.hanzi)
    .map(c => ({
      front: `<div style="font-size:42px;font-family:'Noto Serif SC',serif;">${escapeHtml(c.hanzi)}</div>`,
      back: backFor(c),
      tags: ankiTagsForSlice(c, slice),
    }));
  const deckName = `角落書屋 · ${slice.name}`;
  const buf = await buildApkg({ deckName, cards: ankiCards });
  const file = `slices/${slice.slug}.apkg`;
  writeFileSync(join(OUT_DIR, file), buf);
  return { file, count: ankiCards.length };
}

function emitSlicePleco(slice) {
  const rows = plecoRows(slice.cards);
  // File each slice under "Slices/<slice-name>" so several imported slices
  // accumulate as siblings instead of trampling each other.
  const body = [plecoCategoryHeader(`Slices/${slice.name}`), ...rows];
  const file = `slices/${slice.slug}.txt`;
  writeFileSync(join(OUT_DIR, file), body.join('\n') + '\n', 'utf8');
  return { file, count: rows.length };
}

const sliceEntries = [];
for (const slice of slices) {
  const apkg = await emitSliceApkg(slice);
  const pleco = emitSlicePleco(slice);
  sliceEntries.push({
    slug: slice.slug,
    name: slice.name,
    cn: slice.cn || null,
    dimension: slice.dimension,
    criterion: slice.criterion,
    description: slice.description || null,
    count: apkg.count,
    apkg: apkg.file,
    pleco: pleco.file,
    // HSK breakdown of the cards in this slice — useful for the library UI
    // to show "mostly HSK 3" badges on intent decks.
    hskBreakdown: hskHistogram(slice.cards),
  });
}

function hskHistogram(cards) {
  const h = {};
  for (const c of cards) {
    const k = c._resolvedHsk == null ? 'unknown' : `hsk-${c._resolvedHsk}`;
    h[k] = (h[k] || 0) + 1;
  }
  return h;
}

// Manifest summarizing counts so the bulk page can render dynamically.
// `files` keeps the original top-level cards for backwards compatibility
// with the existing exports page; `slices` is the new layer the next-gen
// page will read.
const manifest = {
  generated: new Date().toISOString(),
  files: [
    { file: 'pleco-characters.txt', format: 'pleco', type: 'characters', count: plecoCharCount },
    { file: 'pleco-vocab.txt',      format: 'pleco', type: 'vocab',      count: plecoVocabCount },
    { file: 'pleco-chengyu.txt',    format: 'pleco', type: 'chengyu',    count: plecoCyCount },
    { file: 'pleco-all.txt',        format: 'pleco', type: 'all',        count: plecoCharCount + plecoVocabCount + plecoCyCount },
    { file: 'anki-characters.tsv',  format: 'anki-tsv', type: 'characters', count: ankiCharCount },
    { file: 'anki-vocab.tsv',       format: 'anki-tsv', type: 'vocab',      count: ankiVocabCount },
    { file: 'anki-chengyu.tsv',     format: 'anki-tsv', type: 'chengyu',    count: ankiCyCount },
    { file: 'characters.apkg',      format: 'anki-apkg', type: 'characters', count: apkgCharCount },
    { file: 'vocab.apkg',           format: 'anki-apkg', type: 'vocab',      count: apkgVocabCount },
    { file: 'chengyu.apkg',         format: 'anki-apkg', type: 'chengyu',    count: apkgCyCount },
    { file: 'all.apkg',             format: 'anki-apkg', type: 'all',        count: apkgAllCount }
  ],
  slices: sliceEntries,
};
writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

const sliceCountsByDim = sliceEntries.reduce((acc, s) => {
  acc[s.dimension] = (acc[s.dimension] || 0) + 1;
  return acc;
}, {});

console.log('build-exports:');
console.log(`  Pleco — characters: ${plecoCharCount}, vocab: ${plecoVocabCount}, chengyu: ${plecoCyCount}`);
console.log(`  Anki TSV — characters: ${ankiCharCount}, vocab: ${ankiVocabCount}, chengyu: ${ankiCyCount}`);
console.log(`  Anki .apkg — characters: ${apkgCharCount}, vocab: ${apkgVocabCount}, chengyu: ${apkgCyCount}, all: ${apkgAllCount}`);
console.log(`  Slices (.apkg + .txt each): ${sliceEntries.length} total — ${Object.entries(sliceCountsByDim).map(([d,n])=>`${d}:${n}`).join(', ')}`);
const thinSlices = sliceEntries.filter(s => s.count < 5);
if (thinSlices.length) {
  console.log(`  Thin slices (<5 cards) — predicates correct, corpus thin: ${thinSlices.map(s => `${s.slug}(${s.count})`).join(', ')}`);
}
console.log(`  Manifest: data/exports/manifest.json`);
