#!/usr/bin/env node
/**
 * validate-formatting.mjs — structural and formatting quality checks.
 *
 * Checks (all emit category:'formatting'):
 *   - Character pages missing the 'etymology' section-anchor (WARN)
 *   - Topic/vocab/grammar/chengyu pages missing <header class="topic-hero"> (WARN)
 *   - complete pages missing any section-anchor at all (WARN)
 *   - Inconsistent tone markers: hero pinyin diacritic ≠ frontmatter tone number (ERROR)
 *   - Entries with content_review:verified but no visible sources block (WARN)
 *   - Vocab-card examples with Chinese text but no pinyin span (INFO)
 *
 * Reads pages/**\/*.html (generated) + content/**\/*.md (frontmatter).
 * Writes findings into data/_admin/findings.json via mergeFindings().
 */

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { createFinding, mergeFindings, reportFindings } from './lib/findings.mjs';

const ROOT    = path.resolve(new URL('.', import.meta.url).pathname, '..');
const PAGES   = path.join(ROOT, 'pages');
const CONTENT = path.join(ROOT, 'content');

const findings = [];
function emit(level, file, msg, extra = {}) {
  findings.push(createFinding({ level, category: 'formatting', file, msg, ...extra }));
}

// ── tone helpers (mirror validate-facts.mjs) ──────────────────────────────

const TONE_MARKS = { '̄': 1, '́': 2, '̌': 3, '̀': 4 };
function toneFromPinyin(py) {
  if (!py) return null;
  const nfd = py.normalize('NFD');
  for (const ch of nfd) {
    if (TONE_MARKS[ch] !== undefined) return TONE_MARKS[ch];
  }
  return 5; // neutral
}

// ── AI-tell patterns (see templates/_drafting/VOICE.md → "AI tells") ────────
// All WARN-level: surfaced on the admin dashboard, never block the build.
// Patterns are tuned against the live corpus — keep them phrase-level to
// avoid flagging legitimate scholarly prose (e.g. past-tense "served as
// capital" is normal historical English and is NOT matched).

const AI_TELL_CHECKS = [
  {
    key: 'significance-inflation',
    label: 'significance inflation',
    patterns: [
      /\btestament to\b/gi,
      /\btapestry\b/gi,
      /\b(?:cultural|political|religious|linguistic|literary|social|intellectual|culinary|spiritual|economic|philosophical) landscape\b/gi,
      /\bshowcas(?:es|ing|ed)?\b/gi,
      /\bboast(?:s|ing|ed)? (?:a|an|the|over|more)\b/gi,
      /\bvibrant\b/gi,
      /\bpivotal\b/gi,
      /\b(?:crucial|vital) role\b/gi,
      /\bdelv(?:e|es|ing|ed)\b/gi,
    ],
  },
  {
    key: 'copula-avoidance',
    label: 'copula avoidance',
    patterns: [
      /\bserves as\b/gi,
      /\bstands as\b/gi,
      /\bfunctions as\b/gi,
    ],
  },
  {
    key: 'vague-attribution',
    label: 'vague attribution',
    patterns: [
      /\bexperts (?:say|argue|believe|agree)\b/gi,
      /\bscholars (?:say|argue|believe|agree)\b/gi,
      /\bmany (?:believe|argue|scholars)\b/gi,
      /\bsome (?:critics|observers) (?:say|argue|believe)\b/gi,
      /\bobservers have\b/gi,
      /\bit is (?:widely )?believed that\b/gi,
    ],
  },
  {
    key: 'signposting',
    label: 'signposting',
    patterns: [
      /\bit(?:['’]s| is) worth noting\b/gi,
      /\bit is important to (?:note|remember)\b/gi,
      /\bworth mentioning\b/gi,
      /\bimportantly,/gi,
      /\blet(?:['’]s| us) (?:dive|explore|break)\b/gi,
      /\bhere(?:['’]s| is) what you need to know\b/gi,
    ],
  },
  {
    key: 'chatbot-closers',
    label: 'chatbot closer',
    patterns: [
      /\bI hope this helps\b/gi,
      /\blet me know if\b/gi,
      /\bwould you like me to\b/gi,
      /\bin conclusion\b/gi,
      /\bexciting times\b/gi,
      /\bthe future looks bright\b/gi,
      /\bmemories to last a lifetime\b/gi,
    ],
  },
];

// False ranges: decorative "from X to Y" clichés. Plain "from X to Y" is
// pervasive legitimate prose in this corpus (semantic-extension ranges are a
// deliberate house pattern: "from the literal square to the cardinal
// directions"), so only two high-precision shapes are flagged:
//   1. "everything/anything/ranging from X to Y" — the classic sweep cliché
//   2. Two or more "from … to …" spans stacked in one sentence — the
//      rhetorical double-range ("from X to Y, from A to B")
function findFalseRanges(text) {
  const hits = [];
  const sweepRe = /\b(?:everything|anything|ranging) from [^.。!?]{3,60}? to [^.。!?,;]{3,60}/gi;
  let m;
  while ((m = sweepRe.exec(text)) !== null) {
    if (!/\d/.test(m[0]) && !/[一-鿿]/.test(m[0])) hits.push(m[0].trim());
  }
  for (const sentence of text.split(/(?<=[.!?。])\s+/)) {
    if (/\d/.test(sentence) || /[一-鿿]/.test(sentence)) continue;
    const pairs = sentence.match(/\bfrom (?:the )?[a-z][a-z'’ -]{3,50}? to (?:the )?[a-z]/gi) || [];
    if (pairs.length >= 2) hits.push(sentence.trim().slice(0, 90));
  }
  return hits;
}

// ── slow-opening check helpers ───────────────────────────────────────────────

const PINYIN_DIACRITIC_RE = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙ]/;

function sentenceHasConcreteFact(sentence) {
  if (/\d/.test(sentence)) return true;                       // date or number
  if (/[一-鿿]/.test(sentence)) return true;          // CN term
  if (PINYIN_DIACRITIC_RE.test(sentence)) return true;        // toned pinyin
  // A capitalized word that isn't sentence-initial → proper name
  const tokens = sentence.trim().split(/\s+/);
  if (tokens.slice(1).some(t => /^[A-Z][a-z]/.test(t.replace(/^["'“‘(]+/, '')))) return true;
  // Sentence-initial proper noun: possessive ("China's …") or a capitalized
  // pair ("Han Dynasty …"). Plain initial caps are ambiguous and don't count.
  const first = (tokens[0] || '').replace(/^["'“‘(]+/, '');
  return /^[A-Z][a-z]+[’']s$/.test(first);
}

function splitSentences(text) {
  return text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
}

// Extract the visible text of the first <p> inside the first .scholar block.
// (.scholar contains a nested .scholar-label div, so match forward to the
// first <p> rather than trying to balance closing tags.)
function firstScholarParagraph(src) {
  const m = src.match(/<div class="scholar[^"]*"[^>]*>[\s\S]{0,600}?<p[^>]*>([\s\S]*?)<\/p>/);
  if (!m) return null;
  return m[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── file walkers ─────────────────────────────────────────────────────────────

function walkPages(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith('_')) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) out.push(...walkPages(full));
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

// ── main check loop ───────────────────────────────────────────────────────────

for (const pageFull of walkPages(PAGES)) {
  const pageRel = path.relative(ROOT, pageFull); // e.g. "pages/characters/gan3_感.html"
  const contentRel = pageRel.replace(/^pages\//, 'content/').replace(/\.html$/, '.md');
  const contentFull = path.join(ROOT, contentRel);

  // Skip pages with no corresponding content source (e.g. hsk/ synthesized pages)
  if (!fs.existsSync(contentFull)) continue;

  const html = fs.readFileSync(pageFull, 'utf8');
  const src  = fs.readFileSync(contentFull, 'utf8');
  const { data: fm } = matter(src);

  // Only check complete pages — stubs are intentionally thin
  if (fm.status !== 'complete') continue;

  const type = fm.type;
  const relFile = contentRel;

  // ── 1. Character page: must have etymology section ───────────────────────
  if (type === 'character') {
    if (!html.includes('id="etymology"')) {
      emit('WARN', relFile, 'character page missing section-anchor id="etymology"', {
        fix: 'Add <span class="section-anchor" id="etymology"></span> before the etymology section head',
      });
    }
  }

  // ── 2. Non-character types: must have topic-hero header ─────────────────
  // Family-index pages (category: families) are structurally distinct — they
  // use <header class="topic-hero family-hero ..."> with extra classes, and
  // they are aggregate index pages, not deep content. Exempt them.
  const isFamilyIndex = (fm.category === 'families');
  if (['topic', 'vocab', 'grammar', 'chengyu'].includes(type) && !isFamilyIndex) {
    // Match class="topic-hero" with optional trailing classes (family-hero etc).
    if (!/<header[^>]*\bclass="topic-hero(?:\s|")/.test(html)) {
      emit('WARN', relFile, `${type} page missing <header class="topic-hero">`, {
        fix: 'Wrap the page header in <header class="topic-hero"> per the content page spec',
      });
    }
  }

  // ── 3. All complete pages: must have at least one section-anchor ─────────
  // Same exemption for family-index pages — they are sidebar-nav-only and
  // don't need TOC scroll-spy on their hero panel.
  if (!isFamilyIndex && !html.includes('class="section-anchor"')) {
    emit('WARN', relFile, 'no section-anchor elements found — TOC scroll-spy will not work', {
      fix: 'Add <span class="section-anchor" id="..."></span> before each major section',
    });
  }

  // ── 4. Tone marker / tone number consistency ─────────────────────────────
  // Only for character pages with both pinyin and tone in frontmatter.
  // validate-facts already checks this, but that validator skips non-character
  // pages. Here we catch vocab/grammar/topic pages that embed pinyin in the hero.
  if (type !== 'character' && fm.pinyin && fm.tone) {
    const derived = toneFromPinyin(fm.pinyin);
    if (derived !== null && derived !== fm.tone) {
      emit('ERROR', relFile,
        `tone: ${fm.tone} but pinyin '${fm.pinyin}' has tone mark = ${derived}`,
        { fix: `Fix either the 'tone' or 'pinyin' frontmatter field so they agree` });
    }
  }

  // ── 5. Verified entries: sources block should be present ─────────────────
  if (fm.content_review === 'verified') {
    const hasSources = /class="sources|id="sources|<div[^>]+sources/.test(html) ||
                       (fm.content_sources && fm.content_sources.length > 0);
    if (!hasSources) {
      emit('WARN', relFile, `content_review:verified but no sources block found`, {
        fix: 'Add a Sources section to the page body listing the reference works consulted',
      });
    }
  }

  // ── 6. Em-dash hygiene ───────────────────────────────────────────────────
  // Em-dashes in tooltip/summary fields (frontmatter desc/metaDesc/title/pageTitle)
  // are visible in Google search snippets, social shares, and homepage cards. They
  // should be zero. Body prose has a per-page budget — many em-dashes in body =
  // voice regression even after the 2026-04 rewrite pass.
  const FRONTMATTER_TEXT_FIELDS = ['desc', 'metaDesc', 'title', 'pageTitle'];
  for (const field of FRONTMATTER_TEXT_FIELDS) {
    const v = fm[field];
    if (typeof v === 'string' && v.includes('—')) {
      emit('ERROR', relFile,
        `frontmatter '${field}' contains em-dash (—) — these surface in tooltips, search snippets, and card summaries`,
        { fix: `Rewrite frontmatter ${field} without em-dash. Use a comma, colon, parenthetical, or split into two sentences.` });
    }
  }

  // Body em-dash budget: count em-dashes in user-authored prose. Allow a small
  // budget per page (3) before warning. Never count em-dashes that are
  // legitimate typographic conventions: gloss separators (.sh-en/.card-en/
  // .cy-en/.a-en), HTML attribute values (e.g. data-distinct="…—…"), Chinese
  // example/title text where —— is the standard 破折号 punctuation, or fenced
  // code. The remaining count reflects only English prose em-dashes — the
  // voice-regression risk we actually care about.
  const bodyForCount = src
    .replace(/^---[\s\S]*?\n---\n/, '')                       // strip frontmatter
    .replace(/```[\s\S]*?```/g, '')                           // strip fenced code
    .replace(/<!--[\s\S]*?-->/g, '')                          // strip HTML comments
    .replace(/<span class="sh-en">[\s\S]*?<\/span>/g, '')     // strip section gloss
    .replace(/<span class="card-en">[\s\S]*?<\/span>/g, '')   // strip card gloss
    .replace(/<span class="cy-en">[\s\S]*?<\/span>/g, '')     // strip chengyu gloss
    .replace(/<span class="a-en">[\s\S]*?<\/span>/g, '')      // strip adj chip gloss
    .replace(/<span class="pattern-en">[\s\S]*?<\/span>/g, '') // strip poetry translation gloss
    .replace(/<div class="ex-cn">[\s\S]*?<\/div>/g, '')       // strip Chinese examples (— is 破折号)
    .replace(/<span class="sh-cn">[\s\S]*?<\/span>/g, '')     // strip Chinese section title
    .replace(/<span class="card-cn">[\s\S]*?<\/span>/g, '')   // strip Chinese card title
    .replace(/<span class="cy-cn">[\s\S]*?<\/span>/g, '')     // strip Chinese chengyu
    .replace(/<span class="a-cn">[\s\S]*?<\/span>/g, '')      // strip Chinese adj chip
    .replace(/<span class="[^"]*td-py-sm[^"]*">[\s\S]*?<\/span>/g, '') // strip table inline gloss
    .replace(/<[^>]*>/g, '');                                 // strip remaining HTML tags (incl. attributes)
  // Em-dashes that follow sentence-ending punctuation (with optional close
  // quote) are gloss separators ("Chinese sentence. — English translation"),
  // a stable typographic convention, not voice em-dashes. Don't count them.
  const proseEmDashes = bodyForCount.match(/—/g) || [];
  const emDashCount = proseEmDashes.length - (bodyForCount.match(/[.!?。！？][\s"'”’)\]]*—\s/g) || []).length;
  const EM_DASH_BUDGET = 0;
  if (emDashCount > EM_DASH_BUDGET) {
    emit('ERROR', relFile,
      `${emDashCount} em-dashes in body prose. Voice regression — em-dashes are an LLM tell.`,
      { fix: `Rewrite to use commas, colons, parentheticals, or sentence splits. Keep em-dashes only for sharp interruptions a comma cannot carry.` });
  }

  // ── 7. Card examples: Chinese text without pinyin sibling ────────────────
  // Look for .card elements that contain CJK characters but no .card-py or
  // .card-rd span. This is a common authoring gap.
  const cardRe = /<(?:div|article)[^>]*class="card[^"]*"[^>]*>([\s\S]*?)<\/(?:div|article)>/g;
  let cardMatch;
  let missingPinyinCount = 0;
  while ((cardMatch = cardRe.exec(html)) !== null) {
    const cardBody = cardMatch[1];
    // Check if this card has CJK content
    const hasCjk = /[一-鿿㐀-䶿]/.test(cardBody);
    // Check if it has a pinyin span (.card-py or .card-rd)
    const hasPinyin = /class="card-py|class="card-rd/.test(cardBody);
    if (hasCjk && !hasPinyin) missingPinyinCount++;
  }
  if (missingPinyinCount > 0) {
    emit('INFO', relFile,
      `${missingPinyinCount} vocab card${missingPinyinCount > 1 ? 's' : ''} contain Chinese text but no pinyin span (.card-py)`,
      { fix: 'Add <span class="card-py">…</span> to each card entry' });
  }

  // ── 8. AI-tell word patterns (WARN) ──────────────────────────────────────
  // Scan English prose only: bodyForCount has frontmatter, code, comments,
  // gloss spans, Chinese example text, and all HTML tags/attributes stripped.
  // Also scan the frontmatter desc/metaDesc, which surface on cards and SERPs.
  const proseWithDesc = [fm.desc, fm.metaDesc, bodyForCount]
    .filter(v => typeof v === 'string').join('\n');
  for (const check of AI_TELL_CHECKS) {
    const matched = new Map(); // lowercased phrase → count
    for (const re of check.patterns) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(proseWithDesc)) !== null) {
        const key = m[0].toLowerCase().replace(/\s+/g, ' ').trim();
        matched.set(key, (matched.get(key) || 0) + 1);
      }
    }
    if (matched.size > 0) {
      const total = [...matched.values()].reduce((a, b) => a + b, 0);
      const list = [...matched.keys()].slice(0, 6).join('", "');
      emit('WARN', relFile,
        `AI tell (${check.label}): ${total}× — "${list}"`,
        { fix: 'Rewrite per VOICE.md "AI tells": state the plain fact; cut the inflation/hedge/signpost.' });
    }
  }

  // False ranges get their own pass (custom exclusion logic).
  const ranges = findFalseRanges(proseWithDesc);
  if (ranges.length > 0) {
    emit('WARN', relFile,
      `AI tell (false range): ${ranges.length}× — "${ranges.slice(0, 4).join('", "')}"`,
      { fix: 'Decorative "from X to Y" spans — replace with the concrete list or claim (VOICE.md "AI tells").' });
  }

  // ── 9. Slow opening (WARN) ───────────────────────────────────────────────
  // The first scholar paragraph should hit a concrete fact (name, date,
  // number, or CN term) within its first 3 sentences. Ramble openings fail
  // the coffee test and read as AI atmosphere.
  const opening = firstScholarParagraph(src);
  if (opening) {
    const sentences = splitSentences(opening);
    if (sentences.length > 3) {
      const lead = sentences.slice(0, 3);
      if (!lead.some(sentenceHasConcreteFact)) {
        emit('WARN', relFile,
          `slow opening: first scholar paragraph has no concrete fact (name, date, number, or CN term) in its first 3 sentences`,
          { fix: 'Rewrite the opening to lead with the interesting specific (VOICE.md "Openings" / coffee test).' });
      }
    }
  }
}

// ── data/featured.json — homepage and Today thread cards render these strings
// directly, so em-dashes here surface in user-facing copy. The validator only
// walks content/ by default, so featured.json bypassed the gate. Check it
// explicitly: any `—` in `title` or `hook` is an ERROR.
{
  const featuredPath = path.join(ROOT, 'data', 'featured.json');
  if (fs.existsSync(featuredPath)) {
    try {
      const themes = JSON.parse(fs.readFileSync(featuredPath, 'utf8'));
      for (const t of themes) {
        for (const field of ['title', 'hook']) {
          if (typeof t[field] === 'string' && t[field].includes('—')) {
            emit('ERROR', 'data/featured.json',
              `theme '${t.slug}' field '${field}' contains em-dash (—). Renders verbatim on the homepage and Today page.`,
              { fix: `Rewrite ${field} without em-dash. Use comma, colon, parenthetical, or split.` });
          }
        }
      }
    } catch (e) {
      emit('WARN', 'data/featured.json', `could not parse: ${e.message}`);
    }
  }
}

// ── persist ──────────────────────────────────────────────────────────────────
reportFindings('validate-formatting', findings);
mergeFindings(ROOT, findings, ['formatting']);

const errorCount = findings.filter(f => f.level === 'ERROR').length;
process.exit(errorCount > 0 ? 1 : 0);
