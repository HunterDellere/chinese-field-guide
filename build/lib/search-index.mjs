/**
 * Build a weighted inverted index from entries.
 *
 * Each token maps to an array of [path, score] tuples, where score reflects
 * which fields the token appeared in. Fields are weighted:
 *
 *   char       × 60
 *   pinyin     × 25
 *   title      × 15
 *   tags       × 10
 *   desc       ×  6
 *   category   ×  4
 *   body       ×  1  (prose text from content bodies, tokenized coarsely)
 *
 * Tokens include:
 *   - Lowercased ASCII words (length ≥ 2)
 *   - Latin tokens with diacritics normalised (xīn → xin) — indexed under both
 *   - Single-character Chinese glyphs (length 1 allowed for CJK)
 *   - Multi-character Chinese phrases (up to 4-char chunks)
 *   - Special synthetic tokens: "hsk1", "hsk2" ... "hsk6" so HSK filters work
 *
 * CJK is not whitespace-separated, so we handle it specially: every CJK run in
 * the title/char field is kept whole AND exploded into every 2-char substring
 * (for sub-phrase search like 阴阳 → 阴, 阳, 阴阳).
 */

const HZ = /[\u4e00-\u9fff]/;
const CJK_ONLY = /^[\u4e00-\u9fff]+$/;
const STOPWORDS = new Set([
  'the','and','for','with','from','that','this','into','onto','over','under','when',
  'what','where','which','whose','there','their','they','them','these','those','about',
  'have','has','had','will','would','could','should','been','being','some','such','than',
  'then','also','very','just','only','more','most','much','many','any','all','but','not',
  'are','was','were','one','two','three','out','can','may','via','per','let','its',
  // Short function words (2–3 chars)
  'of','to','in','it','is','as','on','or','by','an','at','be','he','we','so','if',
  'do','up','no','us','my','our','who','way','see','how','now','use','way','his','her',
  'him','she','she','too','off','own','yet','why','say','new','old','get','got','let',
  'you','was','had','are','nor','for','day'
]);

function normalize(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function* splitFieldTokens(text) {
  if (!text) return;
  const raw = String(text);
  // 1. Extract Latin/Arabic-digit words
  const latin = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[·—–,;:!?()[\]{}'"\/\\.]/g, ' ')
    .split(/\s+/)
    .filter(t => t && t.length >= 2 && !STOPWORDS.has(t) && !HZ.test(t));
  for (const t of latin) yield t;

  // 2. Extract CJK runs and, for runs >1, every 1- and 2-char substring
  const cjkRuns = raw.match(/[\u4e00-\u9fff]+/g) || [];
  for (const run of cjkRuns) {
    // Whole run (e.g. 阴阳)
    yield run;
    // All single characters (e.g. 阴, 阳)
    for (const ch of run) yield ch;
    // 2-char substrings (only for 3+ char runs)
    if (run.length >= 3) {
      for (let i = 0; i + 2 <= run.length; i++) yield run.slice(i, i + 2);
    }
  }
}

function hskTokens(hsk) {
  if (hsk == null) return [];
  if (typeof hsk === 'number') return [`hsk${hsk}`, `hsk${hsk}+`];
  if (typeof hsk === 'object' && hsk.from && hsk.to) {
    const out = [];
    for (let n = hsk.from; n <= hsk.to; n++) out.push(`hsk${n}`, `hsk${n}+`);
    return out;
  }
  return [];
}

export function buildSearchIndex(entries, bodies = {}) {
  // index: { token -> Map<path, score> }
  const index = new Map();

  function add(token, path, weight) {
    if (!token) return;
    let pathScores = index.get(token);
    if (!pathScores) {
      pathScores = new Map();
      index.set(token, pathScores);
    }
    pathScores.set(path, (pathScores.get(path) || 0) + weight);
  }

  const FIELD_WEIGHT = {
    char: 60,
    pinyin: 25,
    title: 15,
    tags: 10,
    desc: 6,
    category: 4,
    type: 3,
    body: 1,
  };

  for (const entry of entries) {
    if (entry.status !== 'complete') continue;
    const path = entry.path;

    // char is special — also add under itself (1-char CJK)
    if (entry.char) {
      for (const t of splitFieldTokens(entry.char)) add(t, path, FIELD_WEIGHT.char);
      // Also add the bare character literally even if it's a single CJK glyph
      add(entry.char, path, FIELD_WEIGHT.char);
    }

    if (entry.pinyin) {
      for (const t of splitFieldTokens(entry.pinyin)) add(t, path, FIELD_WEIGHT.pinyin);
    }

    if (entry.title) {
      for (const t of splitFieldTokens(entry.title)) add(t, path, FIELD_WEIGHT.title);
    }

    if (entry.desc) {
      for (const t of splitFieldTokens(entry.desc)) add(t, path, FIELD_WEIGHT.desc);
    }

    if (entry.category) add(entry.category, path, FIELD_WEIGHT.category);
    if (entry.type) add(entry.type, path, FIELD_WEIGHT.type);

    // Slug from the filename (strip topic_, remove CJK part)
    const fname = path.split('/').pop().replace(/\.html$/, '');
    const slugBase = fname.replace(/^topic_/, '').split('_')[0];
    if (slugBase && /^[a-z0-9]+$/i.test(slugBase)) {
      add(normalize(slugBase), path, FIELD_WEIGHT.title);
    }

    if (Array.isArray(entry.tags)) {
      for (const tag of entry.tags) {
        add(normalize(tag), path, FIELD_WEIGHT.tags);
      }
    }

    for (const hskTok of hskTokens(entry.hsk)) add(hskTok, path, FIELD_WEIGHT.tags);

    // Body prose, if supplied
    const body = bodies[path];
    if (body) {
      for (const t of splitFieldTokens(body)) add(t, path, FIELD_WEIGHT.body);
    }
  }

  // Materialise: { token: [[path, score], ...] } sorted by score desc.
  // Cap each posting list at MAX_POSTINGS so the index stays compact — we
  // never display more than a handful of results per category, and any token
  // that genuinely matches hundreds of entries is too generic to be useful.
  const MAX_POSTINGS = 40;
  const out = {};
  for (const [token, pathScores] of index) {
    const arr = Array.from(pathScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_POSTINGS);
    out[token] = arr;
  }

  return out;
}
