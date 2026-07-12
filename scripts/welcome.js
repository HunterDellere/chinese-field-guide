/* welcome.js — first-visit-only onboarding moment.
 *
 * Shows a 4-scene tour on the visitor's first homepage load, explaining
 * what the site is (not a flashcard app), how to read it (daily reading),
 * how to search, and how to wander (families). Dismissal is persisted in
 * localStorage so it never appears again on the same device.
 *
 * Persistence:
 *   localStorage['shuwo.welcomed.v1'] = '<ISO>'   (set on dismiss)
 *
 * Force-show for testing: append ?welcome=1 to the URL.
 * Reset for testing: localStorage.removeItem('shuwo.welcomed.v1').
 *
 * No external deps. Vanilla DOM. Brand-native styling.
 */

(function () {
  "use strict";

  const STORAGE_KEY = "shuwo.welcomed.v1";

  function hasBeenWelcomed() {
    try { return !!localStorage.getItem(STORAGE_KEY); } catch (_) { return false; }
  }
  function markWelcomed() {
    try { localStorage.setItem(STORAGE_KEY, new Date().toISOString()); } catch (_) {}
  }

  function isForced() {
    try { return new URLSearchParams(location.search).get("welcome") === "1"; }
    catch (_) { return false; }
  }

  // Respect reduced-motion preference — drops transitions for those users.
  const prefersReducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Four scenes. Copy is intentionally tight — one short line each.
  // CN glyph is decorative; aria-hidden so screen readers get the English.
  const SCENES = [
    {
      glyph: "迎",
      eyebrow: "歡迎 huānyíng",
      title: "Welcome to the nook.",
      body: "A free reference for Chinese: characters, words, grammar, and the culture behind them, with etymology and examples on every page.",
      cta: "Show me around",
    },
    {
      glyph: "日",
      eyebrow: "今日 jīnrì",
      title: "Start your day with one passage.",
      body: "A short Chinese reading every morning, chosen for you. Audio, pinyin, translation, all in one place.",
      cta: "Next",
    },
    {
      glyph: "搜",
      eyebrow: "搜索 sōusuǒ",
      title: "Search a character, a word, an idea.",
      body: 'Try 心, dao, or confucius. Press <kbd class="welcome-kbd">/</kbd> from anywhere to jump into the search bar.',
      cta: "Next",
      bodyHtml: true,
    },
    {
      glyph: "探",
      eyebrow: "探索 tànsuǒ",
      title: "Browse three ways.",
      body: "Language, topics, or collections. Every page links to related entries and vocabulary, so one lookup leads to the next.",
      cta: "Start reading",
    },
  ];

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === "class") node.className = attrs[k];
      else if (k === "html") node.innerHTML = attrs[k];
      else if (k.startsWith("aria-") || k === "role" || k === "id" || k === "type" || k === "tabindex")
        node.setAttribute(k, attrs[k]);
      else node[k] = attrs[k];
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(c => {
        if (c == null) return;
        node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
      });
    }
    return node;
  }

  function injectStyles() {
    if (document.getElementById("welcome-styles")) return;
    const style = document.createElement("style");
    style.id = "welcome-styles";
    style.textContent = `
.welcome-backdrop {
  position: fixed; inset: 0;
  background: radial-gradient(ellipse at center, rgba(28,18,8,0.55) 0%, rgba(28,18,8,0.78) 70%);
  -webkit-backdrop-filter: blur(2px);
  backdrop-filter: blur(2px);
  z-index: 9000;
  display: flex; align-items: center; justify-content: center;
  padding: 1.25rem;
  opacity: 0;
  transition: opacity 0.45s ease;
}
.welcome-backdrop.is-open { opacity: 1; }
.welcome-card {
  position: relative;
  width: min(520px, 100%);
  max-height: calc(100vh - 2.5rem);
  background: var(--papyrus, #f2e8d5);
  color: var(--ink, #14110a);
  border: 1px solid var(--rule, #c8bda0);
  border-radius: var(--radius-lg, 8px);
  box-shadow:
    0 1px 0 rgba(255,255,255,0.18) inset,
    0 28px 60px rgba(28,18,8,0.45),
    0 2px 6px rgba(28,18,8,0.25);
  padding: 2.4rem 2.2rem 1.6rem;
  display: flex; flex-direction: column;
  overflow: hidden;
  transform: translateY(8px);
  transition: transform 0.55s cubic-bezier(0.2, 0.7, 0.2, 1);
}
.welcome-backdrop.is-open .welcome-card { transform: translateY(0); }
@media (prefers-reduced-motion: reduce) {
  .welcome-backdrop, .welcome-card { transition: none; }
}
.welcome-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--red, #8b1a1a), var(--ochre-2, #c07830), var(--red, #8b1a1a));
  opacity: 0.55;
}
.welcome-glyph {
  position: relative;
  font-family: var(--font-cn-display, 'Noto Serif SC', serif);
  font-size: 4.2rem;
  font-weight: 600;
  color: var(--red, #8b1a1a);
  line-height: 1;
  text-align: center;
  margin-bottom: 0.6rem;
  text-shadow: 1px 1px 0 rgba(139,26,26,0.12);
  letter-spacing: 0.04em;
  user-select: none;
}
/* Scholar's-seal watermark behind the glyph — adds depth without
   competing with the hanzi itself. Mirrors the .scholar boxes used
   throughout the site. */
.welcome-glyph::before {
  content: '';
  position: absolute;
  top: 50%; left: 50%;
  width: 7.5rem; height: 7.5rem;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle at center, var(--ochre-tint, rgba(160,100,40,0.07)) 0%, transparent 70%);
  pointer-events: none;
  z-index: -1;
}
.welcome-eyebrow {
  font-family: var(--font-mono, monospace);
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ochre, #a06428);
  text-align: center;
  margin-bottom: 0.85rem;
}
.welcome-eyebrow .cn {
  font-family: var(--font-cn, 'Noto Serif SC', serif);
  font-size: 0.82rem;
  letter-spacing: 0.05em;
  text-transform: none;
  margin-right: 0.35rem;
  color: var(--red, #8b1a1a);
  font-weight: 600;
}
.welcome-title {
  font-family: 'EB Garamond', Georgia, serif;
  font-size: 1.65rem;
  font-weight: 600;
  color: var(--ink, #14110a);
  text-align: center;
  line-height: 1.25;
  margin: 0 0 0.7rem;
  letter-spacing: -0.005em;
}
.welcome-body {
  font-family: 'EB Garamond', Georgia, serif;
  font-size: 1.02rem;
  font-style: italic;
  color: var(--ink-4, #3d2e18);
  text-align: center;
  line-height: 1.55;
  margin: 0 auto 1.6rem;
  max-width: 38ch;
}
.welcome-actions {
  display: flex; align-items: center; justify-content: space-between;
  gap: 0.75rem;
  margin-top: auto;
}
.welcome-dots {
  display: flex; gap: 0.4rem; align-items: center;
}
.welcome-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--papyrus-4, #d4c9a8);
  border: 1px solid var(--rule, #c8bda0);
  transition: background 0.3s ease, transform 0.3s ease, border-color 0.3s;
  padding: 0;
}
.welcome-dot.is-active {
  background: var(--red, #8b1a1a);
  border-color: var(--red, #8b1a1a);
  transform: scale(1.15);
}
.welcome-dot.is-past {
  background: var(--ochre, #a06428);
  border-color: var(--ochre, #a06428);
}
.welcome-cta {
  appearance: none;
  font-family: 'EB Garamond', Georgia, serif;
  font-size: 1rem;
  font-weight: 600;
  color: var(--papyrus, #f2e8d5);
  background: var(--red, #8b1a1a);
  border: 1px solid var(--red, #8b1a1a);
  padding: 0.6rem 1.4rem;
  border-radius: 999px;
  cursor: pointer;
  letter-spacing: 0.01em;
  transition: background 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
  box-shadow: 0 1px 0 rgba(255,255,255,0.12) inset, 0 2px 8px rgba(139,26,26,0.25);
}
.welcome-cta:hover {
  background: var(--red-2, #a82020);
  transform: translateY(-1px);
}
.welcome-cta:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(160,100,40,0.4), 0 2px 8px rgba(139,26,26,0.25);
}
.welcome-skip {
  position: absolute;
  top: 0.6rem; right: 0.6rem;
  appearance: none;
  background: transparent;
  border: none;
  font-family: var(--font-ui, system-ui), sans-serif;
  font-size: 0.78rem;
  color: var(--ink-5, #5a4428);
  cursor: pointer;
  padding: 0.6rem 0.8rem;
  min-width: 44px; min-height: 44px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 6px;
  transition: color 0.15s, background 0.15s;
  letter-spacing: 0.02em;
}
.welcome-skip:hover { color: var(--ink-2, #221808); background: var(--papyrus-3, #e0d4b8); }
.welcome-skip:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(160,100,40,0.35);
}
/* Inline keyboard chip used in scene-3 body — matches the .filter-shortcut-hint
   kbd style used in the search bar so the chip feels like part of the same UI. */
.welcome-kbd {
  font-family: var(--font-mono, monospace);
  background: var(--papyrus-3, #e0d4b8);
  border: 1px solid var(--rule, #c8bda0);
  border-radius: 3px;
  padding: 0.08rem 0.42rem;
  margin: 0 0.15rem;
  color: var(--ink-2, #221808);
  font-size: 0.86em;
  font-style: normal;
  vertical-align: 1px;
  line-height: 1.1;
  box-shadow: 0 1px 0 rgba(28,18,8,0.06);
}
/* Subtle keyboard-hint line under the actions row — discoverability
   without visual noise. Hidden on the smallest mobile screens where
   keyboard navigation isn't relevant. */
.welcome-keys {
  font-family: var(--font-mono, monospace);
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  color: var(--ink-5, #5a4428);
  opacity: 0.65;
  text-align: center;
  margin: 0.85rem 0 0;
  user-select: none;
}
.welcome-keys .k {
  font-family: var(--font-mono, monospace);
  background: var(--papyrus-3, #e0d4b8);
  border: 1px solid var(--rule, #c8bda0);
  border-radius: 2px;
  padding: 0.02rem 0.32rem;
  margin: 0 0.1rem;
  color: var(--ink-4, #3d2e18);
}
.welcome-scene {
  display: flex; flex-direction: column;
  opacity: 1;
  transition: opacity 0.32s ease;
}
.welcome-scene.is-leaving { opacity: 0; }

/* Tablet — narrower than desktop card, looser than phone */
@media (max-width: 820px) and (min-width: 481px) {
  .welcome-card { padding: 2.1rem 1.9rem 1.4rem; }
}

/* Mobile */
@media (max-width: 480px) {
  .welcome-card { padding: 1.9rem 1.3rem 1.2rem; }
  .welcome-glyph { font-size: 3.4rem; }
  .welcome-glyph::before { width: 5.5rem; height: 5.5rem; }
  .welcome-title { font-size: 1.32rem; }
  .welcome-body { font-size: 0.95rem; max-width: 32ch; }
  .welcome-cta { padding: 0.55rem 1.15rem; font-size: 0.95rem; }
  .welcome-keys { display: none; }
}

/* Dark mode */
html[data-theme="dark"] .welcome-card {
  background: #1a1408;
  color: #e8dcc4;
  border-color: #3d2e18;
  box-shadow: 0 28px 60px rgba(0,0,0,0.65), 0 2px 6px rgba(0,0,0,0.45);
}
html[data-theme="dark"] .welcome-title { color: #efe4cc; }
html[data-theme="dark"] .welcome-body { color: #c8b890; }
html[data-theme="dark"] .welcome-skip { color: #a89770; }
html[data-theme="dark"] .welcome-skip:hover { color: #efe4cc; background: rgba(255,255,255,0.06); }
html[data-theme="dark"] .welcome-dot { background: #3d2e18; border-color: #5a4428; }
html[data-theme="dark"] .welcome-kbd,
html[data-theme="dark"] .welcome-keys .k {
  background: #2a2010;
  border-color: #5a4428;
  color: #e8dcc4;
  box-shadow: none;
}
html[data-theme="dark"] .welcome-keys { color: #8a7755; }
html[data-theme="dark"] .welcome-glyph::before {
  background: radial-gradient(circle at center, rgba(192,120,48,0.08) 0%, transparent 70%);
}
`;
    document.head.appendChild(style);
  }

  function show() {
    injectStyles();

    const backdrop = el("div", {
      class: "welcome-backdrop",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "welcome-title",
      "aria-describedby": "welcome-body",
    });

    const card = el("div", { class: "welcome-card" });

    const skip = el("button", { class: "welcome-skip", type: "button", "aria-label": "Skip welcome" }, "Skip");

    const sceneWrap = el("div", { class: "welcome-scene", id: "welcome-scene-wrap" });

    const dotsWrap = el("div", { class: "welcome-dots", role: "tablist", "aria-label": "Onboarding progress" });
    SCENES.forEach((_, i) => {
      const dot = el("button", {
        class: "welcome-dot",
        type: "button",
        "aria-label": `Step ${i + 1} of ${SCENES.length}`,
      });
      dot._idx = i;
      dotsWrap.appendChild(dot);
    });

    const cta = el("button", { class: "welcome-cta", type: "button" });

    const actions = el("div", { class: "welcome-actions" }, [dotsWrap, cta]);
    const keys = el("p", {
      class: "welcome-keys",
      "aria-hidden": "true",
      html: '<span class="k">←</span> <span class="k">→</span> step · <span class="k">Esc</span> close',
    });

    card.appendChild(skip);
    card.appendChild(sceneWrap);
    card.appendChild(actions);
    card.appendChild(keys);
    backdrop.appendChild(card);

    let current = 0;
    let isAnimating = false;

    function renderScene() {
      const s = SCENES[current];
      sceneWrap.innerHTML = "";
      sceneWrap.appendChild(el("div", { class: "welcome-glyph", "aria-hidden": "true" }, s.glyph));
      sceneWrap.appendChild(el("div", { class: "welcome-eyebrow", html: `<span class="cn">${s.eyebrow.split(" ")[0]}</span>${s.eyebrow.split(" ").slice(1).join(" ")}` }));
      sceneWrap.appendChild(el("h2", { class: "welcome-title", id: "welcome-title" }, s.title));
      const bodyAttrs = { class: "welcome-body", id: "welcome-body" };
      if (s.bodyHtml) bodyAttrs.html = s.body;
      sceneWrap.appendChild(s.bodyHtml ? el("p", bodyAttrs) : el("p", bodyAttrs, s.body));
      cta.textContent = s.cta;
      Array.from(dotsWrap.children).forEach((d, i) => {
        d.classList.toggle("is-active", i === current);
        d.classList.toggle("is-past", i < current);
      });
    }

    function gotoScene(idx) {
      if (isAnimating || idx === current) return;
      if (idx >= SCENES.length) { close(); return; }
      if (prefersReducedMotion) {
        current = idx;
        renderScene();
        return;
      }
      isAnimating = true;
      sceneWrap.classList.add("is-leaving");
      setTimeout(() => {
        current = idx;
        renderScene();
        sceneWrap.classList.remove("is-leaving");
        isAnimating = false;
      }, 320);
    }

    function close() {
      markWelcomed();
      backdrop.classList.remove("is-open");
      setTimeout(() => {
        document.removeEventListener("keydown", onKey);
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        document.documentElement.style.overflow = "";
        if (lastFocus && typeof lastFocus.focus === "function") {
          try { lastFocus.focus(); } catch (_) {}
        }
      }, prefersReducedMotion ? 0 : 450);
    }

    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      // Arrows always navigate scenes — they're modal-scoped here.
      if (e.key === "ArrowRight") { e.preventDefault(); gotoScene(current + 1); return; }
      if (e.key === "ArrowLeft")  { e.preventDefault(); gotoScene(Math.max(0, current - 1)); return; }
      // Enter advances only when focus isn't on an actual button (let those
      // fire their own click events).
      if (e.key === "Enter" && document.activeElement !== cta && document.activeElement !== skip) {
        e.preventDefault(); gotoScene(current + 1);
      }
    }

    cta.addEventListener("click", () => gotoScene(current + 1));
    skip.addEventListener("click", close);
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
    dotsWrap.addEventListener("click", (e) => {
      const dot = e.target.closest(".welcome-dot");
      if (dot && typeof dot._idx === "number") gotoScene(dot._idx);
    });

    const lastFocus = document.activeElement;
    document.body.appendChild(backdrop);
    document.documentElement.style.overflow = "hidden";

    renderScene();
    requestAnimationFrame(() => backdrop.classList.add("is-open"));

    // Focus the CTA so Enter advances immediately.
    setTimeout(() => { try { cta.focus(); } catch (_) {} }, prefersReducedMotion ? 10 : 380);

    document.addEventListener("keydown", onKey);
  }

  function boot() {
    if (!isForced() && hasBeenWelcomed()) return;
    // Skip for headless automation (Playwright/Selenium) unless explicitly
    // forced via ?welcome=1 — keeps e2e tests deterministic and snappy.
    if (!isForced() && navigator.webdriver) return;
    // Defer to next idle frame so it doesn't compete with first paint.
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => setTimeout(show, 400));
    } else {
      setTimeout(show, 400);
    }
  }

  boot();
})();
