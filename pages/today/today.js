/* today.js — daily picks page logic.
 *
 * Renders five slots:
 *   - Today's thread (theme + lead + related entries, mirroring the homepage)
 *   - Character of the day
 *   - Word of the day
 *   - Grammar point of the day
 *   - Chengyu of the day
 *
 * The four single-entry slots use UTC-keyed seeded RNGs so every visitor sees
 * the same set on the same UTC day. The thread uses a year-seeded shuffle
 * (mirroring scripts/homepage.js) so today's thread on the homepage and
 * today's thread on this page agree.
 *
 * Streak counter: local-day keyed (so a visit at 11pm and another at 7am
 * tomorrow correctly count as two consecutive days). LocalStorage is the
 * sole persistence today; the data shape is versioned and structured so a
 * future auth+sync layer can adopt it without migration. Per-device by
 * design — clearing storage or switching browsers resets the streak.
 */
(function () {
  'use strict';

  // ── Shared daily-pick module ────────────────────────────────────────────
  // Seed + pool + thread logic lives in scripts/daily-pick.js so the
  // homepage and this page can never disagree on what "today" looks like.
  // The streak counter still uses local-day keying (via scripts/streak.js)
  // so a streak follows the user's perception of "a day," not UTC.
  var daily = window.shuwoDaily;
  function pad2(n) { return String(n).padStart(2, '0'); }

  // ── Card rendering ──────────────────────────────────────────────────────
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Reading-time estimate ───────────────────────────────────────────────
  // entries.json doesn't carry word counts, so we estimate from a small
  // category baseline. Character pages are dense and slow to read; chengyu
  // and grammar have the smallest body; topic pages vary widely. The
  // numbers are deliberately conservative — under-promising beats
  // over-promising for a site that wants the reader to slow down.
  var READ_MINUTES = {
    character: 5,
    vocab: 4,
    chengyu: 3,
    grammar: 4,
    topic: 6
  };
  function readMinutes(entry) {
    if (!entry) return null;
    if (entry.category === 'chengyu') return READ_MINUTES.chengyu;
    if (entry.type && READ_MINUTES[entry.type]) return READ_MINUTES[entry.type];
    return READ_MINUTES.topic;
  }

  // ── Visited tracking (per-day) ──────────────────────────────────────────
  // Records which entry paths the user has clicked from the Today page on
  // the current local day. Used to draw a small ✓ on already-opened picks
  // and on the thread lead/related so the page reflects what's been read.
  // Storage shape:
  //   localStorage['shuwo.today.visited.v1'] = { day: 'YYYY-MM-DD', paths: [...] }
  // Resets when the day changes.
  var VISITED_KEY = 'shuwo.today.visited.v1';
  function getVisited(localKey) {
    try {
      var raw = localStorage.getItem(VISITED_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.day === localKey && Array.isArray(parsed.paths)) {
          return new Set(parsed.paths);
        }
      }
    } catch (e) {}
    return new Set();
  }
  function markVisited(localKey, path) {
    var set = getVisited(localKey);
    if (set.has(path)) return;
    set.add(path);
    try {
      localStorage.setItem(VISITED_KEY, JSON.stringify({ day: localKey, paths: Array.from(set) }));
    } catch (e) {}
  }

  // ── Card rendering ──────────────────────────────────────────────────────
  function renderCard(entry, colorClass, opts) {
    opts = opts || {};
    if (!entry) return '<div class="card ' + colorClass + ' today-empty">No entry available yet for this slot.</div>';
    var href = '../' + entry.path.replace(/^pages\//, '');
    var glyph = entry.char || (entry.title ? entry.title.split('·')[0].trim() : '');
    var pinyin = entry.pinyin || '';
    var en = '';
    if (entry.title && entry.title.indexOf('·') >= 0) {
      en = entry.title.split('·').slice(1).join('·').split('—')[0].trim();
    }
    var desc = entry.desc || '';
    var mins = readMinutes(entry);
    var visited = opts.visited && opts.visited.has(entry.path);
    return (
      '<a class="card ' + colorClass + ' today-card' + (visited ? ' is-visited' : '') + '"' +
          ' href="' + escapeHtml(href) + '"' +
          ' data-entry-path="' + escapeHtml(entry.path) + '"' +
          (visited ? ' aria-label="' + escapeHtml((entry.title || glyph) + ' (already opened today)') + '"' : '') +
          '>' +
        '<div class="card-head">' +
          '<span class="card-title" lang="zh">' + escapeHtml(glyph) + '</span>' +
          (pinyin ? '<span class="card-pinyin">' + escapeHtml(pinyin) + '</span>' : '') +
        '</div>' +
        (en ? '<div class="card-body"><strong>' + escapeHtml(en) + '</strong></div>' : '') +
        (desc ? '<div class="card-body">' + escapeHtml(desc) + '</div>' : '') +
        '<div class="today-card-meta">' +
          (mins ? '<span class="tcm-time" aria-label="Approximate reading time">~' + mins + ' min</span>' : '') +
          (visited ? '<span class="tcm-visited" aria-hidden="true">✓ opened today</span>' : '') +
        '</div>' +
      '</a>'
    );
  }

  function fillSlot(slotName, entry, colorClass, visited) {
    var slot = document.querySelector('[data-today-slot="' + slotName + '"]');
    if (!slot) return;
    slot.innerHTML = renderCard(entry, colorClass, { visited: visited });
  }

  // ── Streak counter ──────────────────────────────────────────────────────
  // Backed by scripts/streak.js, which loads on every page and ticks the
  // streak silently on load. This page is the only surface that *renders*
  // it — other pages just record the visit. We always read; we don't tick
  // here, since streak.js already did.
  function renderStreak() {
    var state = (window.shuwoStreak && window.shuwoStreak.read())
      || { current: 0, longest: 0, totalDays: 0, recentDays: [] };
    var streak = state.current || 0;
    var el = document.querySelector('[data-streak-count]');
    if (el) el.textContent = String(streak);
    var box = document.querySelector('[data-today-streak]');
    if (!box) return;
    var label = box.querySelector('.today-streak-label');
    if (label) label.textContent = streak === 1 ? 'day' : 'days in a row';
    var hint = box.querySelector('.today-streak-hint');
    if (hint) {
      if (streak === 0)        hint.textContent = 'Visit daily to start a streak.';
      else if (streak === 1)   hint.textContent = 'Welcome. Visit tomorrow to keep it going.';
      else if (streak < 7)     hint.textContent = 'Resets if you skip a day.';
      else if (streak < 30)    hint.textContent = 'A week-plus rhythm. Keep going.';
      else if (streak < 100)   hint.textContent = 'A serious habit. 厲害 lìhài.';
      else                     hint.textContent = streak + ' days. 持之以恒 chízhī yǐhéng.';
    }
    renderStreakMeta(state);
  }

  function renderStreakMeta(state) {
    var el = document.querySelector('[data-streak-meta]');
    if (!el) return;
    var longest = state.longest || 0;
    var total = state.totalDays || 0;
    if (longest <= 1 && total <= 1) {
      el.textContent = '';
      return;
    }
    var parts = [];
    if (longest > 0) parts.push('longest ' + longest);
    if (total > 0) parts.push(total + ' days total');
    el.textContent = parts.join(' · ');
  }

  // ── Date label ──────────────────────────────────────────────────────────
  function setDateLabels(todayKey) {
    var short = todayKey;
    var long = '';
    try {
      var d = new Date(todayKey + 'T00:00:00Z');
      long = d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
    } catch (e) { long = short; }
    document.querySelectorAll('[data-today-date]').forEach(function (el) { el.textContent = short; });
    document.querySelectorAll('[data-today-date-long]').forEach(function (el) { el.textContent = long; });
    setChineseDateStamp(todayKey);
  }

  // Render a small calligraphic date stamp on the hero — year, month/day,
  // weekday — using Chinese numerals so the page reads as a Chinese almanac
  // (黄历 huánglì) rather than a generic dashboard. Year uses zodiac /
  // numeral-by-digit formatting (二〇二六年), month/day use plain numerals,
  // weekday uses 周X (周一 … 周日).
  var CN_DIGITS = ['〇','一','二','三','四','五','六','七','八','九'];
  function cnNumber(n) {
    // Small positive integers written with the simple compound form
    // (e.g. 12 → 十二, 25 → 二十五). Used for month/day values 1–31.
    n = Math.max(0, Math.floor(n));
    if (n === 0) return '〇';
    if (n < 10) return CN_DIGITS[n];
    if (n === 10) return '十';
    if (n < 20) return '十' + CN_DIGITS[n - 10];
    if (n < 100) {
      var tens = Math.floor(n / 10);
      var ones = n % 10;
      return CN_DIGITS[tens] + '十' + (ones ? CN_DIGITS[ones] : '');
    }
    return String(n);
  }
  function cnYearDigits(year) {
    // 2026 → 二〇二六 (digit-by-digit, the standard year form).
    return String(year).split('').map(function (d) {
      return CN_DIGITS[parseInt(d, 10)] || d;
    }).join('');
  }
  function setChineseDateStamp(todayKey) {
    var box = document.querySelector('[data-today-cn-date]');
    if (!box) return;
    try {
      var d = new Date(todayKey + 'T00:00:00Z');
      var year = d.getUTCFullYear();
      var month = d.getUTCMonth() + 1;
      var day = d.getUTCDate();
      // 0 = Sun, 1 = Mon, …, 6 = Sat. Chinese week labels start with Mon.
      var dowMap = ['日','一','二','三','四','五','六']; // index by getUTCDay
      var dow = dowMap[d.getUTCDay()];
      var yEl = box.querySelector('.tds-year');
      var mdEl = box.querySelector('.tds-md');
      var dowEl = box.querySelector('.tds-dow');
      if (yEl) yEl.textContent = cnYearDigits(year) + '年';
      if (mdEl) mdEl.textContent = cnNumber(month) + '月' + cnNumber(day) + '日';
      if (dowEl) dowEl.textContent = '周' + dow;
    } catch (e) { /* leave empty */ }
  }

  // ── Time-of-day greeting ────────────────────────────────────────────────
  // A small piece of personality on the hero: "good morning" / "good evening"
  // in the reader's local time, paired with a Chinese phrase for the same.
  function setGreeting() {
    var hr = new Date().getHours();
    var greeting;
    if (hr < 5)       greeting = { en: 'late hours',     cn: '夜深',  py: 'yèshēn' };
    else if (hr < 12) greeting = { en: 'good morning',   cn: '早上好', py: 'zǎoshang hǎo' };
    else if (hr < 14) greeting = { en: 'midday',         cn: '中午',  py: 'zhōngwǔ' };
    else if (hr < 18) greeting = { en: 'good afternoon', cn: '下午好', py: 'xiàwǔ hǎo' };
    else if (hr < 22) greeting = { en: 'good evening',   cn: '晚上好', py: 'wǎnshang hǎo' };
    else              greeting = { en: 'night reading',  cn: '夜读',  py: 'yèdú' };
    var el = document.querySelector('[data-today-greeting]');
    if (!el) return;
    el.innerHTML = '<span class="greeting-cn" lang="zh">' +
      escapeHtml(greeting.cn) + '</span> <span class="greeting-py">' +
      escapeHtml(greeting.py) + '</span> <span class="greeting-en">· ' +
      escapeHtml(greeting.en) + '</span>';
  }

  // ── Today's thread ──────────────────────────────────────────────────────
  // Thread selection lives in scripts/daily-pick.js (window.shuwoDaily) so
  // the homepage and this page render the same thread on the same day.
  function leadCn(entry) {
    if (!entry) return '';
    if (entry.char) return entry.char;
    if (entry.title && entry.title.indexOf('·') >= 0) return entry.title.split('·')[0].trim();
    return entry.title || '';
  }
  function relPathFromToday(p) {
    // Today page lives at pages/today/. Entry paths in entries.json are
    // 'pages/<cat>/<slug>.html'. From here that's '../<cat>/<slug>.html'.
    return '../' + String(p).replace(/^pages\//, '');
  }
  function renderThread(themes, byPath, visited) {
    var card = document.getElementById('today-thread-card');
    if (!card) return;
    if (!Array.isArray(themes) || !themes.length) {
      card.removeAttribute('aria-busy');
      card.innerHTML = '<div class="today-empty">No thread available today.</div>';
      return;
    }
    var picked = daily.pickThread(themes, byPath, new Date());
    var theme = picked && picked.theme;
    var lead = picked && picked.lead;
    if (!theme || !lead) {
      card.removeAttribute('aria-busy');
      card.innerHTML = '<div class="today-empty">No thread available today.</div>';
      return;
    }
    var related = (theme.related || []).map(function (p) { return byPath[p]; }).filter(Boolean).slice(0, 4);
    var v = visited || new Set();
    var glyph = leadCn(lead);
    var glyphLen = glyph.length;
    var glyphSize = glyphLen >= 4 ? ' glyph-4' : glyphLen === 3 ? ' glyph-3' : glyphLen === 2 ? ' glyph-2' : '';
    var leadTitleEn = lead.title ? (lead.title.split('·').slice(1).join('·').trim() || lead.title) : theme.title;
    var leadVisited = v.has(lead.path);
    card.dataset.watermark = glyph || '';
    if (lead.category) card.dataset.category = lead.category;
    if (leadVisited) card.classList.add('is-visited'); else card.classList.remove('is-visited');
    card.removeAttribute('aria-busy');
    card.innerHTML =
      '<a class="featured-glyph' + glyphSize + (leadVisited ? ' is-visited' : '') + '"' +
        ' href="' + escapeHtml(relPathFromToday(lead.path)) + '"' +
        ' data-entry-path="' + escapeHtml(lead.path) + '"' +
        ' aria-label="' + escapeHtml(theme.title + (leadVisited ? ' (already opened today)' : '')) + '">' +
        escapeHtml(glyph) + '</a>' +
      '<div class="featured-body">' +
        '<span class="featured-week">' + escapeHtml(theme.title) + (leadVisited ? ' <span class="tcm-visited" aria-hidden="true">✓</span>' : '') + '</span>' +
        '<h3 class="featured-title"><a href="' + escapeHtml(relPathFromToday(lead.path)) + '" data-entry-path="' + escapeHtml(lead.path) + '">' + escapeHtml(leadTitleEn) + '</a></h3>' +
        (lead.pinyin ? '<span class="featured-py">' + escapeHtml(lead.pinyin) + '</span>' : '') +
        '<p class="featured-hook">' + escapeHtml(theme.hook) + '</p>' +
        (related.length ?
          '<div class="featured-links" role="list">' +
            '<span class="featured-links-label">Follow on</span>' +
            related.map(function (e) {
              var cn = leadCn(e);
              var en = e.title ? (e.title.split('·').slice(1).join('·').trim() || e.title) : '';
              var rv = v.has(e.path);
              return '<a class="featured-link' + (rv ? ' is-visited' : '') + '"' +
                ' href="' + escapeHtml(relPathFromToday(e.path)) + '"' +
                ' data-entry-path="' + escapeHtml(e.path) + '"' +
                ' role="listitem">' +
                (cn ? '<span class="cn">' + escapeHtml(cn) + '</span>' : '') +
                escapeHtml(en) +
                (rv ? ' <span class="tcm-visited" aria-hidden="true">✓</span>' : '') + '</a>';
            }).join('') +
          '</div>'
        : '') +
      '</div>';
    // Whole card opens the lead page; inner anchors keep their own targets.
    // Delegates to the title anchor's click so visited-tracking still fires.
    // onclick (not addEventListener) so re-renders stay idempotent.
    card.classList.add('is-clickable');
    card.onclick = function (ev) {
      if (ev.target.closest('a')) return;
      var a = card.querySelector('.featured-title a');
      if (a) a.click();
    };
  }

  // ── Rotation countdown ──────────────────────────────────────────────────
  // Picks rotate at UTC midnight. Show the human-friendly remaining time
  // so visitors know their picks are stable for the rest of the UTC day,
  // and ticks every minute (cheap; the page is already alive).
  function nextUtcMidnight() {
    var d = new Date();
    d.setUTCHours(24, 0, 0, 0);
    return d;
  }
  function formatCountdown(ms) {
    if (ms <= 0) return 'just now';
    var totalMin = Math.floor(ms / 60000);
    var h = Math.floor(totalMin / 60);
    var m = totalMin % 60;
    if (h <= 0) return m + ' min';
    if (m === 0) return h + 'h';
    return h + 'h ' + m + 'm';
  }
  function tickCountdown() {
    var el = document.querySelector('[data-rotation-countdown]');
    if (!el) return;
    el.textContent = formatCountdown(nextUtcMidnight() - new Date());
  }

  // ── Keyboard navigation ─────────────────────────────────────────────────
  // 1–4 jump to the four daily picks; T jumps to the thread; R opens a
  // random entry. Skip when the user is typing into a form, or when a
  // modifier key is pressed (don't intercept Cmd-R / Ctrl-R reload).
  function bindKeys() {
    document.addEventListener('keydown', function (ev) {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      var t = ev.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      var k = ev.key.toLowerCase();
      var jump = null;
      if (k === '1')      jump = { anchor: '#today-character', slot: 'character' };
      else if (k === '2') jump = { anchor: '#today-vocab',     slot: 'vocab' };
      else if (k === '3') jump = { anchor: '#today-grammar',   slot: 'grammar' };
      else if (k === '4') jump = { anchor: '#today-chengyu',   slot: 'chengyu' };
      else if (k === 't') jump = { anchor: '#today-thread',    threadCard: true };
      else if (k === 'r') {
        // Defer to the topnav Random link if present so we reuse its
        // existing fetch/redirect logic.
        var rand = document.querySelector('[data-random-entry]');
        if (rand) { ev.preventDefault(); rand.click(); return; }
      }
      if (!jump) return;
      var target = document.querySelector(jump.anchor);
      if (!target) return;
      ev.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Then move focus into the entry link under that section so a
      // following Enter actually opens it.
      var card = null;
      if (jump.slot) {
        var slotEl = document.querySelector('[data-today-slot="' + jump.slot + '"]');
        if (slotEl) card = slotEl.querySelector('a.today-card');
      } else if (jump.threadCard) {
        var thread = document.getElementById('today-thread-card');
        if (thread) card = thread.querySelector('a.featured-title a, a.featured-glyph') || thread.querySelector('a');
      }
      if (card && typeof card.focus === 'function') {
        setTimeout(function () { card.focus({ preventScroll: true }); }, 250);
      }
    });
  }

  // ── Visited tracking on click ───────────────────────────────────────────
  function bindVisitedTracking(localKey) {
    document.addEventListener('click', function (ev) {
      var a = ev.target.closest && ev.target.closest('a[data-entry-path]');
      if (!a) return;
      markVisited(localKey, a.getAttribute('data-entry-path'));
      // We don't await — the navigation is happening anyway. localStorage
      // is synchronous so the write completes before the unload.
    });
  }

  // ── Main ────────────────────────────────────────────────────────────────
  var todayKey = daily.todayUtcKey();    // for content picks (shared across visitors)
  var localKey = (window.shuwoStreak && window.shuwoStreak.localDayKey()) ||
    (new Date().getFullYear() + '-' + pad2(new Date().getMonth() + 1) + '-' + pad2(new Date().getDate()));
  setDateLabels(todayKey);
  setGreeting();
  // streak.js (loaded earlier) already ticked the streak. Render once now,
  // and again on next animation frame in case streak.js loaded after us
  // (the script tags are both `defer`, so we're at the end of the queue —
  // but be safe).
  renderStreak();
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(renderStreak);
  }
  tickCountdown();
  setInterval(tickCountdown, 60000);
  bindKeys();
  bindVisitedTracking(localKey);

  Promise.all([
    fetch('../../data/entries.json', { cache: 'default' }).then(function (r) { return r.json(); }),
    fetch('../../data/featured.json', { cache: 'default' }).then(function (r) { return r.json(); }).catch(function () { return []; })
  ])
    .then(function (results) {
      var entries = results[0];
      var featured = results[1];
      var complete = entries.filter(function (e) { return e.status === 'complete'; });
      var byPath = {};
      complete.forEach(function (e) { byPath[e.path] = e; });

      var picks = daily.pickDaily(complete, todayKey);
      var visited = getVisited(localKey);
      fillSlot('character', picks.character, 'c-red',    visited);
      fillSlot('vocab',     picks.vocab,     'c-teal',   visited);
      fillSlot('grammar',   picks.grammar,   'c-violet', visited);
      fillSlot('chengyu',   picks.chengyu,   'c-ochre',  visited);

      renderThread(featured, byPath, visited);
    })
    .catch(function (err) {
      console.warn('today: failed to load entries.json', err);
      document.querySelectorAll('[data-today-slot]').forEach(function (slot) {
        slot.innerHTML = '<div class="card today-empty">Couldn’t load today’s picks. <a href="../../">Browse all entries →</a></div>';
      });
      var card = document.getElementById('today-thread-card');
      if (card) {
        card.removeAttribute('aria-busy');
        card.innerHTML = '<div class="today-empty">Couldn’t load today’s thread. <a href="../../">Browse all entries →</a></div>';
      }
    });
})();
