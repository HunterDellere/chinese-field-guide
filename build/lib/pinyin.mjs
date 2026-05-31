/**
 * pinyin.mjs — pinyin normalization helpers.
 *
 * Converts toned pinyin ("gǎn", "chádào") into space-separated numeric pinyin
 * ("gan3", "cha2 dao4") suitable for Microsoft TTS SSML <phoneme alphabet="sapi">.
 * Falls back gracefully when input has no tone marks (treats as tone 5/neutral).
 */

const TONED_VOWELS = {
  // a
  'ā': ['a', 1], 'á': ['a', 2], 'ǎ': ['a', 3], 'à': ['a', 4],
  // e
  'ē': ['e', 1], 'é': ['e', 2], 'ě': ['e', 3], 'è': ['e', 4],
  // i
  'ī': ['i', 1], 'í': ['i', 2], 'ǐ': ['i', 3], 'ì': ['i', 4],
  // o
  'ō': ['o', 1], 'ó': ['o', 2], 'ǒ': ['o', 3], 'ò': ['o', 4],
  // u
  'ū': ['u', 1], 'ú': ['u', 2], 'ǔ': ['u', 3], 'ù': ['u', 4],
  // ü
  'ǖ': ['ü', 1], 'ǘ': ['ü', 2], 'ǚ': ['ü', 3], 'ǜ': ['ü', 4],
  // some sources use u with diaeresis as base
  'ü': ['ü', 5],
};

/**
 * Convert one syllable like "gǎn" or "lüè" → "gan3" / "lve4".
 * Microsoft sapi uses 'v' for ü.
 */
export function syllableToNumeric(raw) {
  if (!raw) return '';
  let tone = 5;
  let out = '';
  for (const ch of raw) {
    if (TONED_VOWELS[ch]) {
      const [base, t] = TONED_VOWELS[ch];
      out += base;
      if (t !== 5) tone = t;
    } else {
      out += ch;
    }
  }
  // sapi expects 'v' for ü
  out = out.replace(/ü/g, 'v');
  // strip anything non a-z
  out = out.toLowerCase().replace(/[^a-z]/g, '');
  if (!out) return '';
  return out + tone;
}

/**
 * Tokenize a pinyin string ("chádào", "lǎo shī", "Zhōng-guó")
 * into syllables. Splits on whitespace, hyphens, and apostrophes.
 * Returns an array of numeric-pinyin syllables.
 */
export function pinyinToNumericSyllables(pinyin) {
  return splitToSyllables(pinyin)
    .map(syllableToNumeric)
    .filter(Boolean);
}

/**
 * Tokenize a pinyin string into toned syllable segments — e.g.
 * "bǐjiào" → ["bǐ", "jiào"], "gōngfu chá" → ["gōng", "fu", "chá"].
 * Already-separated input (chengyu) round-trips cleanly. Used by the
 * Pleco/Anki exporters and the pinyin-disambiguation index. The original
 * casing and tone marks are preserved.
 */
export function splitToSyllables(pinyin) {
  if (!pinyin) return [];
  const parts = String(pinyin)
    .replace(/[·’'\-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const out = [];
  for (const part of parts) {
    for (const seg of splitConcatenatedSyllables(part)) {
      out.push(seg);
    }
  }
  return out;
}

// Mandarin pinyin finals (toneless), longest first so greedy match
// prefers the maximal final (`iang` over `ia`, `iao` over `ia`). Finals
// ending in `n` / `ng` are listed in full because they're inseparable
// from the rest of the final (`ang`, not `a` + `ng`).
const FINALS = [
  'iong', 'iang', 'uang', 'ueng',
  'iao', 'iou', 'uai', 'uei', 'üan', 'ian', 'uan',
  'ang', 'eng', 'ing', 'ong', 'üe', 'ün',
  'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ia', 'ie', 'in', 'iu',
  'ua', 'uo', 'ui', 'un', 'er',
  'a', 'o', 'e', 'i', 'u', 'ü',
  'm', 'n'
];
const INITIALS = [
  'zh', 'ch', 'sh',
  'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h',
  'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w'
];

function splitConcatenatedSyllables(part) {
  // Build a toneless skeleton so we can match against FINALS/INITIALS,
  // then slice the original (still toned) string at the same offsets.
  let bare = '';
  for (const ch of part) {
    const t = TONED_VOWELS[ch];
    bare += (t ? t[0] : ch);
  }
  bare = bare.toLowerCase().replace(/v/g, 'ü');

  const starts = [0];
  let i = 0;
  while (i < bare.length) {
    let initLen = 0;
    for (const init of INITIALS) {
      if (bare.startsWith(init, i)) { initLen = init.length; break; }
    }
    let finLen = 0;
    for (const fin of FINALS) {
      if (bare.startsWith(fin, i + initLen)) { finLen = fin.length; break; }
    }
    if (initLen + finLen === 0) {
      // unknown char — skip one and treat what we have so far as a syllable
      i += 1;
      if (i < bare.length && starts[starts.length - 1] !== i) starts.push(i);
      continue;
    }
    i += initLen + finLen;
    if (i < bare.length) starts.push(i);
  }

  const out = [];
  for (let k = 0; k < starts.length; k++) {
    const a = starts[k];
    const b = (k + 1 < starts.length) ? starts[k + 1] : part.length;
    const seg = part.slice(a, b);
    if (seg) out.push(seg);
  }
  return out;
}
