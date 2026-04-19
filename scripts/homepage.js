(function () {
  const CATEGORY_META = {
    characters: { cn: "字",   py: "zì",       en: "Characters",         color: "var(--cat-characters)", desc: "Single glyphs. Etymology, decomposition, daily use." },
    vocab:      { cn: "词",   py: "cí",       en: "Vocabulary",         color: "var(--cat-vocab)",      desc: "Words and concepts that carry cultural weight." },
    grammar:    { cn: "法",   py: "fǎ",       en: "Grammar",            color: "var(--cat-grammar)",    desc: "Particles, structures, and the joints of the language." },
    religion:   { cn: "宗教", py: "zōngjiào", en: "Religion",           color: "var(--cat-religion)",   desc: "Buddhism, Daoism, folk practice, ancestor rites." },
    philosophy: { cn: "哲学", py: "zhéxué",   en: "Philosophy",         color: "var(--cat-philosophy)", desc: "The hundred schools and what they argued about." },
    history:    { cn: "历史", py: "lìshǐ",    en: "History",            color: "var(--cat-history)",    desc: "Dynasties, ruptures, and the long arc." },
    geography:  { cn: "地理", py: "dìlǐ",     en: "Geography",          color: "var(--cat-geography)",  desc: "Places, dialects, and the shape of the land." },
    culture:    { cn: "文化", py: "wénhuà",   en: "Culture",            color: "var(--cat-culture)",    desc: "What people make and how they live with it." },
    culinary:   { cn: "饮食", py: "yǐnshí",   en: "Culinary",           color: "var(--cat-culinary)",   desc: "What is cooked, drunk, and shared at the table." },
    arts:       { cn: "艺文", py: "yìwén",    en: "Arts & Literature",  color: "var(--cat-arts)",       desc: "Poetry, painting, calligraphy, opera." },
    science:    { cn: "科技", py: "kējì",     en: "Science & Medicine", color: "var(--cat-science)",    desc: "Astronomy, medicine, and technology before modernity." },
    daily:      { cn: "日常", py: "rìcháng",  en: "Everyday Life",      color: "var(--cat-daily)",      desc: "Names, numbers, gifts, gestures, taboos." },
    chengyu:    { cn: "成语", py: "chéngyǔ",  en: "Chengyu",            color: "var(--cat-chengyu)",    desc: "Four-character idioms. Compressed wisdom from classical texts." }
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

  // Weekly featured themes. Rotation: ISO-week index modulo themes.length.
  // Each week surfaces one theme as the lead, plus its companion entries.
  // Paths must exist in entries.json; missing items are filtered at render time.
  const FEATURED_WEEKLY = [
    {
      slug: "the-way",
      title: "The Way",
      hook: "道 is the oldest metaphor in Chinese thought — a road you walk and a pattern the world follows. A week to sit with it, from Laozi's paradoxes to the Daoist temples that keep the image alive.",
      lead: "pages/characters/dao4_道.html",
      related: ["pages/philosophy/topic_laozi.html", "pages/philosophy/topic_zhuangzi.html", "pages/religion/topic_daojiao.html"]
    },
    {
      slug: "the-heart",
      title: "The Heart-Mind",
      hook: "心 is both organ and consciousness — the seat of feeling and the seat of thought, inseparable in Chinese. Read it as a character, then read what Mencius and the Neo-Confucians made of it.",
      lead: "pages/characters/xin1_心.html",
      related: ["pages/characters/gan3_感.html", "pages/philosophy/topic_mengzi.html", "pages/philosophy/topic_xinxue.html"]
    },
    {
      slug: "spring-festival",
      title: "Spring Festival",
      hook: "春节 is the hinge of the Chinese year. A week on how it is kept — dumplings folded by hand, red envelopes tucked under doors, the zodiac turning over.",
      lead: "pages/culture/topic_chunjie.html",
      related: ["pages/culture/topic_hongbao.html", "pages/culinary/topic_jiaozi.html", "pages/culture/topic_shengxiao.html"]
    },
    {
      slug: "yin-yang",
      title: "Yin & Yang",
      hook: "阴阳 is not a duality of good and evil — it's a grammar of complementary pairs that runs through medicine, cosmology, and the calendar. Follow it into the five phases and the solar terms.",
      lead: "pages/vocab/yinyang_阴阳.html",
      related: ["pages/philosophy/topic_yinyang_wuxing.html", "pages/science/topic_zhongyi.html", "pages/science/topic_jieqi.html"]
    },
    {
      slug: "tang-poetry",
      title: "Tang Poetry",
      hook: "唐诗 is the high-water mark of the Chinese poetic tradition. A week on the Tang dynasty that produced it, the Song lyrics that answered it, and the calligraphy that still copies its lines.",
      lead: "pages/arts/topic_tangshi.html",
      related: ["pages/history/topic_tangchao.html", "pages/arts/topic_songci.html", "pages/arts/topic_shufa.html"]
    },
    {
      slug: "face",
      title: "Face & Relation",
      hook: "面子 and 关系 are the two concepts most often mistranslated out of Chinese. A week on the social grammar they encode — and the everyday manners that keep both intact.",
      lead: "pages/vocab/mianzi_面子.html",
      related: ["pages/vocab/guanxi_关系.html", "pages/vocab/keqi_客气.html", "pages/daily/topic_qingke.html"]
    },
    {
      slug: "confucius",
      title: "Confucius",
      hook: "孔子 shaped two thousand years of Chinese moral thought with a small book of conversations. A week on what he actually taught, and the students and critics who came after.",
      lead: "pages/philosophy/topic_kongzi.html",
      related: ["pages/philosophy/topic_mengzi.html", "pages/philosophy/topic_xunzi.html", "pages/religion/topic_rujia.html"]
    },
    {
      slug: "tea",
      title: "Tea",
      hook: "茶 is how China learned to treat drinking as an art. A week on the leaf, the ceremony, the regional cuisines it threads through, and the herbal tradition that first noticed it.",
      lead: "pages/culinary/topic_cha.html",
      related: ["pages/culture/topic_cha_wenhua.html", "pages/science/topic_bencao.html", "pages/culinary/topic_caixi.html"]
    },
    {
      slug: "chan",
      title: "Chan Buddhism",
      hook: "禅 is what crossed the sea to become Zen. A week on the meditative school at home — its Pure Land cousin, its Buddhist roots, and the character 佛 that names them all.",
      lead: "pages/religion/topic_chan.html",
      related: ["pages/religion/topic_fojiao.html", "pages/religion/topic_jingtu.html", "pages/characters/fo2_佛.html"]
    },
    {
      slug: "first-emperor",
      title: "The First Emperor",
      hook: "秦始皇 unified the writing system, the roads, and the weights — and built a tomb guarded by an army of clay. A week on the dynasty he founded and the Legalist thinkers who armed him.",
      lead: "pages/history/topic_qin_shihuang.html",
      related: ["pages/history/topic_xia_shang_zhou.html", "pages/history/topic_hanchao.html", "pages/philosophy/topic_fajia.html"]
    },
    {
      slug: "contradiction",
      title: "Chengyu — Contradiction",
      hook: "矛盾 literally means 'spear and shield' — a merchant who claimed both invincible weapon and impenetrable defence. A week inside four-character idioms and the Warring States parables that shaped them.",
      lead: "pages/chengyu/maodun_矛盾.html",
      related: ["pages/chengyu/huashetianzu_画蛇添足.html", "pages/chengyu/saiwengshima_塞翁失马.html", "pages/chengyu/yugongyishan_愚公移山.html"]
    },
    {
      slug: "dumplings",
      title: "Dumplings & the Table",
      hook: "饺子 are pleated for family and eaten at midnight on New Year's Eve. A week around the Chinese table — noodles, tofu, and the shared hotpot that still defines hospitality.",
      lead: "pages/culinary/topic_jiaozi.html",
      related: ["pages/culinary/topic_miantiao.html", "pages/culinary/topic_doufu.html", "pages/culinary/topic_huoguo.html"]
    }
  ];

  // ISO week number, 1-based. Used only to pick a stable weekly theme.
  function isoWeekIndex(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

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
  // The index is: { token: [[path, score], ...] } sorted by score desc.
  //
  // Search protocol:
  //   1. Split the query into whitespace-separated tokens (query is already
  //      lowercased/normalised by the caller).
  //   2. For each token:
  //      - If an exact key exists, start from that key's postings.
  //      - Otherwise, union postings from every key that has `token` as a
  //        substring OR that starts with `token` (prefix match).
  //      - Single-char CJK tokens use exact-only lookup to avoid the
  //        "everything containing 心" noise.
  //   3. AND the per-token results, summing scores across tokens.
  //   4. Return a Map<path, score>. Caller sorts.
  function searchPaths(query, searchIndex) {
    const tokens = query.split(/\s+/).filter(t => t.length > 0);
    if (!tokens.length) return null;

    const indexKeys = Object.keys(searchIndex);
    const HZ_RE = /[\u4e00-\u9fff]/;

    function postingsFor(token) {
      const isCjk = HZ_RE.test(token);
      const isShort = token.length <= 2;
      const results = new Map(); // path -> best score from this token

      // Helper. For an exact hit we apply a big boost (100× the index weight)
      // so that an entry whose pinyin IS the query always outranks an entry
      // whose unrelated term happens to start with the query.
      function addPostings(list, multiplier, exactBoost) {
        for (const pair of list) {
          const path = pair[0];
          const score = pair[1] * multiplier + (exactBoost || 0);
          const prev = results.get(path);
          if (prev === undefined || score > prev) results.set(path, score);
        }
      }

      // Exact match — biggest boost
      if (searchIndex[token]) addPostings(searchIndex[token], 1.0, 500);

      // Prefix / substring expansion.
      // Short CJK (1 char): exact only.
      // Short Latin (2 chars): exact + cheap prefix.
      // Otherwise: exact + prefix + substring (decayed).
      if (isCjk && token.length === 1) {
        // done
      } else if (isShort) {
        for (const key of indexKeys) {
          if (key === token) continue;
          if (key.startsWith(token)) addPostings(searchIndex[key], 0.6, 0);
        }
      } else {
        for (const key of indexKeys) {
          if (key === token) continue;
          if (key.startsWith(token)) addPostings(searchIndex[key], 0.7, 0);
          else if (key.includes(token)) addPostings(searchIndex[key], 0.4, 0);
        }
      }
      return results;
    }

    // AND across tokens, summing scores
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

    // ── featured-this-week ─────────────────────────────────────────────────────
    (function renderFeatured() {
      const section = document.getElementById("featured");
      const card = document.getElementById("featured-card");
      if (!section || !card || !FEATURED_WEEKLY.length) return;

      // Find the first theme whose lead entry exists; try in weekly rotation,
      // then fall through any gaps so we always render something.
      const now = new Date();
      const week = isoWeekIndex(now);
      const len = FEATURED_WEEKLY.length;
      let theme = null, lead = null;
      for (let offset = 0; offset < len; offset++) {
        const t = FEATURED_WEEKLY[(week - 1 + offset) % len];
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

      card.dataset.watermark = glyphChar || "";
      card.innerHTML = `
        <a class="featured-glyph${glyphSize}" href="${lead.path}" aria-label="${escapeHtml(theme.title)} — open ${escapeHtml(leadTitleEn)}">${escapeHtml(glyphChar)}</a>
        <div class="featured-body">
          <span class="featured-week">Week ${week} · ${escapeHtml(theme.title)}</span>
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
          sub.textContent = `${numWord(items.length)} entries that give a sense of the whole — language, philosophy, culture, food. Read in order, or skip around.`;
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
            <span class="start-here-title">${escapeHtml(titleEn)}</span>
            <span class="start-here-py">${escapeHtml(e.pinyin || "")}</span>
            ${e.desc ? `<span class="start-here-desc">${escapeHtml(e.desc)}</span>` : ""}
            <span class="start-here-cat">${escapeHtml(catMeta.en || e.category || "")}</span>
          `;
          li.appendChild(a);
          startList.appendChild(li);
        });
      }
    }

    // ── overview grid ──────────────────────────────────────────────────────────
    const overviewGrid = document.getElementById("overview-grid");
    const overviewSub = document.getElementById("overview-sub");
    if (overviewSub) {
      overviewSub.textContent = `${numWord(CAT_ORDER.length)} sections that move from the building blocks of the language up through the civilisation that built it.`;
    }
    CAT_ORDER.forEach(key => {
      const meta = CATEGORY_META[key];
      const count = groups[key].length;
      const cell = document.createElement(count > 0 ? "a" : "div");
      if (count > 0) cell.href = "#cat-" + key;
      cell.className = "overview-cell";
      cell.dataset.category = key;
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

    // Render cards for a group. Reorders by score when a query is active.
    // matchedPaths: Map<path, score> | null (null = no filter, all shown)
    function renderCardsForGroup(key, queryRaw, matchedPaths) {
      const g = catGroupMap[key];
      if (!g) return;
      const hasQuery = matchedPaths !== null;

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

        if (stateChanged || queryRaw !== card.dataset.lastQuery) {
          g.matchState[i] = true;
          card.dataset.lastQuery = queryRaw;
          toHighlight.push({ card, e, queryRaw });
        }
      });

      // Reorder cards by score when a query is active; restore original order otherwise.
      if (hasQuery) {
        const ordered = g.cardEls
          .map((card, i) => ({ card, e: g.entries[i], score: matchedPaths.get(g.entries[i].path) || 0 }))
          .filter(x => matchedPaths.has(x.e.path))
          .sort((a, b) => b.score - a.score);
        if (ordered.length) {
          const frag = document.createDocumentFragment();
          for (const { card } of ordered) frag.appendChild(card);
          for (const card of g.cardEls) {
            if (card.classList.contains("hidden")) frag.appendChild(card);
          }
          g.gridEl.appendChild(frag);
          g.reorderedOnce = true;
        }
      } else if (g.reorderedOnce) {
        const frag = document.createDocumentFragment();
        for (const card of g.cardEls) frag.appendChild(card);
        g.gridEl.appendChild(frag);
        g.reorderedOnce = false;
      }

      if (toHighlight.length) {
        requestAnimationFrame(() => {
          for (const { card, e, queryRaw: q } of toHighlight) {
            const glyphChar = leadCn(e);
            const len = glyphChar.length;
            const sizeClass = len >= 4 ? " glyph-4" : len === 3 ? " glyph-3" : len === 2 ? " glyph-2" : "";
            const titleNoCn = e.title && glyphChar
              ? (e.title.split("·").slice(1).join("·").trim() || e.title)
              : (e.title || "");
            card.innerHTML = `
              ${glyphChar ? `<span class="entry-glyph${sizeClass}">${highlight(glyphChar, q)}</span>` : ""}
              <span class="entry-pinyin">${highlight(e.pinyin || "", q)}</span>
              <span class="entry-title">${highlight(titleNoCn, q)}</span>
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
      let query = normalize(queryRaw);
      // "hsk 3" / "hsk3" / "hsk-3" / "HSK Level 2" → single token "hsk<n>"
      query = query.replace(/\bhsk[\s-]*(\d)\b/g, 'hsk$1').replace(/\bhsk\s*level\s*(\d)\b/g, 'hsk$1');
      const hasQuery = query.length > 0;

      // Inverted index lookup: weighted scoring
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
    // Count entries per level from the in-memory corpus so we only render
    // chips that actually have content, and can show counts alongside.
    const hskChipsEl = document.getElementById("hsk-chips");
    if (hskChipsEl) {
      const counts = { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0 };
      for (const e of allEntries) {
        if (typeof e.hsk === 'number' && counts[e.hsk] !== undefined) counts[e.hsk]++;
        else if (e.hsk && typeof e.hsk === 'object' && e.hsk.from) {
          for (let n = e.hsk.from; n <= e.hsk.to; n++) {
            if (counts[n] !== undefined) counts[n]++;
          }
        }
      }
      const activeLevels = [1,2,3,4,5,6].filter(n => counts[n] > 0);
      if (activeLevels.length === 0) {
        hskChipsEl.style.display = "none";
      } else {
        hskChipsEl.innerHTML =
          `<span class="hsk-chips-label">HSK</span>` +
          activeLevels.map(n =>
            `<button class="hsk-chip" data-hsk="${n}" type="button" aria-pressed="false" title="${counts[n]} ${counts[n] === 1 ? 'entry' : 'entries'}">${n} <span class="hsk-count">${counts[n]}</span></button>`
          ).join("") +
          `<button class="hsk-chip hsk-chip-clear" data-hsk="" type="button" aria-pressed="false">Clear</button>`;

        hskChipsEl.addEventListener("click", e => {
          const btn = e.target.closest(".hsk-chip");
          if (!btn) return;
          const level = btn.dataset.hsk;
          const wasActive = btn.classList.contains("active");
          hskChipsEl.querySelectorAll(".hsk-chip").forEach(b => {
            b.classList.remove("active");
            b.setAttribute("aria-pressed", "false");
          });
          if (level && !wasActive) {
            btn.classList.add("active");
            btn.setAttribute("aria-pressed", "true");
            // Write the canonical indexed form directly — belt and braces
            searchInput.value = "hsk" + level;
          } else {
            searchInput.value = "";
          }
          filterText = searchInput.value;
          clearBtn.classList.toggle("visible", filterText.length > 0);
          applyFilters();
        });
      }
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
