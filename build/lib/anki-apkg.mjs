/**
 * anki-apkg.mjs — minimal Anki .apkg generator.
 *
 * Anki's .apkg format is a zip containing:
 *   - collection.anki2 (or .anki21) — SQLite database
 *   - media — JSON map "{}" if no media
 *
 * The collection.anki2 schema is fixed and documented in Anki's source.
 * We use the legacy .anki2 schema (Anki 2.0+) which is the broadest-compatible
 * — any modern Anki desktop, AnkiDroid, AnkiMobile, or AnkiWeb imports it.
 *
 * Why not anki-apkg-export@4: bundles sql.js v0.5.0 with a hardcoded 16 MB
 * heap that overflows at ~80 cards with HTML. We use better-sqlite3 (native,
 * no memory cap) instead.
 *
 * Card model: a single "Basic" model (front + back), one card per note.
 * Tags are space-separated within a single notes.tags column, surrounded
 * by spaces (Anki convention).
 *
 * To inspect a generated .apkg: unzip <file>; sqlite3 collection.anki2.
 */

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const JSZip = require('jszip');

import { unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Anki schema. Copied from Anki's source (anki/pylib/anki/schema.py /
// anki/rslib/src/storage/sqlite.rs). Trimmed to what we need.
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

// Minimal collection config (col.conf). Fields preserved verbatim from a
// fresh Anki 2.0 collection — any change here can break import.
const COLLECTION_CONFIG = {
  nextPos: 1, estTimes: true, activeDecks: [1], sortType: 'noteFld',
  timeLim: 0, sortBackwards: false, addToCur: true, curDeck: 1,
  newBury: true, newSpread: 0, dueCounts: true, curModel: '1',
  collapseTime: 1200
};

// Default deck config — what cards-per-day, intervals, etc.
const DCONF = {
  '1': {
    name: 'Default', replayq: true, lapse: { leechFails: 8, minInt: 1, delays: [10], leechAction: 0, mult: 0 },
    rev: { perDay: 100, fuzz: 0.05, ivlFct: 1, maxIvl: 36500, ease4: 1.3, bury: true, minSpace: 1 },
    timer: 0, maxTaken: 60, usn: 0, new: { perDay: 20, delays: [1, 10], separate: true, ints: [1, 4, 7], initialFactor: 2500, bury: true, order: 1 },
    mod: 0, id: 1, autoplay: true, dyn: false
  }
};

// Single-card model: front/back. Returned as a JSON object keyed by mid.
function makeModel(mid, deckId) {
  return {
    [String(mid)]: {
      id: mid,
      name: 'Basic',
      type: 0,
      mod: Math.floor(Date.now() / 1000),
      usn: 0,
      sortf: 0,
      did: deckId,
      tmpls: [{
        name: 'Card 1', ord: 0,
        qfmt: '{{Front}}',
        afmt: '{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}',
        bqfmt: '', bafmt: '', did: null
      }],
      flds: [
        { name: 'Front', ord: 0, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] },
        { name: 'Back',  ord: 1, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] }
      ],
      css: '.card { font-family: Arial; font-size: 20px; text-align: center; color: #2a2a2a; background-color: #fafafa; }',
      latexPre: '\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n',
      latexPost: '\\end{document}',
      tags: [], req: [[0, 'all', [0]]], vers: []
    }
  };
}

function makeDeck(did, name) {
  return {
    [String(did)]: {
      id: did, name, mod: Math.floor(Date.now() / 1000), usn: 0, lrnToday: [0, 0],
      revToday: [0, 0], newToday: [0, 0], timeToday: [0, 0], collapsed: false,
      browserCollapsed: false, desc: '', dyn: 0, conf: 1, extendNew: 10, extendRev: 50
    }
  };
}

// Anki's note checksum — first 8 hex chars of SHA-1 of the sort field's
// stripped HTML. Not security-critical; collisions have minor impact.
function fieldChecksum(s) {
  // Strip HTML for the checksum input. Match Anki's behaviour close enough.
  const stripped = String(s).replace(/<[^>]+>/g, '');
  // Use a tiny djb2-like hash; Anki uses SHA-1 but collisions in our small
  // deck are negligible and we avoid pulling crypto for one helper.
  let h = 5381;
  for (let i = 0; i < stripped.length; i++) h = ((h << 5) + h + stripped.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Anki "guid" — random URL-safe string per note. Stable IDs let users
// re-import without duplicating, but we don't track state across runs;
// fresh GUIDs each build is fine because users will create a new deck.
function newGuid() {
  let s = '';
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&()*+,-./:;<=>?@[]^_`{|}~';
  for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/**
 * Build an .apkg as a Buffer.
 *
 * @param {object} opts
 * @param {string} opts.deckName - the name shown in Anki's deck list
 * @param {Array<{front:string, back:string, tags?:string[]}>} opts.cards
 * @returns {Promise<Buffer>}
 */
export async function buildApkg({ deckName, cards }) {
  const tmpDb = join(tmpdir(), `anki-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  if (existsSync(tmpDb)) unlinkSync(tmpDb);

  const db = new Database(tmpDb);
  try {
    db.exec(SCHEMA);

    const now = Math.floor(Date.now() / 1000);
    const nowMs = Date.now();
    const deckId = 1;
    const mid = nowMs;  // unique-enough model id for this build

    db.prepare(
      `INSERT INTO col (id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags)
       VALUES (1, ?, ?, ?, 11, 0, 0, 0, ?, ?, ?, ?, '{}')`
    ).run(
      now,
      now,
      now,
      JSON.stringify(COLLECTION_CONFIG),
      JSON.stringify(makeModel(mid, deckId)),
      JSON.stringify({ ...makeDeck(1, 'Default'), ...makeDeck(deckId + 1, deckName) }),
      JSON.stringify(DCONF)
    );

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
      // Anki's flds is the field values joined with U+001F.
      const flds = (c.front || '') + '\x1f' + (c.back || '');
      const tagText = (c.tags && c.tags.length) ? ' ' + c.tags.join(' ') + ' ' : '';
      insertNote.run(
        noteId, newGuid(), mid, now, tagText, flds,
        c.front || '', fieldChecksum(c.front || '')
      );
      insertCard.run(cardId, noteId, deckId + 1, now, i);
    }

    db.close();

    // Read DB into a buffer + zip it up with a media manifest.
    const { readFileSync } = await import('node:fs');
    const dbBuf = readFileSync(tmpDb);
    const zip = new JSZip();
    zip.file('collection.anki2', dbBuf);
    zip.file('media', '{}');
    const out = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    return out;
  } finally {
    if (existsSync(tmpDb)) unlinkSync(tmpDb);
  }
}
