/**
 * anki-apkg-browser.mjs — in-browser .apkg builder for the custom export
 * deck-builder UI.
 *
 * Mirrors build/lib/anki-apkg.mjs (the Node/better-sqlite3 build-time
 * version) byte-for-byte at the schema/config/model level so the .apkg
 * files generated client-side are interchangeable with the pre-built
 * server-side ones. Only the SQL driver differs:
 *   - Node version: better-sqlite3 (native binding)
 *   - Browser version: sql.js (WASM, lazy-loaded on first use)
 *
 * The whole module is loaded via dynamic import() from exports.js so
 * sql.js + jszip never enter the page weight unless the user clicks
 * "Build Anki .apkg" in the custom builder.
 *
 * Inspect a generated .apkg locally: unzip <file>; sqlite3 collection.anki2
 */

// Pinned versions for reproducibility. CDN is jsdelivr (npm-backed).
const SQLJS_URL = 'https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/sql-wasm.js';
const SQLJS_WASM = 'https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/sql-wasm.wasm';
const JSZIP_URL = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';

let sqlJsModule = null;
let JSZipCtor = null;

async function loadScript(url) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load ' + url));
    document.head.appendChild(s);
  });
}

async function ensureSqlJs() {
  if (sqlJsModule) return sqlJsModule;
  if (typeof window.initSqlJs !== 'function') {
    await loadScript(SQLJS_URL);
  }
  sqlJsModule = await window.initSqlJs({ locateFile: () => SQLJS_WASM });
  return sqlJsModule;
}

export async function ensureJSZip() {
  if (JSZipCtor) return JSZipCtor;
  if (typeof window.JSZip !== 'function') {
    await loadScript(JSZIP_URL);
  }
  JSZipCtor = window.JSZip;
  return JSZipCtor;
}

// Schema: copied from build/lib/anki-apkg.mjs. Must stay in sync — both
// versions write the same table shape so generated .apkg files import
// identically into Anki.
const SCHEMA = `
CREATE TABLE col (
    id              integer PRIMARY KEY,
    crt             integer NOT NULL,
    mod             integer NOT NULL,
    scm             integer NOT NULL,
    ver             integer NOT NULL,
    dty             integer NOT NULL,
    usn             integer NOT NULL,
    ls              integer NOT NULL,
    conf            text NOT NULL,
    models          text NOT NULL,
    decks           text NOT NULL,
    dconf           text NOT NULL,
    tags            text NOT NULL
);
CREATE TABLE notes (
    id              integer PRIMARY KEY,
    guid            text NOT NULL,
    mid             integer NOT NULL,
    mod             integer NOT NULL,
    usn             integer NOT NULL,
    tags            text NOT NULL,
    flds            text NOT NULL,
    sfld            integer NOT NULL,
    csum            integer NOT NULL,
    flags           integer NOT NULL,
    data            text NOT NULL
);
CREATE TABLE cards (
    id              integer PRIMARY KEY,
    nid             integer NOT NULL,
    did             integer NOT NULL,
    ord             integer NOT NULL,
    mod             integer NOT NULL,
    usn             integer NOT NULL,
    type            integer NOT NULL,
    queue           integer NOT NULL,
    due             integer NOT NULL,
    ivl             integer NOT NULL,
    factor          integer NOT NULL,
    reps            integer NOT NULL,
    lapses          integer NOT NULL,
    left            integer NOT NULL,
    odue            integer NOT NULL,
    odid            integer NOT NULL,
    flags           integer NOT NULL,
    data            text NOT NULL
);
CREATE TABLE revlog (
    id              integer PRIMARY KEY,
    cid             integer NOT NULL,
    usn             integer NOT NULL,
    ease            integer NOT NULL,
    ivl             integer NOT NULL,
    lastIvl         integer NOT NULL,
    factor          integer NOT NULL,
    time            integer NOT NULL,
    type            integer NOT NULL
);
CREATE TABLE graves (
    usn             integer NOT NULL,
    oid             integer NOT NULL,
    type            integer NOT NULL
);
CREATE INDEX ix_notes_usn ON notes (usn);
CREATE INDEX ix_cards_usn ON cards (usn);
CREATE INDEX ix_revlog_usn ON revlog (usn);
CREATE INDEX ix_cards_nid ON cards (nid);
CREATE INDEX ix_cards_sched ON cards (did, queue, due);
CREATE INDEX ix_revlog_cid ON revlog (cid);
CREATE INDEX ix_notes_csum ON notes (csum);
`;

const COLLECTION_CONFIG = {
  nextPos: 1, estTimes: true, activeDecks: [1], sortType: 'noteFld',
  timeLim: 0, sortBackwards: false, addToCur: true, curDeck: 1,
  newBury: true, newSpread: 0, dueCounts: true, curModel: '1',
  collapseTime: 1200,
};

const DCONF = {
  '1': {
    name: 'Default', replayq: true, lapse: { leechFails: 8, minInt: 1, delays: [10], leechAction: 0, mult: 0 },
    rev: { perDay: 100, fuzz: 0.05, ivlFct: 1, maxIvl: 36500, ease4: 1.3, bury: true, minSpace: 1 },
    timer: 0, maxTaken: 60, usn: 0, new: { perDay: 20, delays: [1, 10], separate: true, ints: [1, 4, 7], initialFactor: 2500, bury: true, order: 1 },
    mod: 0, id: 1, autoplay: true, dyn: false,
  },
};

function makeModel(mid, deckId) {
  return {
    [String(mid)]: {
      id: mid, name: 'Basic', type: 0,
      mod: Math.floor(Date.now() / 1000), usn: 0, sortf: 0, did: deckId,
      tmpls: [{
        name: 'Card 1', ord: 0,
        qfmt: '{{Front}}',
        afmt: '{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}',
        bqfmt: '', bafmt: '', did: null,
      }],
      flds: [
        { name: 'Front', ord: 0, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] },
        { name: 'Back',  ord: 1, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] },
      ],
      css: '.card { font-family: Arial; font-size: 20px; text-align: center; color: #2a2a2a; background-color: #fafafa; }',
      latexPre: '\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n',
      latexPost: '\\end{document}',
      tags: [], req: [[0, 'all', [0]]], vers: [],
    },
  };
}

function makeDeck(did, name) {
  return {
    [String(did)]: {
      id: did, name, mod: Math.floor(Date.now() / 1000), usn: 0,
      lrnToday: [0, 0], revToday: [0, 0], newToday: [0, 0], timeToday: [0, 0],
      collapsed: false, browserCollapsed: false, desc: '', dyn: 0, conf: 1,
      extendNew: 10, extendRev: 50,
    },
  };
}

function fieldChecksum(s) {
  const stripped = String(s).replace(/<[^>]+>/g, '');
  let h = 5381;
  for (let i = 0; i < stripped.length; i++) h = ((h << 5) + h + stripped.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function newGuid() {
  let s = '';
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&()*+,-./:;<=>?@[]^_`{|}~';
  for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Card-back formatters mirror build/build-exports.mjs so client-built decks
// look the same as pre-built ones when imported into Anki.
function backCharacter(c) {
  return [
    `<div style="font-family:monospace;color:#a06428;font-size:18px;">${escapeHtml(c.p)}</div>`,
    c.e ? `<div style="margin:8px 0 4px;font-weight:600;">${escapeHtml(c.e)}</div>` : '',
    c.d ? `<div style="font-style:italic;color:#5c3821;">${escapeHtml(c.d)}</div>` : '',
    `<div style="margin-top:10px;font-size:12px;color:#888;">` +
      [c.hsk ? `HSK ${c.hsk}` : '', c.r ? `radical ${c.r}` : ''].filter(Boolean).join(' · ') +
    `</div>`,
  ].filter(Boolean).join('');
}
function backVocab(c) {
  return [
    `<div style="font-family:monospace;color:#a06428;font-size:18px;">${escapeHtml(c.p)}</div>`,
    c.e ? `<div style="margin:8px 0 4px;font-weight:600;">${escapeHtml(c.e)}</div>` : '',
    c.d ? `<div style="font-style:italic;color:#5c3821;">${escapeHtml(c.d)}</div>` : '',
    c.hsk ? `<div style="margin-top:10px;font-size:12px;color:#888;">HSK ${c.hsk}</div>` : '',
  ].filter(Boolean).join('');
}
function backChengyu(c) {
  return [
    `<div style="font-family:monospace;color:#a06428;font-size:18px;">${escapeHtml(c.p)}</div>`,
    c.e ? `<div style="margin:8px 0 4px;font-weight:600;">${escapeHtml(c.e)}</div>` : '',
    c.d ? `<div style="font-style:italic;color:#5c3821;">${escapeHtml(c.d)}</div>` : '',
  ].filter(Boolean).join('');
}

function frontFor(c) {
  return `<div style="font-size:42px;font-family:'Noto Serif SC',serif;">${escapeHtml(c.h)}</div>`;
}

function backFor(c) {
  if (c.t === 'character') return backCharacter(c);
  if (c.t === 'chengyu')   return backChengyu(c);
  return backVocab(c);
}

/**
 * Build an .apkg in the browser as a Blob.
 *
 * @param {string} deckName
 * @param {Array<{h:string, p:string, e?:string, d?:string, t:string, hsk?:number, r?:string, tags?:string[]}>} cards
 *        — the trimmed shape from data/exports/cards.json
 * @param {string[]} extraTags optional tags applied to every card (e.g.
 *        ['custom-build', 'hsk-1-3']) so the imported deck is filterable
 *        in Anki by where it came from
 * @returns {Promise<Blob>}
 */
export async function buildApkgInBrowser({ deckName, cards, extraTags = [] }) {
  const SQL = await ensureSqlJs();
  const JSZip = await ensureJSZip();

  const db = new SQL.Database();
  db.exec(SCHEMA);

  const now = Math.floor(Date.now() / 1000);
  const nowMs = Date.now();
  const deckId = 1;
  const mid = nowMs;

  const colInsert = db.prepare(
    `INSERT INTO col (id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags)
     VALUES (1, ?, ?, ?, 11, 0, 0, 0, ?, ?, ?, ?, '{}')`
  );
  colInsert.run([
    now, now, now,
    JSON.stringify(COLLECTION_CONFIG),
    JSON.stringify(makeModel(mid, deckId)),
    JSON.stringify({ ...makeDeck(1, 'Default'), ...makeDeck(deckId + 1, deckName) }),
    JSON.stringify(DCONF),
  ]);
  colInsert.free();

  const insertNote = db.prepare(
    `INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data)
     VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, 0, '')`
  );
  const insertCard = db.prepare(
    `INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data)
     VALUES (?, ?, ?, 0, ?, 0, 0, 0, ?, 0, 0, 0, 0, 0, 0, 0, 0, '')`
  );

  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const noteId = nowMs + i + 1;
    const cardId = noteId + 1_000_000;
    const front = frontFor(c);
    const back = backFor(c);
    const flds = front + '\x1f' + back;
    const allTags = [...(c.tags || []), c.t, ...extraTags]
      .filter(t => t && /^[\w-]+$/.test(t));
    const tagText = allTags.length ? ' ' + [...new Set(allTags)].join(' ') + ' ' : '';
    insertNote.run([noteId, newGuid(), mid, now, tagText, flds, front, fieldChecksum(front)]);
    insertCard.run([cardId, noteId, deckId + 1, now, i]);
  }
  insertNote.free();
  insertCard.free();

  const dbBytes = db.export();
  db.close();

  const zip = new JSZip();
  zip.file('collection.anki2', dbBytes);
  zip.file('media', '{}');
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

/** Trigger a browser download of a Blob with the given filename. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

/**
 * Build a Pleco TSV string from the same trimmed card shape. Matches the
 * format build-exports.mjs writes for Pleco files — three TAB-separated
 * columns, one card per line, no header.
 */
export function buildPlecoTsv(cards) {
  return cards
    .filter(c => c.h && c.p)
    .map(c => {
      const def = [c.e, c.d].filter(Boolean).join(' — ').replace(/\s+/g, ' ').trim();
      const esc = (s) => String(s || '').replace(/[\t\r\n]/g, ' ').replace(/\s+/g, ' ').trim();
      return `${esc(c.h)}\t${esc(c.p)}\t${esc(def)}`;
    })
    .join('\n') + '\n';
}
