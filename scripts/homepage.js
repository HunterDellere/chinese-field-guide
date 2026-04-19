(function () {
  const CATEGORY_META = {
    characters: { cn: "字",   py: "zì",       en: "Characters",         color: "var(--red)",        desc: "Single glyphs. Etymology, decomposition, daily use." },
    vocab:      { cn: "词",   py: "cí",       en: "Vocabulary",         color: "var(--ochre)",      desc: "Words and concepts that carry cultural weight." },
    grammar:    { cn: "法",   py: "fǎ",       en: "Grammar",            color: "var(--teal-ink)",   desc: "Particles, structures, and the joints of the language." },
    religion:   { cn: "宗教", py: "zōngjiào", en: "Religion",           color: "var(--red)",        desc: "Buddhism, Daoism, folk practice, ancestor rites." },
    philosophy: { cn: "哲学", py: "zhéxué",   en: "Philosophy",         color: "var(--sienna)",     desc: "The hundred schools and what they argued about." },
    history:    { cn: "历史", py: "lìshǐ",    en: "History",            color: "var(--ochre)",      desc: "Dynasties, ruptures, and the long arc." },
    geography:  { cn: "地理", py: "dìlǐ",     en: "Geography",          color: "var(--teal-ink)",   desc: "Places, dialects, and the shape of the land." },
    culture:    { cn: "文化", py: "wénhuà",   en: "Culture",            color: "var(--red)",        desc: "What people make and how they live with it." },
    culinary:   { cn: "饮食", py: "yǐnshí",   en: "Culinary",           color: "var(--sienna)",     desc: "What is cooked, drunk, and shared at the table." },
    arts:       { cn: "艺文", py: "yìwén",    en: "Arts & Literature",  color: "var(--violet-ink)", desc: "Poetry, painting, calligraphy, opera." },
    science:    { cn: "科技", py: "kējì",     en: "Science & Medicine", color: "var(--teal-ink)",   desc: "Astronomy, medicine, and technology before modernity." },
    daily:      { cn: "日常", py: "rìcháng",  en: "Everyday Life",      color: "var(--ochre)",      desc: "Names, numbers, gifts, gestures, taboos." },
    chengyu:    { cn: "成语", py: "chéngyǔ",  en: "Chengyu",            color: "var(--red)",        desc: "Four-character idioms. Compressed wisdom from classical texts." }
  };

  const CAT_ORDER = [
    "characters","vocab","grammar","chengyu",
    "religion","philosophy",
    "history","geography",
    "culture","culinary",
    "arts","science","daily"
  ];

  const TODAY = new Date().toISOString().slice(0, 10);

  // Curated reading order: an opinionated tour that gives a first-time reader
  // a sense of the whole. Match by exact path so it stays stable across rebuilds.
  const START_HERE = [
    "pages/characters/ren2_人.html",
    "pages/characters/jia1_家.html",
    "pages/grammar/le_了.html",
    "pages/vocab/yinyang_阴阳.html",
    "pages/vocab/mianzi_面子.html",
    "pages/philosophy/topic_kongzi.html",
    "pages/culture/topic_chunjie.html",
    "pages/culinary/topic_jiaozi.html",
    "pages/chengyu/maodun_矛盾.html",
    "pages/arts/topic_tangshi.html"
  ];

  const SUGGESTIONS = [
    { label: "心", q: "心" },
    { label: "气", q: "气" },
    { label: "道", q: "道" },
    { label: "guanxi", q: "guanxi" },
    { label: "yinyang", q: "yinyang" },
    { label: "hsk 1", q: "hsk 1" }
  ];

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

  // ── inverted index search ────────────────────────────────────────────────────
  // searchIndex: { token: [path, ...] }
  // pathSet: for a multi-word query, intersect results per token
  function searchPaths(query, searchIndex) {
    const tokens = query.split(/\s+/).filter(t => t.length > 0);
    if (!tokens.length) return null; // null = no filter

    let result = null;
    for (const token of tokens) {
      // Collect all index keys that contain this token as a substring
      const matches = new Set();
      for (const key of Object.keys(searchIndex)) {
        if (key.includes(token)) {
          for (const path of searchIndex[key]) matches.add(path);
        }
      }
      if (result === null) {
        result = matches;
      } else {
        // Intersect: keep only paths in both sets
        for (const path of result) {
          if (!matches.has(path)) result.delete(path);
        }
      }
      if (result.size === 0) return result;
    }
    return result;
  }

  // ── boot: fetch data then render ─────────────────────────────────────────────
  Promise.all([
    fetch('data/entries.json').then(r => r.json()),
    fetch('data/search-index.json').then(r => r.json())
  ]).then(([allEntriesRaw, searchIndex]) => {
    const allEntries = allEntriesRaw.filter(e => e.status === "complete");
    boot(allEntries, searchIndex);
  }).catch(err => {
    console.error('Failed to load entries data:', err);
  });

  function boot(allEntries, searchIndex) {
    const groups = {};
    CAT_ORDER.forEach(k => groups[k] = []);
    allEntries.forEach(e => { if (groups[e.category] !== undefined) groups[e.category].push(e); });
    const activeCategoriesCount = CAT_ORDER.filter(k => groups[k].length > 0).length;

    document.getElementById("stats").innerHTML =
      `<strong>${allEntries.length}</strong> entries &nbsp;·&nbsp; <strong>${activeCategoriesCount}</strong> sections &nbsp;·&nbsp; updated <strong>${TODAY}</strong>`;

    // ── start-here list ────────────────────────────────────────────────────────
    const byPath = {};
    allEntries.forEach(e => { byPath[e.path] = e; });
    const startList = document.getElementById("start-here-list");
    if (startList) {
      const startSection = document.getElementById("start-here");
      const items = START_HERE.map(p => byPath[p]).filter(Boolean);
      if (items.length === 0) {
        startSection.style.display = "none";
      } else {
        items.forEach(e => {
          const li = document.createElement("li");
          const a = document.createElement("a");
          a.href = e.path;
          a.className = "start-here-item";
          const glyph = e.char || (e.title ? e.title.charAt(0) : "");
          const titleEn = e.title ? (e.title.split("·").slice(1).join("·").trim() || e.title) : "";
          a.innerHTML = `
            <span class="start-here-num"></span>
            ${glyph ? `<span class="start-here-cn">${escapeHtml(glyph)}</span>` : ""}
            <span class="start-here-body">
              <span class="start-here-title">${escapeHtml(titleEn)}</span>
              <span class="start-here-py">${escapeHtml(e.pinyin || "")}</span>
            </span>
          `;
          li.appendChild(a);
          startList.appendChild(li);
        });
      }
    }

    // ── overview grid ──────────────────────────────────────────────────────────
    const overviewGrid = document.getElementById("overview-grid");
    CAT_ORDER.forEach(key => {
      const meta = CATEGORY_META[key];
      const count = groups[key].length;
      const cell = document.createElement(count > 0 ? "a" : "div");
      if (count > 0) cell.href = "#cat-" + key;
      cell.className = "overview-cell";
      cell.innerHTML = `
        <span class="overview-glyph" style="color:${meta.color}">${meta.cn}</span>
        <div class="overview-body">
          <span class="overview-name">${meta.en}</span>
          <span class="overview-py">${meta.py}</span>
          <span class="overview-desc">${meta.desc}</span>
          <span class="overview-count ${count === 0 ? "empty" : ""}">${count > 0 ? count + (count === 1 ? " entry" : " entries") : "in progress"}</span>
        </div>
      `;
      overviewGrid.appendChild(cell);
    });

    // ── recent grid ────────────────────────────────────────────────────────────
    const FALLBACK_DATE = "2020-01-01";
    const recentSorted = allEntries
      .slice()
      .sort((a, b) => {
        const da = a.updated || FALLBACK_DATE;
        const db = b.updated || FALLBACK_DATE;
        return db.localeCompare(da) || a.title.localeCompare(b.title);
      })
      .slice(0, 6);

    const recentGrid = document.getElementById("recent-grid");
    recentSorted.forEach(e => {
      const date = e.updated || FALLBACK_DATE;
      const card = document.createElement("a");
      card.href = e.path;
      card.className = "recent-card";
      const glyphChar = e.char || (e.title ? e.title.charAt(0) : "");
      const isNew = e.updated && daysAgo(date) <= 14;
      card.innerHTML = `
        ${isNew ? '<span class="recent-new">NEW</span>' : ""}
        ${glyphChar ? `<span class="recent-glyph">${escapeHtml(glyphChar)}</span>` : ""}
        <span class="recent-pinyin">${escapeHtml(e.pinyin || "")}</span>
        <span class="recent-title">${escapeHtml(e.title || "")}</span>
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

    // ── category groups ────────────────────────────────────────────────────────
    const LS_KEY = "cfg.collapsed.v2";
    function loadCollapsed() {
      try { return new Set(JSON.parse(localStorage.getItem(LS_KEY)) || []); }
      catch { return new Set(); }
    }
    function saveCollapsed(set) {
      try { localStorage.setItem(LS_KEY, JSON.stringify([...set])); } catch {}
    }
    let collapsedSet = loadCollapsed();

    const container = document.getElementById("categories");
    const catGroupMap = {};

    CAT_ORDER.forEach(key => {
      const entries = groups[key];
      if (!entries.length) return;
      const meta = CATEGORY_META[key];

      const group = document.createElement("section");
      group.className = "cat-group" + (collapsedSet.has(key) ? " collapsed" : "");
      group.id = "cat-" + key;
      group.dataset.category = key;

      const head = document.createElement("button");
      head.className = "cat-head";
      head.setAttribute("aria-expanded", collapsedSet.has(key) ? "false" : "true");
      head.innerHTML = `
        <span class="cat-caret">▾</span>
        <span class="sh-cn" style="color:${meta.color}">${meta.cn}</span>
        <span class="sh-py">${meta.py}</span>
        <span class="sh-en">${meta.en}</span>
        <span class="sh-rule"></span>
        <span class="cat-count">${entries.length} ${entries.length === 1 ? "entry" : "entries"}</span>
      `;
      head.addEventListener("click", () => toggleCategory(key, group, head));

      const grid = document.createElement("div");
      grid.className = "entry-grid";

      group.appendChild(head);
      group.appendChild(grid);
      container.appendChild(group);

      const cardEls = [];
      // matchState[i]: true = matched, false = hidden; undefined = not yet rendered
      const matchState = [];

      entries.forEach(e => {
        const card = document.createElement("a");
        card.href = e.path;
        card.className = "entry-card";
        card.tabIndex = -1;
        grid.appendChild(card);
        cardEls.push(card);
        matchState.push(undefined);
      });

      catGroupMap[key] = { groupEl: group, gridEl: grid, headEl: head, cardEls, entries, matchState };
      // Initial render: all visible, no query
      renderCardsForGroup(key, "", null);
    });

    // Render cards for a group. Only re-renders cards whose match state changed.
    // matchedPaths: Set<path> | null (null = no filter, all shown)
    function renderCardsForGroup(key, queryRaw, matchedPaths) {
      const g = catGroupMap[key];
      if (!g) return;
      const hasQuery = matchedPaths !== null;

      // Batch highlight renders into rAF
      const toHighlight = [];

      g.cardEls.forEach((card, i) => {
        const e = g.entries[i];
        const nowMatched = !hasQuery || matchedPaths.has(e.path);
        const stateChanged = g.matchState[i] !== nowMatched;

        if (!nowMatched) {
          if (stateChanged) {
            card.classList.add("hidden");
            g.matchState[i] = false;
          }
          return;
        }

        card.classList.remove("hidden");

        if (stateChanged || (hasQuery !== (g.matchState[i] === true && queryRaw !== card.dataset.lastQuery))) {
          g.matchState[i] = true;
          card.dataset.lastQuery = queryRaw;
          toHighlight.push({ card, e, queryRaw });
        }
      });

      if (toHighlight.length) {
        requestAnimationFrame(() => {
          for (const { card, e, queryRaw: q } of toHighlight) {
            const glyphChar = e.char || (e.title ? e.title.charAt(0) : "");
            card.innerHTML = `
              ${glyphChar ? `<span class="entry-glyph">${highlight(glyphChar, q)}</span>` : ""}
              <span class="entry-pinyin">${highlight(e.pinyin || "", q)}</span>
              <span class="entry-title">${highlight(e.title || "", q)}</span>
              <span class="entry-desc">${highlight(e.desc || "", q)}</span>
            `;
          }
        });
      }
    }

    function toggleCategory(key, groupEl, headEl, forceExpand) {
      const isCollapsed = groupEl.classList.contains("collapsed");
      const shouldCollapse = forceExpand === undefined ? !isCollapsed : !forceExpand;
      groupEl.classList.toggle("collapsed", shouldCollapse);
      headEl.setAttribute("aria-expanded", shouldCollapse ? "false" : "true");
      if (shouldCollapse) collapsedSet.add(key); else collapsedSet.delete(key);
      saveCollapsed(collapsedSet);
    }

    document.getElementById("expand-all").addEventListener("click", () => {
      Object.keys(catGroupMap).forEach(key => {
        const g = catGroupMap[key];
        toggleCategory(key, g.groupEl, g.headEl, true);
      });
    });
    document.getElementById("collapse-all").addEventListener("click", () => {
      Object.keys(catGroupMap).forEach(key => {
        const g = catGroupMap[key];
        toggleCategory(key, g.groupEl, g.headEl, false);
      });
    });
    document.getElementById("mobile-toggle-all").addEventListener("click", function () {
      const anyExpanded = Object.values(catGroupMap).some(g => !g.groupEl.classList.contains("collapsed"));
      Object.keys(catGroupMap).forEach(key => {
        const g = catGroupMap[key];
        toggleCategory(key, g.groupEl, g.headEl, !anyExpanded);
      });
      this.textContent = anyExpanded ? "Expand all ▸" : "Collapse all ▾";
    });

    // ── filter / search ────────────────────────────────────────────────────────
    let filterText = "";
    let debounceTimer = null;

    function applyFilters() {
      const queryRaw = filterText.trim();
      const query = normalize(queryRaw);
      const hasQuery = query.length > 0;

      // Inverted index lookup: O(tokens × index_size) not O(N × entries)
      const matchedPaths = hasQuery ? searchPaths(query, searchIndex) : null;

      let totalVisible = 0;
      let catsWithVisible = 0;

      Object.keys(catGroupMap).forEach(key => {
        const g = catGroupMap[key];

        renderCardsForGroup(key, hasQuery ? queryRaw : "", matchedPaths);

        const catVisible = hasQuery
          ? g.entries.filter(e => matchedPaths.has(e.path)).length
          : g.entries.length;

        const showGroup = !hasQuery || catVisible > 0;
        g.groupEl.classList.toggle("hidden", !showGroup);

        if (hasQuery && catVisible > 0) {
          g.groupEl.classList.remove("collapsed");
          g.headEl.setAttribute("aria-expanded", "true");
        } else if (!hasQuery) {
          const shouldBeCollapsed = collapsedSet.has(key);
          g.groupEl.classList.toggle("collapsed", shouldBeCollapsed);
          g.headEl.setAttribute("aria-expanded", shouldBeCollapsed ? "false" : "true");
        }

        if (catVisible > 0) catsWithVisible++;
        totalVisible += catVisible;
      });

      const resultEl = document.getElementById("filter-result");
      if (hasQuery) {
        resultEl.textContent = `${totalVisible} ${totalVisible === 1 ? "entry" : "entries"} across ${catsWithVisible} ${catsWithVisible === 1 ? "section" : "sections"}`;
        resultEl.classList.add("visible");
      } else {
        resultEl.classList.remove("visible");
      }

      const noResults = document.getElementById("no-results");
      if (hasQuery && totalVisible === 0) {
        document.getElementById("no-results-query").textContent = queryRaw;
        noResults.classList.add("visible");
      } else {
        noResults.classList.remove("visible");
      }

      try {
        const url = new URL(window.location.href);
        if (hasQuery) url.searchParams.set("q", queryRaw);
        else url.searchParams.delete("q");
        history.replaceState(null, "", url);
      } catch {}
    }

    const searchInput = document.getElementById("filter-search");
    const clearBtn = document.getElementById("filter-clear");
    const suggestEl = document.getElementById("filter-suggest");

    function buildSuggestionsHtml(label) {
      return `<span class="suggest-label">${label}</span>` + SUGGESTIONS.map(s => {
        const isCn = /[\u4e00-\u9fff]/.test(s.label);
        return `<button class="suggest-chip" data-q="${escapeHtml(s.q)}">${isCn ? `<span class="cn">${s.label}</span>` : s.label}</button>`;
      }).join("");
    }
    suggestEl.innerHTML = buildSuggestionsHtml("try");
    document.getElementById("no-results-suggest").innerHTML = buildSuggestionsHtml("try");

    // ── HSK filter chips ──────────────────────────────────────────────────────
    const hskChipsEl = document.getElementById("hsk-chips");
    if (hskChipsEl) {
      const levels = [1, 2, 3, 4, 5, 6];
      hskChipsEl.innerHTML =
        `<span class="hsk-chips-label">HSK</span>` +
        levels.map(n =>
          `<button class="hsk-chip" data-hsk="${n}" type="button" aria-pressed="false">${n}</button>`
        ).join("") +
        `<button class="hsk-chip" data-hsk="" type="button" aria-pressed="false">All</button>`;

      hskChipsEl.addEventListener("click", e => {
        const btn = e.target.closest(".hsk-chip");
        if (!btn) return;
        const level = btn.dataset.hsk;
        const isActive = btn.classList.contains("active");
        hskChipsEl.querySelectorAll(".hsk-chip").forEach(b => {
          b.classList.remove("active");
          b.setAttribute("aria-pressed", "false");
        });
        if (level && !isActive) {
          btn.classList.add("active");
          btn.setAttribute("aria-pressed", "true");
          searchInput.value = "hsk " + level;
        } else {
          searchInput.value = "";
        }
        filterText = searchInput.value;
        clearBtn.classList.toggle("visible", filterText.length > 0);
        applyFilters();
      });
    }

    function handleSuggestClick(e) {
      const btn = e.target.closest(".suggest-chip");
      if (!btn) return;
      searchInput.value = btn.dataset.q;
      filterText = btn.dataset.q;
      clearBtn.classList.add("visible");
      applyFilters();
      searchInput.focus();
    }
    suggestEl.addEventListener("click", handleSuggestClick);
    document.getElementById("no-results-suggest").addEventListener("click", handleSuggestClick);

    searchInput.addEventListener("input", () => {
      filterText = searchInput.value;
      clearBtn.classList.toggle("visible", filterText.length > 0);
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(applyFilters, 120);
    });
    searchInput.addEventListener("focus", () => {
      if (!searchInput.value) suggestEl.classList.add("visible");
    });
    searchInput.addEventListener("blur", () => {
      setTimeout(() => suggestEl.classList.remove("visible"), 180);
    });

    clearBtn.addEventListener("click", () => {
      searchInput.value = "";
      filterText = "";
      clearBtn.classList.remove("visible");
      applyFilters();
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
          filterText = "";
          clearBtn.classList.remove("visible");
          applyFilters();
        } else {
          searchInput.blur();
        }
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const visibleCards = Array.from(document.querySelectorAll(".entry-card:not(.hidden)"));
        if (!visibleCards.length) return;
        const active = document.activeElement;
        const idx = visibleCards.indexOf(active);
        let nextIdx;
        if (idx === -1) {
          nextIdx = e.key === "ArrowDown" ? 0 : visibleCards.length - 1;
        } else {
          nextIdx = e.key === "ArrowDown" ? Math.min(idx + 1, visibleCards.length - 1) : Math.max(idx - 1, 0);
        }
        e.preventDefault();
        visibleCards[nextIdx].tabIndex = 0;
        visibleCards[nextIdx].focus();
      }
    });

    try {
      const initialQ = new URL(window.location.href).searchParams.get("q");
      if (initialQ) {
        searchInput.value = initialQ;
        filterText = initialQ;
        clearBtn.classList.add("visible");
      }
    } catch {}

    applyFilters();
  } // end boot()
})();
