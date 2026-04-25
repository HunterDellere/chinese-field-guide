#!/usr/bin/env node
/**
 * draft.mjs — scaffolding tool for jiaoluo-shuwu
 *
 * Creates a stub draft file in local/drafts/<category>/<slug>.md with correct
 * frontmatter and HTML structure. Edit the stub (or ask Claude Code to fill it),
 * then promote to content/ when ready.
 *
 * Usage:
 *   node build/draft.mjs character gan3_感           # stub for a character page
 *   node build/draft.mjs vocab religion topic_chan   # stub for topic/vocab/grammar
 *   node build/draft.mjs --queue local/authoring-queue.md   # batch stubs from queue
 *
 * Promote a draft:
 *   mv local/drafts/<cat>/<slug>.md content/<cat>/<slug>.md
 *   npm run build
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');

const TODAY = new Date().toISOString().slice(0, 10);

// ── slug parsing ──────────────────────────────────────────────────────────────

function parseSlug(type, slug) {
  if (type === 'character') {
    const m = slug.match(/^([a-z]+)(\d)_(.+)$/);
    if (!m) throw new Error(`Character slug must be <pinyin><tone>_<char>, e.g. gan3_感. Got: ${slug}`);
    return { slug, pinyin: m[1], tone: parseInt(m[2]), char: m[3] };
  }
  return { slug };
}

// ── stubs ─────────────────────────────────────────────────────────────────────

function buildCharacterStub(slugInfo) {
  const { slug, char, pinyin, tone } = slugInfo;
  return `---
type: 'character'
category: 'characters'
status: 'stub'
title: '${char} · '
desc: ""
tags: []
updated: '${TODAY}'
char: '${char}'
pinyin: '${pinyin}'
tone: ${tone}
hsk: 1
radical: ''
---

<div class="shell">

  <!-- ═══ SIDEBAR ═══ -->
  <aside class="sidebar" id="sidebar">
    <button class="toc-toggle" onclick="document.getElementById('sidebar').classList.toggle('open')">目录 Contents ▾</button>

    <span class="toc-glyph">${char}</span>
    <span class="toc-pinyin">${pinyin} · tone ${tone}</span>

    <div class="toc-divider"></div>
    <span class="toc-label">On this page</span>

    <ul class="toc-list">
      <li><a href="#etymology">
        <span class="toc-cn">字源</span> Etymology
        <span class="toc-sub">zìyuán · origin &amp; structure</span>
      </a></li>
      <li><a href="#chengyu">
        <span class="toc-cn">成语</span> Idioms
        <span class="toc-sub">chéngyǔ · set phrases</span>
      </a></li>
      <!-- The "Related" TOC link is auto-injected at build time; do not author it here. -->
    </ul>
  </aside>

  <!-- ═══ MAIN ═══ -->
  <main class="main">

    <!-- HERO -->
    <header class="hero">
      <div class="hero-inner">
        <div class="hero-glyph-col">
          <span class="hero-glyph">${char}</span>
        </div>
        <div class="hero-meta">
          <div class="hero-pinyin">${pinyin}</div>
          <div class="hero-en"><!-- english gloss --></div>
          <div class="hero-chips">
            <span class="chip">部首 bùshǒu · <!-- radical --></span>
            <span class="chip"><!-- N --> 笔画 bǐhuà strokes</span>
            <span class="chip chip-hsk">HSK <!-- N --></span>
            <span class="chip">tone ${tone} · ${pinyin}</span>
          </div>
        </div>
      </div>
    </header>

    <!-- ETYMOLOGY -->
    <span class="section-anchor" id="etymology"></span>
    <div class="section-head">
      <span class="sh-cn">字源</span>
      <span class="sh-py">zìyuán</span>
      <span class="sh-en">Etymology &amp; Structure</span>
      <span class="sh-rule"></span>
    </div>

    <div class="scholar" data-glyph="${char}">
      <div class="scholar-label">字源洞见 zìyuán dòngjiàn · Etymological Insight</div>
      <p><!-- etymology --></p>
    </div>

    <!-- CHENGYU -->
    <span class="section-anchor" id="chengyu"></span>
    <div class="section-head">
      <span class="sh-cn">成语</span>
      <span class="sh-py">chéngyǔ</span>
      <span class="sh-en">Idioms &amp; Set Phrases</span>
      <span class="sh-rule"></span>
    </div>

    <div class="chengyu-grid">
      <div class="cy">
        <span class="cy-cn"><!-- chengyu --></span>
        <span class="cy-py"><!-- pinyin --></span>
        <span class="cy-en"><!-- meaning --></span>
        <span class="cy-note"><!-- note --></span>
      </div>
    </div>

    <!-- VOCABULARY IN THIS FIELD (chips tier of the auto-generated Related section)
         The build hoists this .adj-wrap into the Related section under the
         cards. Do NOT author a section-anchor or section-head; the build
         strips them. Optional chip slots:
           data-relation="synonym|antonym|collocation|derived|contrast"
           data-distinct="one-line distinction vs the page subject"
         Chips matching an existing page are auto-linked at build time. -->
    <div class="adj-wrap">
      <span class="adj"><span class="a-cn"><!-- cn --></span><span class="a-py"><!-- py --></span><span class="a-en"><!-- en --></span></span>
    </div>

    <!-- RETENTION IMAGE -->
    <div class="scholar" data-glyph="${char}">
      <div class="scholar-label">记忆法 jìyìfǎ · Master Retention Image</div>
      <p><!-- retention image --></p>
    </div>

    <!-- FOOTER -->
    <footer class="page-footer">
      <span class="footer-id">Jiǎoluò Shūwū · 角落書屋 · <span>${char} ${pinyin}</span> · ${slug}.html</span>
      <a href="../../index.html" class="footer-back">← All Entries</a>
    </footer>

  </main>
</div>
`;
}

function buildTopicStub(type, category, slugInfo) {
  const { slug } = slugInfo;
  return `---
type: '${type}'
category: '${category}'
status: 'stub'
title: '<!-- title_cn --> · <!-- title_en -->'
desc: ""
tags: []
updated: '${TODAY}'
pinyin: ''
---

<div class="shell">

  <!-- ═══ SIDEBAR ═══ -->
  <aside class="sidebar" id="sidebar">
    <button class="toc-toggle" onclick="document.getElementById('sidebar').classList.toggle('open')">目录 Contents ▾</button>

    <span class="toc-topic"><!-- cn --></span>
    <span class="toc-topic-en"><!-- en --></span>

    <div class="toc-divider"></div>
    <span class="toc-label">On this page</span>

    <ul class="toc-list">
      <!-- add sections -->
    </ul>
  </aside>

  <!-- ═══ MAIN ═══ -->
  <main class="main">

    <header class="topic-hero">
      <span class="topic-hero-eyebrow">${category}</span>
      <h1 class="topic-hero-title"><!-- cn --></h1>
      <span class="topic-hero-title-py"><!-- pinyin --></span>
      <p class="topic-hero-desc"><!-- desc --></p>
    </header>

    <!-- add content sections -->

    <footer class="page-footer">
      <span class="footer-id">Jiǎoluò Shūwū · 角落書屋 · ${slug}.html</span>
      <a href="../../index.html" class="footer-back">← All Entries</a>
    </footer>

  </main>
</div>
`;
}

// ── queue parsing ─────────────────────────────────────────────────────────────

function parseQueue(queuePath) {
  const raw = readFileSync(queuePath, 'utf8');
  const items = [];
  for (const line of raw.split('\n')) {
    // Matches: - [ ] character qing2_情
    //          - [ ] topic religion topic_chan
    const m = line.match(/^\s*-\s*\[[ ]\]\s+(\w+)\s+(\S+)\s*(\S+)?/);
    if (!m) continue;
    const type = m[1];
    if (type === 'character') {
      items.push({ type: 'character', category: 'characters', slug: m[2] });
    } else {
      items.push({ type, category: m[2], slug: m[3] });
    }
  }
  return items;
}

// ── scaffold one entry ────────────────────────────────────────────────────────

function scaffold(type, category, rawSlug) {
  const slugInfo = parseSlug(type, rawSlug);
  const { slug } = slugInfo;

  const outDir  = join(ROOT, 'local', 'drafts', category);
  const outPath = join(outDir, `${slug}.md`);

  if (existsSync(outPath)) {
    console.log(`  Skip — already exists: local/drafts/${category}/${slug}.md`);
    return;
  }

  mkdirSync(outDir, { recursive: true });

  const stub = type === 'character'
    ? buildCharacterStub(slugInfo)
    : buildTopicStub(type, category, slugInfo);

  writeFileSync(outPath, stub, 'utf8');
  console.log(`  ✓ local/drafts/${category}/${slug}.md`);
  console.log(`\n  Next: ask Claude Code to fill this draft, then promote:`);
  console.log(`  mv local/drafts/${category}/${slug}.md content/${category}/${slug}.md`);
  console.log(`  npm run build`);
}

// ── main ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const queueFlag = process.argv.indexOf('--queue');

if (queueFlag !== -1) {
  const queuePath = process.argv[queueFlag + 1];
  if (!queuePath || !existsSync(queuePath)) {
    console.error('--queue requires a valid path to the queue file');
    process.exit(1);
  }
  const items = parseQueue(queuePath);
  if (!items.length) { console.log('No unchecked items in queue.'); process.exit(0); }
  console.log(`\nScaffolding ${items.length} item(s) from queue…`);
  for (const { type, category, slug } of items) {
    console.log(`\n→ ${type} ${category}/${slug}`);
    scaffold(type, category, slug);
  }
  process.exit(0);
}

// Single mode
let type, category, rawSlug;

if (args[0] === 'character') {
  type = 'character';
  category = 'characters';
  rawSlug = args[1];
} else if (['vocab','grammar','topic'].includes(args[0])) {
  type = args[0];
  category = args[1];
  rawSlug = args[2];
} else {
  console.error('Usage:');
  console.error('  node build/draft.mjs character <pinyin><tone>_<char>');
  console.error('  node build/draft.mjs topic <category> <slug>');
  console.error('  node build/draft.mjs vocab <category> <slug>');
  console.error('  node build/draft.mjs grammar <category> <slug>');
  console.error('  node build/draft.mjs --queue local/authoring-queue.md');
  process.exit(1);
}

if (!rawSlug) { console.error('Missing slug.'); process.exit(1); }
scaffold(type, category, rawSlug);
