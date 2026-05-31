/* page-export.js — per-page "Add to Pleco / Anki" buttons.
 *
 * Loaded on every content page via the layout. Looks up the page's metadata
 * (from the doctype-comment JSON the build emits) plus the title, hero CN
 * glyph, hero pinyin, and hero English, and offers two single-card
 * downloads:
 *
 *   • Pleco — a one-line .txt (simplified TAB pinyin TAB definition)
 *     ready for Pleco's Custom Card import.
 *   • Anki — a one-line .tsv (Hanzi TAB Pinyin TAB English) ready for
 *     Anki's File → Import.
 *
 * For users who want a styled .apkg deck, the buttons also link to the
 * bulk /pages/exports/ page where the per-type .apkg files live.
 */
(function () {
  'use strict';
  if (window.__pageExportInit) return;
  window.__pageExportInit = true;

  // ── Metadata extraction ────────────────────────────────────────────────
  // Pull the page's metadata JSON (emitted by the build as a comment after
  // <!DOCTYPE html>). Match the build's allowlist: only export character,
  // vocab, chengyu pages — others don't have a clean atomic-card semantics.
  function readMeta() {
    var doc = document.documentElement;
    var prev = doc.previousSibling;
    if (!prev || prev.nodeType !== 8) return null;
    try { return JSON.parse(prev.data); } catch (e) { return null; }
  }

  function isExportable(meta) {
    if (!meta) return false;
    if (meta.status !== 'complete') return false;
    if (meta.type === 'character') return true;
    if (meta.type === 'vocab' && meta.category === 'vocab') return true;
    if (meta.category === 'chengyu') return true;
    return false;
  }

  // ── Pull display fields from the hero ──────────────────────────────────
  function textOf(sel) {
    var el = document.querySelector(sel);
    return el ? (el.textContent || '').trim() : '';
  }

  function readCard() {
    var heroCn   = textOf('.hero-glyph') || textOf('.topic-hero-title') || '';
    var hanzi    = (heroCn.match(/[一-鿿㐀-䶿]+/g) || []).join('');
    var pinyin   = textOf('.hero-pinyin') || textOf('.topic-hero-title-py') || '';
    // English gloss: prefer .hero-en (character), else hero-desc as a fallback.
    var english  = textOf('.hero-en') || '';
    var desc     = textOf('.topic-hero-desc') || textOf('p.topic-hero-desc') || '';
    return { hanzi: hanzi, pinyin: pinyin.replace(/\s+/g, ' ').trim(), english: english, desc: desc };
  }

  // ── Download helpers ───────────────────────────────────────────────────
  function tsvField(s) {
    return String(s == null ? '' : s).replace(/[\t\r\n]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function download(filename, text) {
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
  }

  // Pleco renders pinyin per-syllable (tone colors, audio). Multi-syllable
  // hero pinyin like "bǐjiào" arrives as one token from the page header;
  // expand it to "bǐ jiào" before emitting. Mirrors splitToSyllables in
  // build/lib/pinyin.mjs.
  var TONED_VOWELS = { 'ā':'a','á':'a','ǎ':'a','à':'a','ē':'e','é':'e','ě':'e','è':'e','ī':'i','í':'i','ǐ':'i','ì':'i','ō':'o','ó':'o','ǒ':'o','ò':'o','ū':'u','ú':'u','ǔ':'u','ù':'u','ǖ':'ü','ǘ':'ü','ǚ':'ü','ǜ':'ü' };
  var FINALS = ['iong','iang','uang','ueng','iao','iou','uai','uei','üan','ian','uan','ang','eng','ing','ong','üe','ün','ai','ei','ao','ou','an','en','ia','ie','in','iu','ua','uo','ui','un','er','a','o','e','i','u','ü','m','n'];
  var INITIALS = ['zh','ch','sh','b','p','m','f','d','t','n','l','g','k','h','j','q','x','r','z','c','s','y','w'];

  function splitSyllables(pinyin) {
    if (!pinyin) return [];
    var parts = String(pinyin).replace(/[·’'\-]/g, ' ').split(/\s+/).filter(Boolean);
    var out = [];
    for (var p = 0; p < parts.length; p++) {
      var part = parts[p];
      var bare = '';
      for (var i = 0; i < part.length; i++) {
        var c = part.charAt(i);
        bare += (TONED_VOWELS[c] || c);
      }
      bare = bare.toLowerCase().replace(/v/g, 'ü');
      var starts = [0];
      var idx = 0;
      while (idx < bare.length) {
        var initLen = 0;
        for (var ii = 0; ii < INITIALS.length; ii++) {
          if (bare.substr(idx, INITIALS[ii].length) === INITIALS[ii]) { initLen = INITIALS[ii].length; break; }
        }
        var finLen = 0;
        for (var fi = 0; fi < FINALS.length; fi++) {
          if (bare.substr(idx + initLen, FINALS[fi].length) === FINALS[fi]) { finLen = FINALS[fi].length; break; }
        }
        if (initLen + finLen === 0) {
          idx += 1;
          if (idx < bare.length && starts[starts.length - 1] !== idx) starts.push(idx);
          continue;
        }
        idx += initLen + finLen;
        if (idx < bare.length) starts.push(idx);
      }
      for (var k = 0; k < starts.length; k++) {
        var a = starts[k];
        var b = (k + 1 < starts.length) ? starts[k + 1] : part.length;
        var seg = part.slice(a, b);
        if (seg) out.push(seg);
      }
    }
    return out;
  }

  function plecoPinyin(p) {
    var syl = splitSyllables(p);
    return syl.length ? syl.join(' ') : String(p || '');
  }

  function plecoLine(card) {
    var defParts = [];
    if (card.english) defParts.push(card.english);
    if (card.desc) defParts.push(card.desc);
    return tsvField(card.hanzi) + '\t' + tsvField(plecoPinyin(card.pinyin)) + '\t' + tsvField(defParts.join(' — '));
  }

  function ankiLine(card) {
    return '#fields:Hanzi\tPinyin\tEnglish\tNotes\n' +
      tsvField(card.hanzi) + '\t' + tsvField(card.pinyin) + '\t' + tsvField(card.english) + '\t' + tsvField(card.desc);
  }

  // ── UI injection ───────────────────────────────────────────────────────
  function buildButtons(card) {
    var fname = card.hanzi || 'entry';
    var wrap = document.createElement('div');
    wrap.className = 'page-export';
    wrap.innerHTML =
      '<span class="page-export-label">Save</span>' +
      '<button type="button" class="page-export-btn" data-export="pleco">' +
        '<span class="pe-cn">百</span> <span class="pe-en">Pleco</span>' +
      '</button>' +
      '<button type="button" class="page-export-btn" data-export="anki">' +
        '<span class="pe-cn">记</span> <span class="pe-en">Anki TSV</span>' +
      '</button>' +
      '<a class="page-export-link" href="/pages/exports/" title="More export options">all →</a>';

    wrap.querySelector('[data-export="pleco"]').addEventListener('click', function () {
      // Pleco files imported cards under the //Category line that precedes
      // them, so single-card downloads land in the right folder instead of
      // Pleco's default catch-all.
      var meta = readMeta() || {};
      var sub = meta.type === 'character' ? 'Characters'
              : (meta.category === 'chengyu' ? 'Chengyu' : 'Vocabulary');
      var header = '//角落書屋/' + sub + '\n';
      download('jiaoshu-' + fname + '.pleco.txt', header + plecoLine(card) + '\n');
    });
    wrap.querySelector('[data-export="anki"]').addEventListener('click', function () {
      download('jiaoshu-' + fname + '.anki.tsv', ankiLine(card) + '\n');
    });
    return wrap;
  }

  // Place the export controls at the bottom of the page, just before the
  // .page-footer. Readers reach them after engaging with the entry, when
  // saving to Pleco/Anki feels like a natural next step rather than chrome
  // crowding the hero. Falls back to appending to .main if no footer.
  function inject() {
    var meta = readMeta();
    if (!isExportable(meta)) return;
    if (document.querySelector('.page-export')) return; // idempotent
    var card = readCard();
    if (!card.hanzi || !card.pinyin) return; // missing data — bail silently
    var wrap = buildButtons(card);
    var footer = document.querySelector('.page-footer');
    if (footer && footer.parentNode) {
      footer.parentNode.insertBefore(wrap, footer);
      return;
    }
    var main = document.querySelector('main.main');
    if (main) main.appendChild(wrap);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
