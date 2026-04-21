#!/usr/bin/env node
// validate-facts.mjs — cross-check factual claims in content against canonical reference data.
//
// Checks:
//   1. Frontmatter radical/pinyin/tone for character pages (against makemeahanzi/Unihan).
//   2. Prose component decomposition claims of the form "X = Y + Z" against IDS data.
//   3. "phonetic" claims — verify the named component is the actual phonetic per reference.
//
// Exits 1 on any ERROR; WARNINGs and INFOs are reported but do not fail the build.
// See docs: templates/_drafting/factual-review.md

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const CONTENT = path.join(ROOT, 'content');
const REF_DIR = path.join(ROOT, 'data', '_reference');

const FACTS = JSON.parse(fs.readFileSync(path.join(REF_DIR, 'hanzi-facts.json'), 'utf8'));
const VARIANTS_RAW = JSON.parse(fs.readFileSync(path.join(REF_DIR, 'radical-variants.json'), 'utf8'));
const SIMP_TRAD_PAIRS = JSON.parse(fs.readFileSync(path.join(REF_DIR, 'simp-trad-pairs.json'), 'utf8'));

// Build equivalence map: every char in a group maps to the canonical form (group[0]).
const VARIANT_OF = new Map();
for (const group of VARIANTS_RAW.groups) {
  // A char may live in multiple groups (e.g. 阝 is both 阜 and 邑). Record all canonicals.
  for (const ch of group) {
    if (!VARIANT_OF.has(ch)) VARIANT_OF.set(ch, new Set());
    VARIANT_OF.get(ch).add(group[0]);
  }
}
// Fold simp↔trad pairs into the same equivalence map (a and b point to a shared canonical).
for (const [a, b] of SIMP_TRAD_PAIRS) {
  const canon = a < b ? a : b;
  if (!VARIANT_OF.has(a)) VARIANT_OF.set(a, new Set());
  if (!VARIANT_OF.has(b)) VARIANT_OF.set(b, new Set());
  VARIANT_OF.get(a).add(canon);
  VARIANT_OF.get(b).add(canon);
}

function normalizeComponent(ch) {
  // Return the set of canonical forms this component could represent.
  if (VARIANT_OF.has(ch)) return VARIANT_OF.get(ch);
  return new Set([ch]);
}

function componentsMatch(claimed, actualSet) {
  // True if claimed char matches any char in actualSet, modulo variant equivalence.
  const claimedNorms = normalizeComponent(claimed);
  for (const actual of actualSet) {
    const actualNorms = normalizeComponent(actual);
    for (const cn of claimedNorms) if (actualNorms.has(cn)) return true;
  }
  return false;
}

// IDS operators that combine components — strip them to get the leaves.
const IDS_OPERATORS = new Set([
  '⿰','⿱','⿲','⿳','⿴','⿵',
  '⿶','⿷','⿸','⿹','⿺','⿻',
]);

function idsLeaves(decomp, depth = 0) {
  // Flatten an IDS string to its leaf components. Depth 1 = direct leaves only.
  // We use depth 2 by default so a claim like "笔 = 竹 + 毛" also matches 笔's
  // decomposition even when we chase one level deeper.
  if (!decomp || decomp === '？') return new Set();
  const leaves = new Set();
  for (const ch of decomp) {
    if (IDS_OPERATORS.has(ch)) continue;
    if (ch === '？') continue;
    leaves.add(ch);
  }
  if (depth === 0) return leaves;
  // Recursive expansion: for each leaf, if we have its decomposition, add those leaves too.
  const expanded = new Set(leaves);
  for (const leaf of leaves) {
    const sub = FACTS[leaf];
    if (sub && sub.decomposition && sub.decomposition !== '？' && sub.decomposition !== leaf) {
      // Avoid self-reference infinite recursion.
      const subLeaves = idsLeaves(sub.decomposition, depth - 1);
      for (const sl of subLeaves) expanded.add(sl);
    }
  }
  return expanded;
}

// Strip HTML tags and decode a few common entities.
function stripTags(html) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

// Remove parenthetical sub-clauses so a decomposition claim like
//   "笔 (simplified from 筆) = 竹 + 毛"
// doesn't accidentally resolve its subject to 筆 inside the parens.
// Runs until stable so nested parens collapse.
function stripParens(s) {
  let prev;
  do {
    prev = s;
    s = s.replace(/\([^()]*\)/g, ' ');
  } while (s !== prev);
  return s.replace(/\s+/g, ' ');
}

function isHanzi(ch) {
  const cp = ch.codePointAt(0);
  return (cp >= 0x4E00 && cp <= 0x9FFF) || (cp >= 0x3400 && cp <= 0x4DBF) ||
         (cp >= 0x2E80 && cp <= 0x2EFF) || (cp >= 0x2F00 && cp <= 0x2FDF);
}

// Extract decomposition claims from prose. We look for the specific pattern:
//
//   [SUBJECT hanzi][optional pinyin/gloss]?  =  [COMP1 hanzi][optional gloss]  +  [COMP2 hanzi]
//
// Strict bounds: between '=' and '+' we allow ≤80 chars AND no hanzi other than COMP1.
// This rejects compound-formation patterns like "有 + 时 = 有时" (where the RHS starts
// with a hanzi sequence forming a compound, not a decomposition).
//
// Returns array of {char, components, context}.
function extractDecomposition(text) {
  const claims = [];
  // Subject: single hanzi optionally followed by pinyin-with-tones and parenthetical gloss, all
  //   before the '=' — we disallow any intervening hanzi so the subject is unambiguous.
  // Component 1: first hanzi after the '='; after it, allow only non-hanzi gloss up to '+'.
  // Component 2: first hanzi after the '+'.
  const RE = /([一-鿿])[^一-鿿=+\n]{0,80}?=\s*([一-鿿])[^一-鿿+\n]{0,60}\+\s*([一-鿿])/gu;
  let m;
  while ((m = RE.exec(text)) !== null) {
    const [whole, subj, c1, c2] = m;
    // Disambiguator #1: in a decomposition, the subject should NOT appear as a component.
    // "X + Y = XY" patterns get rejected here.
    if (c1 === subj || c2 === subj) continue;
    // Disambiguator #2: look immediately after the full match for ' = [subj][other-hanzi]' or
    // for the compound-formation signature "= XY" (i.e. the subject hanzi immediately after =).
    // If present, this is "A + B = AB" territory, skip.
    const after = text.slice(m.index + whole.length, m.index + whole.length + 30);
    if (new RegExp('^[^=]{0,25}=\\s*' + subj).test(after)) continue;
    const startCtx = Math.max(0, m.index - 40);
    const ctx = text.slice(startCtx, m.index + whole.length + 40).trim();
    claims.push({ char: subj, components: [c1, c2], context: ctx });
  }
  return claims;
}

// Extract "phonetic" claims: a component preceded by a phonetic tag.
// Patterns:
//   Y (phonetic ...)
//   Y ... phonetic
//   phonetic: Y
//   Y is phonetic
// Returns array of {char, context}.
function extractPhoneticClaims(text) {
  const claims = [];
  const RE = /([一-鿿])\s*(?:[a-zA-Zǎàáèéěīíìōóǒùúǔǖǘǚǜü]{1,10}\s*)?\(?\s*(?:the\s+)?phonetic/giu;
  let m;
  while ((m = RE.exec(text)) !== null) {
    const startCtx = Math.max(0, m.index - 30);
    const ctx = text.slice(startCtx, m.index + 60).trim();
    claims.push({ char: m[1], context: ctx });
  }
  return claims;
}

// Tone mark → tone number mapping.
const TONE_MARKS = {
  '̄': 1, // ā
  '́': 2, // á
  '̌': 3, // ǎ
  '̀': 4, // à
};
function toneFromPinyin(py) {
  if (!py) return null;
  // Normalize to NFD to expose combining marks.
  const nfd = py.normalize('NFD');
  for (const ch of nfd) {
    if (TONE_MARKS[ch]) return TONE_MARKS[ch];
  }
  return 5; // neutral tone
}

function stripTone(py) {
  if (!py) return '';
  return py.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Findings collector.
const findings = [];
function emit(level, file, msg, extra = {}) {
  findings.push({ level, file, msg, ...extra });
}

function validateFile(fp) {
  const src = fs.readFileSync(fp, 'utf8');
  const rel = path.relative(ROOT, fp);
  const { data: fm, content: body } = matter(src);

  // ────────────────────── Layer 1: Frontmatter cross-check ──────────────────────
  if (fm.type === 'character') {
    const ch = fm.char;
    const ref = FACTS[ch];
    if (!ref) {
      emit('WARN', rel, `no reference entry for character '${ch}' (not in makemeahanzi) — cannot verify frontmatter`);
    } else {
      // Pinyin check: WARN only. makemeahanzi stores one primary reading; polyphones
      // (多音字) routinely use secondary readings, so a mismatch signals "please verify"
      // rather than a clear error.
      if (fm.pinyin && ref.pinyin && ref.pinyin.length > 0) {
        if (!ref.pinyin.some(p => p === fm.pinyin)) {
          emit('WARN', rel, `pinyin '${fm.pinyin}' differs from reference ${JSON.stringify(ref.pinyin)} for '${ch}' — confirm if secondary reading is intended`);
        }
      }
      // Tone-mark/tone-number consistency
      if (fm.pinyin && fm.tone) {
        const derived = toneFromPinyin(fm.pinyin);
        if (derived !== null && derived !== fm.tone) {
          emit('ERROR', rel, `tone: ${fm.tone} but pinyin '${fm.pinyin}' has tone mark = ${derived}`);
        }
      }
      // Radical check (allow variant equivalence).
      if (fm.radical && ref.radical) {
        if (!componentsMatch(fm.radical, new Set([ref.radical]))) {
          emit('WARN', rel, `radical '${fm.radical}' differs from reference '${ref.radical}' for '${ch}' (may be a system choice — verify)`);
        }
      }
    }
  }

  // ────────────── Layer 1.5: Prose decomposition cross-check ──────────────
  const text = stripTags(body);
  const claimsText = stripParens(text);
  const claims = extractDecomposition(claimsText);
  for (const claim of claims) {
    const ref = FACTS[claim.char];
    if (!ref || !ref.decomposition) continue; // Silent skip when no reference.
    const leaves = idsLeaves(ref.decomposition, 1);
    if (leaves.size === 0) continue;
    for (const comp of claim.components) {
      if (!componentsMatch(comp, leaves)) {
        emit('ERROR', rel,
          `decomposition claim '${claim.char} = ${claim.components.join(' + ')}' — '${comp}' not in reference components {${[...leaves].join(',')}} (ref: ${ref.decomposition})`,
          { context: claim.context });
      }
    }
  }

  // ────────────── Layer 1.75: Phonetic plausibility ──────────────
  // We only check phonetic claims that appear in the page's etymology section — claims
  // in later sections (like "佛 is phonetic in 仿佛") are about compounds, not the
  // character's own structure, so they're out of scope for this check.
  const ETY = claimsText.match(/Etymological Insight[\s\S]*?(?=(?:Structure|Formation|Compounds|Modern Uses|Key Compounds|$))/i);
  if (ETY && fm.type === 'character') {
    const subj = fm.char;
    const ref = FACTS[subj];
    if (ref && ref.etymology && ref.etymology.type === 'pictophonetic') {
      const canonicalPhonetic = ref.etymology.phonetic;
      if (canonicalPhonetic) {
        for (const p of extractPhoneticClaims(ETY[0])) {
          // Skip self-reference (the page talking about its own character as phonetic
          // elsewhere, e.g. 佛 as phonetic in 仿佛).
          if (p.char === subj) continue;
          if (!componentsMatch(p.char, new Set([canonicalPhonetic]))) {
            emit('WARN', rel,
              `phonetic claim: '${p.char}' named as phonetic for '${subj}', but reference phonetic is '${canonicalPhonetic}'`,
              { context: p.context });
          }
        }
      }
    }
  }

  // ────────────── Layer 2: Review-state gate ──────────────
  if (fm.status === 'complete' && (fm.type === 'character' || fm.type === 'vocab')) {
    if (!fm.factual_review) {
      emit('ERROR', rel,
        `status:complete character/vocab page is missing 'factual_review' frontmatter (must be 'verified' or 'pending')`);
    } else if (!['verified', 'pending', 'unverified'].includes(fm.factual_review)) {
      emit('ERROR', rel,
        `factual_review: '${fm.factual_review}' — must be 'verified', 'pending', or 'unverified'`);
    } else if (fm.factual_review === 'verified' && (!fm.factual_sources || fm.factual_sources.length === 0)) {
      emit('ERROR', rel,
        `factual_review: verified requires a non-empty 'factual_sources' array (e.g. ['Outlier', 'Wenlin', 'Shuōwén'])`);
    }
  }
}

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('_')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.md')) validateFile(p);
  }
}

walk(CONTENT);

// ────────────── Coverage audit: warn about hanzi not in reference ──────────────
// Any hanzi used in content/ but absent from hanzi-facts.json means the validator
// silently skipped its claims. This is our "reference data is stale" alarm —
// surfaces when new content uses characters outside the vendored subset.
// Run `npm run refresh:reference` (optionally with --fetch) to expand coverage.
{
  const used = new Set();
  const walkForChars = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('_')) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walkForChars(p);
      else if (e.name.endsWith('.md')) {
        const src = fs.readFileSync(p, 'utf8');
        for (const ch of src) {
          const cp = ch.codePointAt(0);
          if ((cp >= 0x4E00 && cp <= 0x9FFF) || (cp >= 0x3400 && cp <= 0x4DBF)) used.add(ch);
        }
      }
    }
  };
  walkForChars(CONTENT);
  const uncovered = [];
  for (const ch of used) if (!FACTS[ch]) uncovered.push(ch);
  if (uncovered.length > 0) {
    emit('WARN', 'data/_reference/hanzi-facts.json',
      `${uncovered.length} hanzi appear in content/ but have no reference entry: ${uncovered.slice(0, 40).join('')}${uncovered.length > 40 ? '…' : ''}. ` +
      `Claims about these characters cannot be mechanically verified. Run 'npm run refresh:reference' after updating upstream data.`);
  }
}

// ────────────── Report ──────────────
const byLevel = { ERROR: [], WARN: [], INFO: [] };
for (const f of findings) (byLevel[f.level] || []).push(f);

const format = f => {
  let s = `  ${f.file}: ${f.msg}`;
  if (f.context) s += `\n      ctx: "${f.context.slice(0, 180)}"`;
  return s;
};

if (byLevel.ERROR.length) {
  console.log(`\n❌ ${byLevel.ERROR.length} ERROR${byLevel.ERROR.length === 1 ? '' : 's'}:\n`);
  byLevel.ERROR.forEach(f => console.log(format(f)));
}
if (byLevel.WARN.length) {
  console.log(`\n⚠  ${byLevel.WARN.length} WARNING${byLevel.WARN.length === 1 ? '' : 's'}:\n`);
  byLevel.WARN.forEach(f => console.log(format(f)));
}

if (byLevel.ERROR.length === 0 && byLevel.WARN.length === 0) {
  console.log('✓ validate-facts: all factual claims verified against reference data.');
} else {
  console.log(`\nSummary: ${byLevel.ERROR.length} errors, ${byLevel.WARN.length} warnings.`);
}

process.exit(byLevel.ERROR.length > 0 ? 1 : 0);
