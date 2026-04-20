/**
 * Build a weighted inverted index from entries.
 *
 * Output shape: { paths: string[], index: { token: [[pathId, score], ...] } }
 * where pathId is an integer index into the `paths` array. This keeps the
 * on-disk JSON small: repeated full HTML paths in postings collapse to ints.
 *
 * Field weights:
 *
 *   char       × 60
 *   pinyin     × 25
 *   title      × 15
 *   tags       × 10
 *   desc       ×  6
 *   category   ×  4
 *   body       ×  1  (prose text, tokenised conservatively — no 2-gram explosion)
 *
 * CJK n-gram rules:
 *   - `char` / `title` / `tags`: index full runs, every 1-char, and every 2-char
 *     substring (for sub-phrase search like 阴阳 → 阴, 阳, 阴阳).
 *   - `desc` / `body`: index full run and every 1-char only. Body prose sentences
 *     produce useless noise when exploded into 2-grams, so we skip it. Runs over
 *     12 chars are also skipped whole (prose sentences, not searchable phrases).
 */

const HZ = /[\u4e00-\u9fff]/;
const STOPWORDS = new Set([
  'the','and','for','with','from','that','this','into','onto','over','under','when',
  'what','where','which','whose','there','their','they','them','these','those','about',
  'have','has','had','will','would','could','should','been','being','some','such','than',
  'then','also','very','just','only','more','most','much','many','any','all','but','not',
  'are','was','were','one','two','three','out','can','may','via','per','let','its',
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

function* latinTokens(text) {
  if (!text) return;
  const tokens = String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[·—–,;:!?()[\]{}'"\/\\.]/g, ' ')
    .split(/\s+/)
    .filter(t => t && t.length >= 2 && !STOPWORDS.has(t) && !HZ.test(t));
  for (const t of tokens) yield t;
}

function* cjkTokensRich(text) {
  // Full-run + 1-gram + 2-gram. Use for char/title/tags.
  const runs = String(text || '').match(/[\u4e00-\u9fff]+/g) || [];
  for (const run of runs) {
    yield run;
    for (const ch of run) yield ch;
    if (run.length >= 3) {
      for (let i = 0; i + 2 <= run.length; i++) yield run.slice(i, i + 2);
    }
  }
}

function* cjkTokensLean(text) {
  // Full-run + 1-gram only. Use for desc. Skip long runs (prose sentences).
  const runs = String(text || '').match(/[\u4e00-\u9fff]+/g) || [];
  for (const run of runs) {
    if (run.length <= 12) yield run;
    for (const ch of run) yield ch;
  }
}

function* cjkTokensBody(text) {
  // Body prose: only short runs (≤4 chars, i.e. words/phrases, not sentences).
  // Single chars not emitted — too noisy, and every character on a page
  // appears in the char/title field anyway.
  const runs = String(text || '').match(/[\u4e00-\u9fff]+/g) || [];
  for (const run of runs) {
    if (run.length <= 4) yield run;
  }
}

function* latinTokensBody(text) {
  // Body Latin: require length ≥ 4 to keep out "and/the/was/etc"-tier filler.
  for (const t of latinTokens(text)) {
    if (t.length >= 4) yield t;
  }
}

function* fieldTokensRich(text) {
  yield* latinTokens(text);
  yield* cjkTokensRich(text);
}

function* fieldTokensLean(text) {
  yield* latinTokens(text);
  yield* cjkTokensLean(text);
}

function* fieldTokensBody(text) {
  yield* latinTokensBody(text);
  yield* cjkTokensBody(text);
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
  // Assign integer IDs to every complete entry path.
  const paths = [];
  const pathToId = new Map();
  for (const entry of entries) {
    if (entry.status !== 'complete') continue;
    pathToId.set(entry.path, paths.length);
    paths.push(entry.path);
  }

  // index: { token -> Map<pathId, score> }
  const index = new Map();

  function add(token, pathId, weight) {
    if (!token) return;
    let scores = index.get(token);
    if (!scores) {
      scores = new Map();
      index.set(token, scores);
    }
    scores.set(pathId, (scores.get(pathId) || 0) + weight);
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
    const pathId = pathToId.get(entry.path);

    if (entry.char) {
      for (const t of fieldTokensRich(entry.char)) add(t, pathId, FIELD_WEIGHT.char);
      add(entry.char, pathId, FIELD_WEIGHT.char);
    }

    if (entry.pinyin) {
      for (const t of fieldTokensRich(entry.pinyin)) add(t, pathId, FIELD_WEIGHT.pinyin);
    }

    if (entry.title) {
      for (const t of fieldTokensRich(entry.title)) add(t, pathId, FIELD_WEIGHT.title);
    }

    if (entry.desc) {
      for (const t of fieldTokensLean(entry.desc)) add(t, pathId, FIELD_WEIGHT.desc);
    }

    if (entry.category) add(entry.category, pathId, FIELD_WEIGHT.category);
    if (entry.type) add(entry.type, pathId, FIELD_WEIGHT.type);

    const fname = entry.path.split('/').pop().replace(/\.html$/, '');
    const slugBase = fname.replace(/^topic_/, '').split('_')[0];
    if (slugBase && /^[a-z0-9]+$/i.test(slugBase)) {
      add(normalize(slugBase), pathId, FIELD_WEIGHT.title);
    }

    if (Array.isArray(entry.tags)) {
      for (const tag of entry.tags) {
        for (const t of fieldTokensRich(tag)) add(t, pathId, FIELD_WEIGHT.tags);
        add(normalize(tag), pathId, FIELD_WEIGHT.tags);
      }
    }

    for (const hskTok of hskTokens(entry.hsk)) add(hskTok, pathId, FIELD_WEIGHT.tags);

    const body = bodies[entry.path];
    if (body) {
      for (const t of fieldTokensBody(body)) add(t, pathId, FIELD_WEIGHT.body);
    }
  }

  const MAX_POSTINGS = 40;
  const outIndex = {};
  for (const [token, scores] of index) {
    const arr = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_POSTINGS);
    outIndex[token] = arr;
  }

  return { paths, index: outIndex };
}
