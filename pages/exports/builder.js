/* builder.js — custom deck builder for /pages/exports/.
 *
 * Pleco-first: the primary action is "Download Pleco .txt" (instant, no
 * dependencies, just text concat). Anki .apkg is a secondary action that
 * lazy-loads sql.js + jszip on first click (~700KB) and builds an .apkg
 * client-side using the same schema as build/lib/anki-apkg.mjs.
 *
 * Filter logic: AND across dimensions, OR within (faceted-search
 * convention). Ticking 'vocab' AND 'chengyu' = either type. HSK 1-3 +
 * 'family' tag = HSK 1-3 AND family-tagged.
 *
 * Data: data/exports/cards.json (one source of truth, 292 cards trimmed
 * to {h,p,e,d,t,hsk,hskI,tags,r}). Tag chip list comes from the slice
 * manifest's tag dimension so we stay aligned with the slicer's whitelist.
 */
(function () {
  'use strict';

  var BUILDER_ROOT = document.querySelector('[data-builder-root]');
  if (!BUILDER_ROOT) return;

  // ────────────────────── DOM helpers ──────────────────────

  function el(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ────────────────────── State ──────────────────────

  var STATE = {
    cards: [],          // full corpus, loaded once from cards.json
    tagChips: [],       // [{key, en}] from slice manifest, alpha-sorted
    selectedTypes: new Set(['character', 'vocab', 'chengyu', 'grammar', 'compound']),
    hskMin: 1,
    hskMax: 6,
    includeUnknownHsk: true,
    selectedTags: new Set(),  // empty = "any/no tag filter"
    tagMode: 'any',           // 'any' (OR within tags) — only mode for now
    search: '',
  };

  // ────────────────────── Filtering ──────────────────────

  function matches(card) {
    if (!STATE.selectedTypes.has(card.t)) return false;
    if (card.hsk == null) {
      if (!STATE.includeUnknownHsk) return false;
    } else {
      if (card.hsk < STATE.hskMin || card.hsk > STATE.hskMax) return false;
    }
    if (STATE.selectedTags.size > 0) {
      var ok = false;
      var cardTags = card.tags || [];
      var iter = STATE.selectedTags.values();
      var step = iter.next();
      while (!step.done) {
        if (cardTags.indexOf(step.value) >= 0) { ok = true; break; }
        step = iter.next();
      }
      if (!ok) return false;
    }
    if (STATE.search) {
      var q = STATE.search.toLowerCase();
      var hay = (card.h + ' ' + card.p + ' ' + (card.e || '') + ' ' + (card.d || '')).toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  }

  function filteredCards() {
    return STATE.cards.filter(matches);
  }

  // ────────────────────── Suggested deck-name from filters ──────────────────────

  function suggestedName() {
    var parts = [];
    var typeOrder = ['character', 'vocab', 'chengyu', 'grammar', 'compound'];
    var sel = typeOrder.filter(function (t) { return STATE.selectedTypes.has(t); });
    if (sel.length === 4) parts.push('All types');
    else parts.push(sel.map(function (t) { return t === 'character' ? 'Char' : (t.charAt(0).toUpperCase() + t.slice(1)); }).join('+'));
    if (STATE.hskMin === STATE.hskMax) parts.push('HSK ' + STATE.hskMin);
    else if (!(STATE.hskMin === 1 && STATE.hskMax === 6)) parts.push('HSK ' + STATE.hskMin + '-' + STATE.hskMax);
    if (STATE.selectedTags.size > 0) {
      var tagList = Array.from(STATE.selectedTags).slice(0, 2).join('+');
      if (STATE.selectedTags.size > 2) tagList += '+' + (STATE.selectedTags.size - 2) + 'more';
      parts.push(tagList);
    }
    if (STATE.search) parts.push('"' + STATE.search.slice(0, 16) + '"');
    return parts.join(' · ');
  }

  function suggestedSlug() {
    return suggestedName().toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'custom-deck';
  }

  // ────────────────────── Render ──────────────────────

  function renderShell() {
    BUILDER_ROOT.innerHTML = '' +
      '<div class="builder">' +
        '<div class="builder-filters">' +
          '<fieldset class="builder-fieldset">' +
            '<legend>Type</legend>' +
            '<div class="builder-checks" data-builder-types></div>' +
          '</fieldset>' +
          '<fieldset class="builder-fieldset">' +
            '<legend>HSK level</legend>' +
            '<div class="builder-hsk">' +
              '<div class="builder-hsk-range">' +
                '<select data-builder-hsk-min aria-label="HSK from">' +
                  '<option value="1">HSK 1</option><option value="2">HSK 2</option>' +
                  '<option value="3">HSK 3</option><option value="4">HSK 4</option>' +
                  '<option value="5">HSK 5</option><option value="6">HSK 6</option>' +
                '</select>' +
                '<span class="builder-hsk-arrow" aria-hidden="true">→</span>' +
                '<select data-builder-hsk-max aria-label="HSK to">' +
                  '<option value="1">HSK 1</option><option value="2">HSK 2</option>' +
                  '<option value="3">HSK 3</option><option value="4">HSK 4</option>' +
                  '<option value="5">HSK 5</option><option value="6">HSK 6</option>' +
                '</select>' +
              '</div>' +
              '<label class="builder-hsk-unknown"><input type="checkbox" data-builder-hsk-unknown checked> include unleveled cards</label>' +
            '</div>' +
          '</fieldset>' +
          '<fieldset class="builder-fieldset">' +
            '<legend>Topics</legend>' +
            '<div class="builder-tag-chips" data-builder-tags></div>' +
          '</fieldset>' +
          '<fieldset class="builder-fieldset">' +
            '<legend>Search</legend>' +
            '<input type="search" class="builder-search" data-builder-search placeholder="hanzi, pinyin, or English">' +
          '</fieldset>' +
        '</div>' +
        '<div class="builder-result">' +
          '<div class="builder-result-summary">' +
            '<span class="builder-result-count" data-builder-count>0</span>' +
            '<span class="builder-result-count-label">cards</span>' +
          '</div>' +
          '<div class="builder-result-name" data-builder-name>—</div>' +
          '<div class="builder-result-actions">' +
            '<button type="button" class="builder-btn builder-btn--pleco" data-builder-pleco disabled>Download for Pleco</button>' +
            '<button type="button" class="builder-btn builder-btn--anki" data-builder-anki disabled>Download for Anki</button>' +
          '</div>' +
          '<p class="builder-result-status" data-builder-status></p>' +
        '</div>' +
      '</div>';

    renderTypes();
    renderTags();
    bindControls();
  }

  function renderTypes() {
    var host = BUILDER_ROOT.querySelector('[data-builder-types]');
    var TYPES = [
      { key: 'character', label: '字 Characters' },
      { key: 'vocab',     label: '词 Vocabulary' },
      { key: 'chengyu',   label: '成语 Chengyu' },
      { key: 'grammar',   label: '语法 Grammar' },
      { key: 'compound',  label: '词组 Compounds' },
    ];
    var counts = countByType();
    host.innerHTML = TYPES.map(function (t) {
      var checked = STATE.selectedTypes.has(t.key) ? ' checked' : '';
      return '<label class="builder-check"><input type="checkbox" data-builder-type="' + t.key + '"' + checked + '> ' +
        escapeHtml(t.label) + ' <span class="builder-check-count">(' + (counts[t.key] || 0) + ')</span></label>';
    }).join('');
  }

  function renderTags() {
    var host = BUILDER_ROOT.querySelector('[data-builder-tags]');
    if (STATE.tagChips.length === 0) {
      host.innerHTML = '<p class="builder-empty">Tag chips load with the corpus…</p>';
      return;
    }
    host.innerHTML = STATE.tagChips.map(function (t) {
      var on = STATE.selectedTags.has(t.key) ? ' is-on' : '';
      return '<button type="button" class="builder-tag-chip' + on + '" data-builder-tag="' +
        escapeHtml(t.key) + '">' + escapeHtml(t.en) + '</button>';
    }).join('');
  }

  function countByType() {
    var c = {};
    STATE.cards.forEach(function (x) { c[x.t] = (c[x.t] || 0) + 1; });
    return c;
  }

  function renderResult() {
    var matches = filteredCards();
    var nameEl = BUILDER_ROOT.querySelector('[data-builder-name]');
    var countEl = BUILDER_ROOT.querySelector('[data-builder-count]');
    var plecoBtn = BUILDER_ROOT.querySelector('[data-builder-pleco]');
    var ankiBtn = BUILDER_ROOT.querySelector('[data-builder-anki]');
    nameEl.textContent = suggestedName();
    countEl.textContent = matches.length;
    plecoBtn.disabled = matches.length === 0;
    ankiBtn.disabled = matches.length === 0;
  }

  function setStatus(msg, kind) {
    var el = BUILDER_ROOT.querySelector('[data-builder-status]');
    el.textContent = msg || '';
    el.dataset.kind = kind || '';
  }

  // ────────────────────── Bindings ──────────────────────

  function bindControls() {
    var typesHost = BUILDER_ROOT.querySelector('[data-builder-types]');
    typesHost.addEventListener('change', function (e) {
      var t = e.target.dataset.builderType;
      if (!t) return;
      if (e.target.checked) STATE.selectedTypes.add(t);
      else STATE.selectedTypes.delete(t);
      renderResult();
    });

    var tagsHost = BUILDER_ROOT.querySelector('[data-builder-tags]');
    tagsHost.addEventListener('click', function (e) {
      var k = e.target.dataset && e.target.dataset.builderTag;
      if (!k) return;
      if (STATE.selectedTags.has(k)) STATE.selectedTags.delete(k);
      else STATE.selectedTags.add(k);
      e.target.classList.toggle('is-on');
      renderResult();
    });

    var minSel = BUILDER_ROOT.querySelector('[data-builder-hsk-min]');
    var maxSel = BUILDER_ROOT.querySelector('[data-builder-hsk-max]');
    var unkChk = BUILDER_ROOT.querySelector('[data-builder-hsk-unknown]');
    minSel.value = String(STATE.hskMin);
    maxSel.value = String(STATE.hskMax);
    minSel.addEventListener('change', function () {
      STATE.hskMin = parseInt(minSel.value, 10);
      if (STATE.hskMin > STATE.hskMax) {
        STATE.hskMax = STATE.hskMin;
        maxSel.value = String(STATE.hskMax);
      }
      renderResult();
    });
    maxSel.addEventListener('change', function () {
      STATE.hskMax = parseInt(maxSel.value, 10);
      if (STATE.hskMax < STATE.hskMin) {
        STATE.hskMin = STATE.hskMax;
        minSel.value = String(STATE.hskMin);
      }
      renderResult();
    });
    unkChk.addEventListener('change', function () {
      STATE.includeUnknownHsk = unkChk.checked;
      renderResult();
    });

    var searchEl = BUILDER_ROOT.querySelector('[data-builder-search]');
    var searchTimer = null;
    searchEl.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        STATE.search = searchEl.value.trim();
        renderResult();
      }, 120);
    });

    var plecoBtn = BUILDER_ROOT.querySelector('[data-builder-pleco]');
    plecoBtn.addEventListener('click', onDownloadPleco);
    var ankiBtn = BUILDER_ROOT.querySelector('[data-builder-anki]');
    ankiBtn.addEventListener('click', onBuildAnki);
  }

  // ────────────────────── Actions ──────────────────────

  function onDownloadPleco() {
    var cards = filteredCards();
    if (cards.length === 0) return;
    setStatus('', '');
    import('../../scripts/anki-apkg-browser.mjs').then(function (mod) {
      var tsv = mod.buildPlecoTsv(cards);
      var blob = new Blob([tsv], { type: 'text/tab-separated-values;charset=utf-8' });
      mod.downloadBlob(blob, 'shuwu-' + suggestedSlug() + '.txt');
      setStatus('Open in Pleco → Settings → Flashcards → Import (tab-separated).', 'ok');
    }).catch(function (err) {
      setStatus('Download failed. Try again.', 'err');
    });
  }

  function onBuildAnki() {
    var cards = filteredCards();
    if (cards.length === 0) return;
    setStatus('Building deck…', 'pending');
    import('../../scripts/anki-apkg-browser.mjs').then(function (mod) {
      var deckName = '角落書屋 · ' + suggestedName();
      var slug = suggestedSlug();
      return mod.buildApkgInBrowser({
        deckName: deckName,
        cards: cards,
        extraTags: ['custom-build', slug],
      }).then(function (blob) {
        mod.downloadBlob(blob, 'shuwu-' + slug + '.apkg');
        setStatus('Double-click the .apkg to import into Anki.', 'ok');
      });
    }).catch(function (err) {
      setStatus('Build failed. Try again.', 'err');
    });
  }

  // ────────────────────── Boot ──────────────────────

  function boot() {
    renderShell();
    Promise.all([
      fetch('../../data/exports/cards.json').then(function (r) { return r.json(); }),
      fetch('../../data/exports/manifest.json').then(function (r) { return r.json(); }),
    ]).then(function (results) {
      STATE.cards = results[0];
      var manifest = results[1];
      // Tag chips: derive from slice manifest's tag dimension so the
      // builder offers exactly the same whitelist the slicer uses.
      var tagSlices = (manifest.slices || []).filter(function (s) { return s.dimension === 'tag'; });
      STATE.tagChips = tagSlices
        .map(function (s) { return { key: s.criterion, en: s.name }; })
        .sort(function (a, b) { return a.en.localeCompare(b.en); });
      renderTypes();
      renderTags();
      renderResult();
      setStatus('', '');
    }).catch(function () {
      setStatus('Couldn’t load the corpus. Try refreshing.', 'err');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
