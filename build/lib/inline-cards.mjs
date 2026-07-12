/**
 * inline-cards.mjs — harvest the flashcard corpus that lives INSIDE pages.
 *
 * Every content page carries vocabulary the entry manifest never sees:
 *   - compound cards:  <div class="card ..."><div class="card-head">
 *                        <span class="card-cn">CN</span><span class="card-py">py</span>
 *                        <span class="card-en">en</span></div>...<div class="card-def">def</div>
 *   - topic cards:     <div class="card-head"><span class="tag-n">n</span> CN py</div><p>def</p>
 *   - inline chengyu:  <span class="cy-cn">CN</span><span class="cy-py">py</span>
 *                        <span class="cy-en">en</span><span class="cy-note">note</span>
 *   - adj chips:       <span class="a-cn">CN</span><span class="a-py">py</span><span class="a-en">en</span>
 *
 * This module walks content/ (status:complete pages only), extracts those
 * items, and normalizes them into export-ready cards:
 *   { hanzi, pinyin, english, desc, kind, tags, category, sources }
 * kind ∈ 'compound' | 'chengyu' | 'chip'. tags/category merge from every
 * source page that mentions the item, so a compound appearing on both a
 * business page and a daily-life page carries both tag sets and lands in
 * both slices.
 *
 * Dedupe: by hanzi. The richest occurrence wins the definition (longest
 * def text); chips never override a card-sourced definition. Pure module:
 * caller passes contentDir, gets cards back — no writes here.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';

const HZ_RE = /[一-鿿]/;

function stripTags(s) {
  return String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

// Definitions flatten to one line and cap so a flashcard back stays a
// flashcard, not an essay. Cut at a sentence boundary where possible.
const DEF_CAP = 300;
function capDef(s) {
  const flat = stripTags(s);
  if (flat.length <= DEF_CAP) return flat;
  const cut = flat.slice(0, DEF_CAP);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('。'));
  return lastStop > 80 ? cut.slice(0, lastStop + 1).trim() : cut.trim() + '…';
}

// Topic-page card heads put CN + pinyin as loose text after the POS tag:
//   <div class="card-head"><span class="tag-n">n</span> 算盘 suànpán</div>
// Split the remaining text into the CJK run and the latin/pinyin tail.
function splitHeadText(text) {
  const t = stripTags(text);
  const m = t.match(/^([一-鿿·，、…\/\s]+)\s+([a-zA-ZüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙ'’\s\-]+)$/u);
  if (!m) return null;
  const hanzi = m[1].trim();
  const pinyin = m[2].trim();
  if (!HZ_RE.test(hanzi) || !pinyin) return null;
  return { hanzi, pinyin };
}

// One page's worth of extraction. Returns raw items (pre-dedupe).
function extractFromBody(body) {
  const items = [];

  // 1) Full-shape compound cards (character/vocab pages): card-cn/py/en head
  //    followed (same card div) by card-def. Pair them by scanning card blocks.
  const cardBlockRe = /<div class="card[ "][\s\S]*?(?=<div class="card[ "]|<\/div>\s*<!--|$)/g;
  // Simpler, robust approach: find each card-head trio, then the nearest
  // card-def AFTER it (before the next card-head).
  const headRe = /<span class="card-cn">([\s\S]*?)<\/span>\s*<span class="card-py">([\s\S]*?)<\/span>\s*<span class="card-en">([\s\S]*?)<\/span>/g;
  const headMatches = [...body.matchAll(headRe)];
  for (let i = 0; i < headMatches.length; i++) {
    const m = headMatches[i];
    const from = m.index + m[0].length;
    const to = i + 1 < headMatches.length ? headMatches[i + 1].index : body.length;
    const window = body.slice(from, to);
    const defM = window.match(/<div class="card-def">([\s\S]*?)<\/div>/);
    items.push({
      hanzi: stripTags(m[1]),
      pinyin: stripTags(m[2]),
      english: stripTags(m[3]),
      desc: defM ? capDef(defM[1]) : '',
      kind: 'compound',
      rich: 2,
    });
  }

  // 2) Topic-page cards: card-head containing a POS tag span then loose
  //    "CN pinyin" text, first <p> in the same card is the definition.
  const topicHeadRe = /<div class="card-head">\s*<span class="tag-[^"]*">[^<]*<\/span>([^<]+)<\/div>\s*<p>([\s\S]*?)<\/p>/g;
  for (const m of body.matchAll(topicHeadRe)) {
    const head = splitHeadText(m[1]);
    if (!head) continue;
    const desc = capDef(m[2]);
    // English gloss: lead of the definition up to the first period/colon,
    // when short enough to serve as a card-front gloss.
    const enLead = desc.split(/[.:。]/)[0].trim();
    items.push({
      hanzi: head.hanzi,
      pinyin: head.pinyin,
      english: enLead.length <= 60 ? enLead : '',
      desc,
      kind: 'compound',
      rich: 2,
    });
  }

  // 3) Inline chengyu cards: cy-cn/cy-py/cy-en (+ optional cy-note).
  const cyRe = /<span class="cy-cn">([\s\S]*?)<\/span>\s*<span class="cy-py">([\s\S]*?)<\/span>\s*<span class="cy-en">([\s\S]*?)<\/span>(?:\s*<span class="cy-note">([\s\S]*?)<\/span>)?/g;
  for (const m of body.matchAll(cyRe)) {
    items.push({
      hanzi: stripTags(m[1]),
      pinyin: stripTags(m[2]),
      english: stripTags(m[3]),
      desc: m[4] ? capDef(m[4]) : '',
      kind: 'chengyu',
      rich: 3,
    });
  }

  // 4) Adjacent chips: cn/py/en, no definition. Lowest richness — they only
  //    contribute items nothing else covers.
  const chipRe = /<span class="a-cn">([\s\S]*?)<\/span>\s*<span class="a-py">([\s\S]*?)<\/span>\s*<span class="a-en">([\s\S]*?)<\/span>/g;
  for (const m of body.matchAll(chipRe)) {
    items.push({
      hanzi: stripTags(m[1]),
      pinyin: stripTags(m[2]),
      english: stripTags(m[3]),
      desc: '',
      kind: 'chip',
      rich: 1,
    });
  }

  return items;
}

function isUsable(item) {
  if (!item.hanzi || !item.pinyin) return false;
  if (!HZ_RE.test(item.hanzi)) return false;
  // Skip multi-reading composites and pattern placeholders — not one card.
  if (/[\/…()（）A-Za-z]/.test(item.hanzi)) return false;
  if (item.hanzi.length > 12) return false;
  return true;
}

/**
 * Walk contentDir and return the deduped inline-card corpus.
 * Each card: { hanzi, pinyin, english, desc, kind, tags[], category, sources[] }
 */
export function harvestInlineCards(contentDir) {
  const byHanzi = new Map();

  function absorb(item, fm, relPath) {
    if (!isUsable(item)) return;
    const key = item.hanzi;
    const tags = (fm.tags || []).filter(Boolean);
    const category = fm.category || '';
    const existing = byHanzi.get(key);
    if (!existing) {
      byHanzi.set(key, {
        hanzi: item.hanzi,
        pinyin: item.pinyin,
        english: item.english,
        desc: item.desc,
        kind: item.kind,
        _rich: item.rich,
        tags: [...new Set(tags)],
        category,
        sources: [relPath],
      });
      return;
    }
    // Merge: union tags, remember source, richest occurrence keeps the text.
    for (const t of tags) if (!existing.tags.includes(t)) existing.tags.push(t);
    if (!existing.sources.includes(relPath)) existing.sources.push(relPath);
    const richer = item.rich > existing._rich
      || (item.rich === existing._rich && (item.desc || '').length > (existing.desc || '').length);
    if (richer) {
      existing.pinyin = item.pinyin;
      existing.english = item.english || existing.english;
      existing.desc = item.desc || existing.desc;
      existing.kind = item.kind;
      existing._rich = item.rich;
    } else if (!existing.english && item.english) {
      existing.english = item.english;
    }
  }

  function walk(dir, rel = '') {
    for (const name of readdirSync(dir)) {
      if (name.startsWith('_')) continue;
      const full = join(dir, name);
      const relPath = rel ? `${rel}/${name}` : name;
      if (statSync(full).isDirectory()) { walk(full, relPath); continue; }
      if (!name.endsWith('.md')) continue;
      const { data: fm, content: body } = matter(readFileSync(full, 'utf8'));
      if (fm.status !== 'complete') continue;
      if (fm.category === 'families' || fm.category === 'hubs' || fm.category === 'hsk') continue;
      for (const item of extractFromBody(body)) absorb(item, fm, relPath);
    }
  }
  walk(contentDir);

  const cards = [...byHanzi.values()];
  for (const c of cards) delete c._rich;
  cards.sort((a, b) => a.hanzi.localeCompare(b.hanzi, 'zh'));
  return cards;
}
