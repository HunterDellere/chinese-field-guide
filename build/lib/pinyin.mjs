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
  if (!pinyin) return [];
  const parts = String(pinyin)
    .replace(/[·’'\-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const syllables = [];
  for (const part of parts) {
    // A single "part" may still be multiple syllables glued together
    // ("chádào", "Zhōngguó"). We split by detecting tone marks: each toned
    // vowel ends a syllable. If no tone marks exist, treat as one syllable.
    const segments = splitByToneMarks(part);
    for (const seg of segments) {
      const num = syllableToNumeric(seg);
      if (num) syllables.push(num);
    }
  }
  return syllables;
}

function splitByToneMarks(s) {
  // Walk char by char; whenever we encounter a toned vowel, that vowel ends
  // the current syllable. Untoned trailing characters (like 'n', 'ng') after
  // the toned vowel still belong to the same syllable until the next vowel.
  // Simple heuristic: split after a toned vowel + any trailing consonants
  // (n, ng, r) before the next vowel.
  const out = [];
  let buf = '';
  let sawTone = false;

  const isVowel = ch => /[aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/i.test(ch);
  const isToned = ch => TONED_VOWELS[ch] !== undefined;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (sawTone && isVowel(ch)) {
      // start of next syllable
      out.push(buf);
      buf = ch;
      sawTone = isToned(ch);
      continue;
    }
    buf += ch;
    if (isToned(ch)) sawTone = true;
  }
  if (buf) out.push(buf);
  // Filter empty / pure-punctuation
  return out.filter(seg => /[a-zA-ZāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüÜ]/.test(seg));
}
