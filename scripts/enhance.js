/* enhance.js — stroke order + pinyin audio
 *
 * Loaded once per content page. Lazy-loads Hanzi Writer from CDN only when
 * a stroke-order panel is present on the page.
 */
if (window.__enhanceInit) { /* already loaded */ }
else { window.__enhanceInit = true; (function () {

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

  // ── Stroke order via Hanzi Writer (lazy-loaded) ──────────────────────────
  const stage = document.getElementById('so-stage');
  if (!stage) return;
  const char = stage.dataset.char;
  if (!char) return;

  const SIZE = 220;
  let writer = null;
  let stepIdx = 0;
  let booting = false;

  function loadHanziWriter() {
    return new Promise(function (resolve, reject) {
      if (window.HanziWriter) return resolve(window.HanziWriter);
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/hanzi-writer@3.7/dist/hanzi-writer.min.js';
      s.async = true;
      s.onload = function () { resolve(window.HanziWriter); };
      s.onerror = function () { reject(new Error('Hanzi Writer failed to load')); };
      document.head.appendChild(s);
    });
  }

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

  function play() {
    init().then(function () {
      if (!writer) return;
      stepIdx = 0;
      writer.animateCharacter();
    });
  }

  function step() {
    init().then(function () {
      if (!writer) return;
      writer.animateStroke(stepIdx, {
        onComplete: function () { /* no-op */ }
      });
      stepIdx = (stepIdx + 1);
    });
  }

  function reset() {
    init().then(function () {
      if (!writer) return;
      stepIdx = 0;
      writer.hideCharacter();
    });
  }

  document.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-so-action]');
    if (!btn) return;
    const action = btn.dataset.soAction;
    if (action === 'play') play();
    else if (action === 'step') step();
    else if (action === 'reset') reset();
  });

  // Click on the stage itself replays
  stage.addEventListener('click', function () {
    if (!writer) play();
    else { stepIdx = 0; writer.animateCharacter(); }
  });

  // Auto-init on idle so first interaction is instant; respect data-saver
  const saver = navigator.connection && navigator.connection.saveData;
  if (!saver && 'requestIdleCallback' in window) {
    requestIdleCallback(function () { init(); }, { timeout: 2000 });
  }
}()); }
