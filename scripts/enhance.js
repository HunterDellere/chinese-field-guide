/* enhance.js — pinyin audio, stroke order, quiz mode, hover tooltips, random entry,
 *               hero animate-on-scroll
 *
 * Loaded once per content page. Lazy-loads Hanzi Writer from CDN only when needed.
 */
if (window.__enhanceInit) { /* already loaded */ }
else { window.__enhanceInit = true; (function () {

  const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Service worker registration ──────────────────────────────────────────
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    // Determine SW path relative to current page; SW must be served from root
    const swPath = location.pathname.includes('/pages/') ? '../../sw.js' : 'sw.js';
    window.addEventListener('load', function () {
      navigator.serviceWorker.register(swPath).catch(function (err) {
        console.warn('SW registration failed:', err);
      });
    });
  }

  // ── Pinyin audio via SpeechSynthesis ──────────────────────────────────────
  const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
  let zhVoice = null;
  function pickVoice() {
    if (!synth) return;
    const voices = synth.getVoices();
    zhVoice = voices.find(v => /zh[-_]?CN/i.test(v.lang)) ||
              voices.find(v => /^zh/i.test(v.lang)) || null;
  }
  if (synth) {
    pickVoice();
    if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = pickVoice;
  }

  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.audio-btn');
    if (!btn) return;
    e.preventDefault();
    const text = btn.dataset.audio;
    if (!text) return;
    if (!synth) {
      btn.title = 'Audio not supported in this browser';
      return;
    }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    u.rate = 0.85;
    if (zhVoice) u.voice = zhVoice;
    btn.classList.add('playing');
    u.onend = u.onerror = function () { btn.classList.remove('playing'); };
    synth.speak(u);
  });

  // ── Hanzi Writer loader (shared between stroke-order panel and hero animate) ──
  let hwPromise = null;
  function loadHanziWriter() {
    if (window.HanziWriter) return Promise.resolve(window.HanziWriter);
    if (hwPromise) return hwPromise;
    hwPromise = new Promise(function (resolve, reject) {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/hanzi-writer@3.7/dist/hanzi-writer.min.js';
      s.async = true;
      s.onload = function () { resolve(window.HanziWriter); };
      s.onerror = function () { reject(new Error('Hanzi Writer failed to load')); };
      document.head.appendChild(s);
    });
    return hwPromise;
  }

  // ── Stroke order panel (with quiz mode) ───────────────────────────────────
  const stage = document.getElementById('so-stage');
  const hint = document.getElementById('so-hint');
  if (stage) {
    const char = stage.dataset.char;
    if (char) initStrokePanel(stage, hint, char);
  }

  function initStrokePanel(stage, hint, char) {
    const SIZE = 220;
    let writer = null;
    let stepIdx = 0;
    let booting = false;
    let inQuiz = false;

    function init() {
      if (writer || booting) return Promise.resolve();
      booting = true;
      stage.classList.add('loading');
      return loadHanziWriter().then(function (HW) {
        writer = HW.create(stage, char, {
          width: SIZE,
          height: SIZE,
          padding: 5,
          strokeColor: '#8b1a1a',
          radicalColor: '#a06428',
          outlineColor: '#c8bda0',
          highlightColor: '#a06428',
          drawingColor: '#1a5050',
          delayBetweenStrokes: 220,
          strokeAnimationSpeed: 1.1,
          showOutline: true,
          showCharacter: false
        });
        stage.classList.remove('loading');
        stage.classList.add('ready');
        booting = false;
      }).catch(function (err) {
        stage.classList.remove('loading');
        stage.classList.add('error');
        stage.textContent = 'Stroke order unavailable.';
        booting = false;
        console.warn(err);
      });
    }

    function setHint(text) { if (hint) hint.innerHTML = text; }
    function exitQuizIfActive() {
      if (inQuiz && writer && writer.cancelQuiz) {
        try { writer.cancelQuiz(); } catch (e) { /* ignore */ }
      }
      inQuiz = false;
    }

    function play() {
      init().then(function () {
        if (!writer) return;
        exitQuizIfActive();
        stepIdx = 0;
        writer.animateCharacter();
      });
    }
    function step() {
      init().then(function () {
        if (!writer) return;
        exitQuizIfActive();
        writer.animateStroke(stepIdx);
        stepIdx++;
      });
    }
    function reset() {
      init().then(function () {
        if (!writer) return;
        exitQuizIfActive();
        stepIdx = 0;
        writer.hideCharacter();
        setHint('Click the character to replay. Press <strong>Try drawing</strong> to write it yourself.');
      });
    }
    function quiz() {
      init().then(function () {
        if (!writer) return;
        if (inQuiz) { exitQuizIfActive(); writer.hideCharacter(); setHint('Quiz cancelled.'); return; }
        inQuiz = true;
        writer.hideCharacter();
        setHint('Draw stroke <strong>1</strong> with your finger or mouse.');
        writer.quiz({
          onMistake: function (info) {
            setHint(`Stroke ${info.strokeNum + 1}: try again. <em>${info.totalMistakes} ${info.totalMistakes === 1 ? 'mistake' : 'mistakes'} so far.</em>`);
          },
          onCorrectStroke: function (info) {
            const next = info.strokeNum + 2;
            if (info.strokesRemaining > 0) {
              setHint(`✓ Stroke ${info.strokeNum + 1} good. Now stroke <strong>${next}</strong>.`);
            }
          },
          onComplete: function (info) {
            inQuiz = false;
            const word = info.totalMistakes === 0 ? 'Perfect.' : info.totalMistakes < 3 ? 'Well done.' : 'Done.';
            setHint(`${word} You wrote <strong>${char}</strong> with ${info.totalMistakes} ${info.totalMistakes === 1 ? 'mistake' : 'mistakes'}.`);
          }
        });
      });
    }

    document.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-so-action]');
      if (!btn) return;
      const action = btn.dataset.soAction;
      if (action === 'play') play();
      else if (action === 'step') step();
      else if (action === 'reset') reset();
      else if (action === 'quiz') quiz();
    });

    stage.addEventListener('click', function () {
      if (inQuiz) return; // quiz handles its own input
      if (!writer) play();
      else { stepIdx = 0; writer.animateCharacter(); }
    });

    const saver = navigator.connection && navigator.connection.saveData;
    if (!saver && 'requestIdleCallback' in window) {
      requestIdleCallback(function () { init(); }, { timeout: 2000 });
    }
  }

  // ── Hero glyph animate once on first scroll into etymology section ───────
  if (!REDUCED_MOTION) {
    const heroGlyph = document.querySelector('.hero-script--simp .hero-glyph');
    const etymology = document.getElementById('etymology');
    if (heroGlyph && etymology) {
      const char = heroGlyph.textContent.trim();
      if (char && char.length === 1) {
        let played = false;
        const obs = new IntersectionObserver(function (entries) {
          for (const ent of entries) {
            if (ent.isIntersecting && !played) {
              played = true;
              obs.disconnect();
              animateHero(heroGlyph, char);
            }
          }
        }, { rootMargin: '0px 0px -40% 0px' });
        obs.observe(etymology);
      }
    }
  }

  function animateHero(targetEl, char) {
    loadHanziWriter().then(function (HW) {
      const rect = targetEl.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) || 120;
      const overlay = document.createElement('div');
      overlay.className = 'hero-glyph-anim';
      overlay.style.cssText =
        `position: absolute; left: 0; top: 0; width: ${size}px; height: ${size}px;` +
        `pointer-events: none; z-index: 1;`;
      const parent = targetEl.parentElement;
      if (!parent) return;
      // Position parent relative if not already
      const ps = getComputedStyle(parent);
      if (ps.position === 'static') parent.style.position = 'relative';
      // Place overlay over the glyph
      overlay.style.left = targetEl.offsetLeft + 'px';
      overlay.style.top = targetEl.offsetTop + 'px';
      parent.appendChild(overlay);
      const original = targetEl.style.opacity;
      targetEl.style.opacity = '0';
      try {
        const w = HW.create(overlay, char, {
          width: size,
          height: size,
          padding: 0,
          strokeColor: '#8b1a1a',
          radicalColor: '#a06428',
          outlineColor: 'rgba(139,26,26,0.08)',
          delayBetweenStrokes: 90,
          strokeAnimationSpeed: 1.6,
          showOutline: false,
          showCharacter: false
        });
        w.animateCharacter({
          onComplete: function () {
            // Fade real glyph back in, remove overlay
            targetEl.style.transition = 'opacity 0.35s ease';
            targetEl.style.opacity = original || '1';
            setTimeout(function () { overlay.remove(); }, 400);
          }
        });
      } catch (e) {
        targetEl.style.opacity = original || '1';
        overlay.remove();
      }
    }).catch(function () { /* silent — hero stays static */ });
  }

  // ── Hover-to-define tooltips on all internal content links ─────────────
  // Skip on touch-only devices — tooltips are unusable without hover.
  if (!window.matchMedia('(hover: none)').matches) {
    const internalLinks = document.querySelectorAll(
      'a.auto-link, a.related-link, a.pn-link, a.adj, ' +
      'main a[href]:not([href^="http"]):not([href^="#"]):not([href^="mailto:"])'
    );
    if (internalLinks.length) initTooltips(internalLinks);
  }

  function initTooltips(links) {
    let entriesMap = null;
    let pending = null;
    let tooltipEl = null;
    let activeLink = null;
    let hoverTimer = null;

    function ensureEntries() {
      if (entriesMap) return Promise.resolve(entriesMap);
      if (pending) return pending;
      // Find the path back to entries.json (depth-2 from content pages)
      pending = fetch('../../data/entries.json').then(r => r.json()).then(list => {
        entriesMap = {};
        for (const e of list) entriesMap[e.path] = e;
        return entriesMap;
      }).catch(() => { entriesMap = {}; return entriesMap; });
      return pending;
    }

    function tooltipFor(link) {
      if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.className = 'al-tooltip';
        tooltipEl.setAttribute('role', 'tooltip');
        document.body.appendChild(tooltipEl);
      }
      return tooltipEl;
    }

    function resolveEntry(link) {
      // Auto-link href is relative; reconstruct the canonical path
      const abs = new URL(link.getAttribute('href'), location.href);
      const idx = abs.pathname.indexOf('/pages/');
      if (idx === -1) return null;
      const path = abs.pathname.slice(idx + 1); // strip leading slash → "pages/.../x.html"
      return entriesMap && entriesMap[path] ? entriesMap[path] : null;
    }

    function show(link) {
      ensureEntries().then(function () {
        const e = resolveEntry(link);
        if (!e) return;
        const tip = tooltipFor(link);
        const cn = e.char || (e.title ? e.title.split('·')[0].trim() : '');
        const py = e.pinyin || '';
        const desc = e.desc || '';
        const hskLabel = e.hsk
          ? (typeof e.hsk === 'object' ? `HSK ${e.hsk.from}–${e.hsk.to}` : `HSK ${e.hsk}`)
          : '';
        tip.innerHTML =
          `<div class="al-tt-head">` +
            (cn ? `<span class="al-tt-cn">${escapeHtml(cn)}</span>` : '') +
            (py ? `<span class="al-tt-py">${escapeHtml(py)}</span>` : '') +
            (hskLabel ? `<span class="al-tt-hsk">${escapeHtml(hskLabel)}</span>` : '') +
          `</div>` +
          `<div class="al-tt-desc">${escapeHtml(desc)}</div>`;
        positionTooltip(tip, link);
        tip.classList.add('visible');
        activeLink = link;
      });
    }
    function hide() {
      if (tooltipEl) tooltipEl.classList.remove('visible');
      activeLink = null;
    }
    function positionTooltip(tip, link) {
      const r = link.getBoundingClientRect();
      tip.style.visibility = 'hidden';
      tip.style.display = 'block';
      const tr = tip.getBoundingClientRect();
      const margin = 8;
      let top = r.bottom + window.scrollY + margin;
      let left = r.left + window.scrollX + r.width / 2 - tr.width / 2;
      if (left < 8) left = 8;
      if (left + tr.width > window.scrollX + window.innerWidth - 8) {
        left = window.scrollX + window.innerWidth - tr.width - 8;
      }
      // Flip above if near bottom of viewport
      if (r.bottom + tr.height + margin > window.innerHeight) {
        top = r.top + window.scrollY - tr.height - margin;
      }
      tip.style.top = top + 'px';
      tip.style.left = left + 'px';
      tip.style.visibility = '';
    }

    function escapeHtml(s) {
      return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    links.forEach(function (link) {
      link.addEventListener('mouseenter', function () {
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(function () { show(link); }, 350);
      });
      link.addEventListener('mouseleave', function () {
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(hide, 120);
      });
      link.addEventListener('focus', function () { show(link); });
      link.addEventListener('blur', hide);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') hide();
    });
  }

  // ── Share button ──────────────────────────────────────────────────────────
  // Copies the URL and briefly swaps the button label. When the button uses
  // the new styled markup (<svg> + <span data-share-label>…</span>), only the
  // label swaps so the icon stays put.
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-share]');
    if (!btn) return;
    const data = { title: document.title, url: location.href };
    if (navigator.share) {
      navigator.share(data).catch(function () {});
      return;
    }
    navigator.clipboard.writeText(location.href).then(function () {
      const label = btn.querySelector('[data-share-label]');
      if (label) {
        const orig = label.textContent;
        label.textContent = '✓ Link copied';
        btn.classList.add('copied');
        setTimeout(function () {
          label.textContent = orig;
          btn.classList.remove('copied');
        }, 2000);
      } else {
        const orig = btn.textContent;
        btn.textContent = '✓ Copied';
        setTimeout(function () { btn.textContent = orig; }, 2000);
      }
    }).catch(function () {});
  });

  // ── Back link preserves category context ─────────────────────────────────
  // The layout's "← All Entries" link ships as a bare homepage URL. Rewrite it
  // to deep-link to the originating category section (#cat-<category>) and, if
  // the visitor arrived from the homepage in this tab, use history.back() so
  // the homepage scroll position and filter state survive the round trip.
  (function wireBackLink() {
    const backLink = document.querySelector('.topnav-back');
    if (!backLink) return;
    const cat = document.body.dataset.category;
    const href = backLink.getAttribute('href') || '../../index.html';
    if (cat) {
      try {
        const url = new URL(href, location.href);
        url.hash = 'cat-' + cat;
        backLink.setAttribute('href', url.pathname + url.search + url.hash);
      } catch (_) {
        backLink.setAttribute('href', href + '#cat-' + cat);
      }
    }
    backLink.addEventListener('click', function (e) {
      // Intercept only plain left-clicks; let middle/cmd/ctrl clicks open as usual.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      try {
        const ref = document.referrer ? new URL(document.referrer) : null;
        if (!ref || ref.origin !== location.origin) return;
        const p = ref.pathname;
        const cameFromHome = p === '/' || /\/index\.html$/.test(p) || p.endsWith('/');
        if (cameFromHome && history.length > 1) {
          e.preventDefault();
          history.back();
        }
      } catch (_) { /* fall through to default navigation */ }
    });
  })();

  // ── Random entry (topnav button) ──────────────────────────────────────────
  const randomBtns = document.querySelectorAll('[data-random-entry]');
  if (randomBtns.length) {
    let cachedEntries = null;
    function loadEntries(base) {
      if (cachedEntries) return Promise.resolve(cachedEntries);
      const url = base + 'data/entries.json';
      return fetch(url, { cache: 'no-cache' })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(function (list) {
          cachedEntries = list;
          return list;
        });
    }
    randomBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        const baseAttr = btn.getAttribute('data-entries-base');
        const base = baseAttr != null ? baseAttr : '../../';
        btn.classList.add('loading');
        loadEntries(base)
          .then(function (list) {
            const complete = list.filter(function (x) { return x.status === 'complete'; });
            if (!complete.length) { btn.classList.remove('loading'); return; }
            // Don't send the user back to the same page
            const here = location.pathname;
            let tries = 0;
            let pick;
            do {
              pick = complete[Math.floor(Math.random() * complete.length)];
              tries++;
            } while (tries < 8 && here.endsWith('/' + pick.path));
            location.href = base + pick.path;
          })
          .catch(function (err) {
            btn.classList.remove('loading');
            console.warn('Random entry failed:', err);
          });
      });
    });
  }

}()); }
