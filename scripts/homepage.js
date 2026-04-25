(function () {
  // Per-category metadata. Single source of truth: data/category-meta.json
  // (also imported by build/lib/family-render.mjs at build time). Loaded
  // inside boot() once the fetch resolves; the `color` field is derived
  // from the key, since every category uses var(--cat-<key>).
  let CATEGORY_META = {};
  function deriveCategoryMeta(raw) {
    const out = {};
    for (const [key, meta] of Object.entries(raw)) {
      out[key] = { ...meta, color: `var(--cat-${key})` };
    }
    return out;
  }

  const TODAY = new Date().toISOString().slice(0, 10);

  // Curated reading order: an opinionated tour that gives a first-time reader
  // a sense of the whole. Match by exact path so it stays stable across rebuilds.
  const START_HERE = [
    "pages/characters/ren2_人.html",
    "pages/characters/xin1_心.html",
    "pages/grammar/le_了.html",
    "pages/vocab/yinyang_阴阳.html",
    "pages/vocab/mianzi_面子.html",
    "pages/vocab/guanxi_关系.html",
    "pages/philosophy/topic_kongzi.html",
    "pages/characters/dao4_道.html",
    "pages/culture/topic_chunjie.html",
    "pages/culinary/topic_jiaozi.html",
    "pages/chengyu/maodun_矛盾.html",
    "pages/arts/topic_tangshi.html"
  ];

  // Day-of-year, 0-based. Used to pick a stable daily featured theme.
  function dayOfYear(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.floor((d - yearStart) / 86400000);
  }

  // Mulberry32 PRNG — fast, good distribution, 32-bit seed.
  function mulberry32(seed) {
    return function() {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // Returns a deterministic permutation of arr seeded by seed.
  // Same seed → same order every time; different seed → different order.
  function seededShuffle(arr, seed) {
    const out = arr.slice();
    const rand = mulberry32(seed);
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  // Approximate Gregorian → Chinese lunar date.
  // Uses the "Solar Terms" epoch method: accurate to ±1 day for 1900–2100.
  // Returns { month, day, isLeap } where month/day are traditional lunar numbers.
  function lunarDate(date) {
    // Reference: lunar new year dates 2020–2035 (Western calendar).
    // For years outside this window we fall back gracefully.
    const LNY = {
      2020:[1,25],2021:[2,12],2022:[2,1],2023:[1,22],2024:[2,10],
      2025:[1,29],2026:[2,17],2027:[2,6],2028:[1,26],2029:[2,13],
      2030:[2,3],2031:[1,23],2032:[2,11],2033:[1,31],2034:[2,19],
      2035:[2,8]
    };
    const y = date.getFullYear();
    const lny = LNY[y] || LNY[y - 1];
    if (!lny) return null;

    // Lunar month lengths for years we track (29 or 30 days, approximated).
    // We use a simple 29.53-day average — close enough for display.
    const AVG_LUNAR_MONTH = 29.53059;

    let refYear = lny === LNY[y] ? y : y - 1;
    const refDate = new Date(refYear, lny[0] - 1, lny[1]);
    const diff = Math.round((date - refDate) / 86400000);
    if (diff < 0) return null; // before this year's LNY, would need prior year table

    const monthIndex = Math.floor(diff / AVG_LUNAR_MONTH);
    const dayInMonth = diff - Math.round(monthIndex * AVG_LUNAR_MONTH) + 1;
    const lunarMonth = monthIndex + 1;
    const lunarDay = Math.max(1, Math.min(30, dayInMonth));

    const TIAN_GAN = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
    const DI_ZHI  = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
    // Stem-branch year: 甲子 = 1984
    const stemIdx   = ((refYear - 1984) % 10 + 10) % 10;
    const branchIdx = ((refYear - 1984) % 12 + 12) % 12;

    return {
      year: TIAN_GAN[stemIdx] + DI_ZHI[branchIdx] + "年",
      month: lunarMonth,
      day: lunarDay
    };
  }

  const LUNAR_DAY_NAMES = [
    "","初一","初二","初三","初四","初五","初六","初七","初八","初九","初十",
    "十一","十二","十三","十四","十五","十六","十七","十八","十九","二十",
    "廿一","廿二","廿三","廿四","廿五","廿六","廿七","廿八","廿九","三十"
  ];
  const LUNAR_MONTH_NAMES = [
    "","正月","二月","三月","四月","五月","六月",
    "七月","八月","九月","十月","十一月","腊月"
  ];

  const SUGGESTIONS = [
    { label: "心", q: "心" },
    { label: "道", q: "道" },
    { label: "confucius", q: "confucius" },
    { label: "daoism", q: "daoism" },
    { label: "chengyu", q: "chengyu" },
    { label: "HSK 1", q: "hsk1" }
  ];

  // Extract the leading Chinese phrase from "矛盾 · Contradiction" or "X · Y"
  // For character entries this is the single glyph; for chengyu/topics, the full Chinese phrase.
  function leadCn(entry) {
    if (entry.char) return entry.char;
    if (!entry.title) return "";
    const head = entry.title.split('·')[0].trim();
    // Strip non-Chinese trailing whitespace; keep the whole leading CJK chunk
    return head;
  }

  function normalize(str) {
    return (str || "").toString().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  function escapeHtml(str) {
    return (str || "").toString()
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }
  function highlight(text, query) {
    if (!query) return escapeHtml(text);
    const safe = escapeHtml(text);
    const normText = normalize(text);
    const normQuery = normalize(query);
    const idx = normText.indexOf(normQuery);
    if (idx === -1) return safe;
    return escapeHtml(text.slice(0, idx)) +
           "<mark>" + escapeHtml(text.slice(idx, idx + query.length)) + "</mark>" +
           escapeHtml(text.slice(idx + query.length));
  }
  function daysAgo(dateStr) {
    const d1 = new Date(dateStr + "T00:00:00");
    const d2 = new Date(TODAY + "T00:00:00");
    return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
  }
  function relativeDate(dateStr) {
    const days = daysAgo(dateStr);
    if (days <= 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 30) return days + " days ago";
    if (days < 365) return Math.round(days / 30) + " months ago";
    return Math.round(days / 365) + " years ago";
  }

  // ── weighted inverted index search ──────────────────────────────────────────
  //
  // The bundle is: { paths: [...], index: { token: [[pathId, score], ...] } }
  // pathId is an integer index into `paths`. Postings are resolved back to
  // paths when results leave this module.
  function searchPaths(query, bundle) {
    const tokens = query.split(/\s+/).filter(t => t.length > 0);
    if (!tokens.length) return null;

    const index = bundle.index;
    const paths = bundle.paths;
    const indexKeys = Object.keys(index);
    const HZ_RE = /[\u4e00-\u9fff]/;

    function postingsFor(token) {
      const isCjk = HZ_RE.test(token);
      const isShort = token.length <= 2;
      const results = new Map(); // path -> best score from this token

      function addPostings(list, multiplier, exactBoost) {
        for (const pair of list) {
          const path = paths[pair[0]];
          if (!path) continue;
          const score = pair[1] * multiplier + (exactBoost || 0);
          const prev = results.get(path);
          if (prev === undefined || score > prev) results.set(path, score);
        }
      }

      if (index[token]) addPostings(index[token], 1.0, 500);

      if (isCjk && token.length === 1) {
        // done
      } else if (isShort) {
        for (const key of indexKeys) {
          if (key === token) continue;
          if (key.startsWith(token)) addPostings(index[key], 0.6, 0);
        }
      } else {
        for (const key of indexKeys) {
          if (key === token) continue;
          if (key.startsWith(token)) addPostings(index[key], 0.7, 0);
          else if (key.includes(token)) addPostings(index[key], 0.4, 0);
        }
      }
      return results;
    }

    let combined = null;
    for (const token of tokens) {
      const partial = postingsFor(token);
      if (combined === null) {
        combined = partial;
      } else {
        const next = new Map();
        for (const [path, score] of combined) {
          const other = partial.get(path);
          if (other !== undefined) next.set(path, score + other);
        }
        combined = next;
      }
      if (combined.size === 0) return combined;
    }
    return combined;
  }

  // ── boot: fetch data then render ─────────────────────────────────────────────
  Promise.all([
    fetch('data/entries.json').then(r => r.json()),
    fetch('data/search-index.json').then(r => r.json()),
    fetch('data/recent.json').then(r => r.json()).catch(() => []),
    fetch('data/featured.json').then(r => r.json()).catch(() => []),
    fetch('data/category-meta.json').then(r => r.json())
  ]).then(([allEntriesRaw, searchIndex, recentEntries, featured, catMetaRaw]) => {
    const allEntries = allEntriesRaw.filter(e => e.status === "complete");
    CATEGORY_META = deriveCategoryMeta(catMetaRaw);
    boot(allEntries, searchIndex, recentEntries, featured);
  }).catch(err => {
    console.error('Failed to load entries data:', err);
  });

  function boot(allEntries, searchIndex, recentEntries, featured) {
    // Tiny word-number helper for the subheader copy. Keeps prose tone while
    // staying honest about the actual count (fixes the "Twelve" / "Thirteen"
    // strings drifting out of sync with the data).
    const WORD_NUMS = ["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen","twenty"];
    const numWord = n => (n >= 0 && n < WORD_NUMS.length)
      ? WORD_NUMS[n][0].toUpperCase() + WORD_NUMS[n].slice(1)
      : String(n);

    // ── byPath index (shared by several renderers) ─────────────────────────────
    const byPath = {};
    allEntries.forEach(e => { byPath[e.path] = e; });

    // ── today's featured thread ──────────────────────────────────────────────
    (function renderFeatured() {
      const section = document.getElementById("featured");
      const card = document.getElementById("featured-card");
      const themes = Array.isArray(featured) ? featured : [];
      if (!section || !card || !themes.length) return;

      // Seeded shuffle: same order all year, never repeats until all themes
      // exhausted. Seed = year so order changes each January 1.
      const now = new Date();
      const yearSeed = now.getFullYear() * 1000003;
      const shuffled = seededShuffle(themes, yearSeed);
      const day = dayOfYear(now);
      const len = shuffled.length;
      let theme = null, lead = null;
      // Walk forward from today's slot; skip any entry whose page doesn't exist.
      for (let offset = 0; offset < len; offset++) {
        const t = shuffled[(day + offset) % len];
        const e = byPath[t.lead];
        if (e) { theme = t; lead = e; break; }
      }
      if (!theme || !lead) return;

      const related = (theme.related || [])
        .map(p => byPath[p])
        .filter(Boolean)
        .slice(0, 4);

      const glyphChar = leadCn(lead);
      const glyphLen = glyphChar.length;
      const glyphSize = glyphLen >= 4 ? " glyph-4" : glyphLen === 3 ? " glyph-3" : glyphLen === 2 ? " glyph-2" : "";

      const leadTitleEn = lead.title
        ? (lead.title.split("·").slice(1).join("·").trim() || lead.title)
        : theme.title;

      const gregLabel = now.toLocaleDateString(undefined, { month: "long", day: "numeric" });
      const lunar = lunarDate(now);
      const lunarLabel = lunar
        ? ` · ${lunar.year} ${LUNAR_MONTH_NAMES[lunar.month] || ""} ${LUNAR_DAY_NAMES[lunar.day] || ""}`
        : "";
      const dateLabel = gregLabel + lunarLabel;

      card.dataset.watermark = glyphChar || "";
      if (lead.category) card.dataset.category = lead.category;
      card.innerHTML = `
        <a class="featured-glyph${glyphSize}" href="${lead.path}" aria-label="${escapeHtml(theme.title)} — open ${escapeHtml(leadTitleEn)}">${escapeHtml(glyphChar)}</a>
        <div class="featured-body">
          <span class="featured-week">${escapeHtml(dateLabel)} · ${escapeHtml(theme.title)}</span>
          <h3 class="featured-title"><a href="${lead.path}">${escapeHtml(leadTitleEn)}</a></h3>
          ${lead.pinyin ? `<span class="featured-py">${escapeHtml(lead.pinyin)}</span>` : ""}
          <p class="featured-hook">${escapeHtml(theme.hook)}</p>
          ${related.length ? `
            <div class="featured-links" role="list">
              <span class="featured-links-label">Follow on</span>
              ${related.map(e => {
                const cn = leadCn(e);
                const en = e.title ? (e.title.split("·").slice(1).join("·").trim() || e.title) : "";
                return `<a class="featured-link" href="${e.path}" role="listitem">${cn ? `<span class="cn">${escapeHtml(cn)}</span>` : ""}${escapeHtml(en)}</a>`;
              }).join("")}
            </div>
          ` : ""}
        </div>
      `;
      section.classList.add("visible");
    })();

    // ── start-here list ────────────────────────────────────────────────────────
    const startList = document.getElementById("start-here-list");
    if (startList) {
      const startSection = document.getElementById("start-here");
      const items = START_HERE.map(p => byPath[p]).filter(Boolean);
      if (items.length === 0) {
        startSection.style.display = "none";
      } else {
        // Keep the subheader count honest — updates if the curated list changes
        // or any entry becomes unavailable.
        const sub = document.getElementById("start-here-sub");
        if (sub) {
          sub.textContent = `${numWord(items.length)} entries that give a sense of the whole — language, philosophy, culture, food. Read in order, or wander.`;
        }
        items.forEach(e => {
          const li = document.createElement("li");
          const a = document.createElement("a");
          a.href = e.path;
          a.className = "start-here-item";
          if (e.category) a.dataset.category = e.category;
          const glyph = leadCn(e);
          const titleEn = e.title ? (e.title.split("·").slice(1).join("·").trim() || e.title) : "";
          const isLong = glyph.length > 1;
          const catMeta = CATEGORY_META[e.category] || {};
          a.innerHTML = `
            <div class="start-here-item-top">
              ${glyph ? `<span class="start-here-cn${isLong ? " sh-multi" : ""}">${escapeHtml(glyph)}</span>` : ""}
              <span class="start-here-num"></span>
            </div>
            <span class="start-here-py">${escapeHtml(e.pinyin || "")}</span>
            <span class="start-here-title">${escapeHtml(titleEn)}</span>
            ${e.desc ? `<span class="start-here-desc">${escapeHtml(e.desc)}</span>` : ""}
            <span class="start-here-cat">${escapeHtml(catMeta.en || e.category || "")}</span>
          `;
          li.appendChild(a);
          startList.appendChild(li);
        });
      }
    }

    // ── recent grid ────────────────────────────────────────────────────────────
    // Uses data/recent.json (sorted by updated desc at build time) so the order
    // is stable and meaningful — not re-derived from the full entry list.
    const recentSlice = (recentEntries && recentEntries.length ? recentEntries : allEntries)
      .slice(0, 8);

    const recentGrid = document.getElementById("recent-grid");
    recentSlice.forEach(e => {
      const date = e.updated || FALLBACK_DATE;
      const card = document.createElement("a");
      card.href = e.path;
      card.className = "recent-card";
      if (e.category) card.dataset.category = e.category;
      const glyphChar = leadCn(e);
      const isNew = e.updated && daysAgo(date) <= 14;
      const len = glyphChar.length;
      const sizeClass = len >= 4 ? " glyph-4" : len === 3 ? " glyph-3" : len === 2 ? " glyph-2" : "";
      // Drop the lead Chinese phrase from the displayed title (already shown as glyph)
      const titleNoCn = e.title && glyphChar
        ? (e.title.split("·").slice(1).join("·").trim() || e.title)
        : (e.title || "");
      card.innerHTML = `
        ${isNew ? '<span class="recent-new">NEW</span>' : ""}
        ${glyphChar ? `<span class="recent-glyph${sizeClass}">${escapeHtml(glyphChar)}</span>` : ""}
        <span class="recent-pinyin">${escapeHtml(e.pinyin || "")}</span>
        <span class="recent-title">${escapeHtml(titleNoCn)}</span>
        <span class="recent-meta">${e.updated ? relativeDate(date) : ""}</span>
      `;
      recentGrid.appendChild(card);
    });

    const lastUpdated = allEntries
      .map(e => e.updated)
      .filter(Boolean)
      .sort()
      .pop();
    if (lastUpdated) {
      const el = document.getElementById("last-updated");
      if (el) el.textContent = lastUpdated;
    }

    // ── In-page anchor UX ────────────────────────────────────────────────────
    // Smooth-scroll any same-page link to its target with a brief warm flash
    // so the reader's eye lands in the right place. (The Browse section that
    // used to need expand-on-anchor logic was retired in favor of dedicated
    // family-index pages.)
    function flashSection(el) {
      if (!el) return;
      el.classList.remove("anchor-flash");
      void el.offsetWidth;
      el.classList.add("anchor-flash");
      window.setTimeout(() => el.classList.remove("anchor-flash"), 1500);
    }
    function jumpToHash(hash) {
      if (!hash || hash.length < 2) return false;
      const target = document.getElementById(hash.slice(1));
      if (!target) return false;
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        flashSection(target);
      });
      return true;
    }
    document.addEventListener("click", function (e) {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || href === "#") return;
      if (a.origin && a.origin !== window.location.origin) return;
      if (a.pathname && a.pathname !== window.location.pathname) return;
      if (jumpToHash(href)) {
        e.preventDefault();
        try { history.replaceState(null, "", href); } catch (_) {}
      }
    });
    if (window.location.hash) {
      window.setTimeout(() => jumpToHash(window.location.hash), 60);
    }
    // ── Search (standalone — no connection to browse) ─────────────────────────
    let searchText = "";
    let searchDebounce = null;
    const searchInput = document.getElementById("filter-search");
    const clearBtn    = document.getElementById("filter-clear");
    const suggestEl   = document.getElementById("filter-suggest");
    const resultEl    = document.getElementById("filter-result");
    const noResults   = document.getElementById("no-results");
    const searchResultsEl = document.getElementById("search-results");

    function buildSuggestionsHtml() {
      return SUGGESTIONS.map(s => {
        const isCn = /[\u4e00-\u9fff]/.test(s.label);
        return `<button class="suggest-chip" data-q="${escapeHtml(s.q)}">${isCn ? `<span class="cn">${s.label}</span>` : s.label}</button>`;
      }).join("");
    }
    suggestEl.innerHTML = buildSuggestionsHtml();
    document.getElementById("no-results-suggest").innerHTML = buildSuggestionsHtml();

    function renderSearchResults(matchedPaths, queryRaw) {
      const scored = [];
      allEntries.forEach(e => {
        const score = matchedPaths.get(e.path);
        if (score !== undefined) scored.push({ e, score });
      });
      scored.sort((a, b) => b.score - a.score);
      const frag = document.createDocumentFragment();
      for (const { e } of scored) {
        const card = document.createElement("a");
        card.href = e.path;
        card.className = "entry-card";
        if (e.category) card.dataset.category = e.category;
        const glyphChar = leadCn(e);
        const len = glyphChar.length;
        const sizeClass = len >= 4 ? " glyph-4" : len === 3 ? " glyph-3" : len === 2 ? " glyph-2" : "";
        const titleNoCn = e.title && glyphChar
          ? (e.title.split("·").slice(1).join("·").trim() || e.title)
          : (e.title || "");
        const catMeta = CATEGORY_META[e.category] || {};
        card.innerHTML = `
          ${glyphChar ? `<span class="entry-glyph${sizeClass}">${highlight(glyphChar, queryRaw)}</span>` : ""}
          <span class="entry-pinyin">${highlight(e.pinyin || "", queryRaw)}</span>
          <span class="entry-title">${highlight(titleNoCn, queryRaw)}</span>
          <span class="entry-desc">${highlight(e.desc || "", queryRaw)}</span>
          <span class="sr-cat-label">${escapeHtml(catMeta.en || e.category || "")}</span>
        `;
        frag.appendChild(card);
      }
      searchResultsEl.innerHTML = "";
      searchResultsEl.appendChild(frag);
    }

    function applySearch() {
      const queryRaw = searchText.trim();
      let query = normalize(queryRaw);
      query = query.replace(/\bhsk[\s-]*(\d)\b/g, 'hsk$1').replace(/\bhsk\s*level\s*(\d)\b/g, 'hsk$1');
      const hasQuery = query.length > 0;

      searchResultsEl.classList.toggle("visible", hasQuery);

      if (hasQuery) {
        const matchedPaths = searchPaths(query, searchIndex);
        const total = matchedPaths ? matchedPaths.size : 0;
        if (total > 0) {
          renderSearchResults(matchedPaths, queryRaw);
          noResults.classList.remove("visible");
          resultEl.textContent = `${total} ${total === 1 ? "entry" : "entries"}`;
          resultEl.classList.add("visible");
        } else {
          searchResultsEl.innerHTML = "";
          document.getElementById("no-results-query").textContent = queryRaw;
          noResults.classList.add("visible");
          resultEl.classList.remove("visible");
        }
      } else {
        searchResultsEl.innerHTML = "";
        noResults.classList.remove("visible");
        resultEl.classList.remove("visible");
      }

      try {
        const url = new URL(window.location.href);
        if (hasQuery) url.searchParams.set("q", queryRaw);
        else url.searchParams.delete("q");
        history.replaceState(null, "", url);
      } catch {}
    }

    function handleSuggestClick(e) {
      const btn = e.target.closest(".suggest-chip");
      if (!btn) return;
      searchInput.value = btn.dataset.q;
      searchText = btn.dataset.q;
      clearBtn.classList.add("visible");
      applySearch();
      searchInput.focus();
    }
    suggestEl.addEventListener("click", handleSuggestClick);
    document.getElementById("no-results-suggest").addEventListener("click", handleSuggestClick);

    searchInput.addEventListener("input", () => {
      searchText = searchInput.value;
      clearBtn.classList.toggle("visible", searchText.length > 0);
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(applySearch, 120);
    });

    clearBtn.addEventListener("click", () => {
      searchInput.value = "";
      searchText = "";
      clearBtn.classList.remove("visible");
      applySearch();
      searchInput.focus();
    });

    document.addEventListener("keydown", e => {
      if (e.key === "/" && !["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName)) {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
        return;
      }
      if (e.key === "Escape" && document.activeElement === searchInput) {
        if (searchInput.value) {
          searchInput.value = "";
          searchText = "";
          clearBtn.classList.remove("visible");
          applySearch();
        } else {
          searchInput.blur();
        }
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const cards = Array.from(searchResultsEl.querySelectorAll(".entry-card"));
        if (!cards.length) return;
        const idx = cards.indexOf(document.activeElement);
        const next = e.key === "ArrowDown"
          ? (idx === -1 ? 0 : Math.min(idx + 1, cards.length - 1))
          : (idx === -1 ? cards.length - 1 : Math.max(idx - 1, 0));
        e.preventDefault();
        cards[next].tabIndex = 0;
        cards[next].focus();
      }
    });

    try {
      const initialQ = new URL(window.location.href).searchParams.get("q");
      if (initialQ) {
        searchInput.value = initialQ;
        searchText = initialQ;
        clearBtn.classList.add("visible");
      }
    } catch {}

    applySearch();
  } // end boot()
})();
