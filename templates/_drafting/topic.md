You are writing a content entry for **Jiǎoluò Shūwū · 角落書屋**, a scholar's field guide to the Chinese language and civilization. Your output must be a single complete `content/{{category}}/{{slug}}.md` file — frontmatter followed by the full HTML body. No other text, no code fences, no commentary.

---

## Target entry

- Type: {{type}} (vocab | grammar | topic)
- Category: {{category}}
- Chinese title: {{title_cn}}
- Pinyin: {{pinyin}}
- English gloss: {{title_en}}
- Suggested tags: {{tags}}
- Slug: {{slug}}

---

## Frontmatter format

```
---
type: '{{type}}'
category: '{{category}}'
status: 'complete'
title: '{{title_cn}} · {{title_en}}'
desc: "<one sentence — the most interesting or culturally significant thing. Shown on the index card.>"
metaDesc: "<fuller SEO sentence. No internal quotes without escaping.>"
pageTitle: '{{title_cn}} {{pinyin}}'
tags:
  - '<tag1>'
  - '<tag2>'
updated: '{{date}}'
pinyin: '{{pinyin}}'
---
```

Tags must come from the controlled vocabulary in `content/_schema/tags.json`.

---

## HTML body structure

```html
<div class="shell">

  <!-- ═══ SIDEBAR ═══ -->
  <aside class="sidebar" id="sidebar">
    <button class="toc-toggle" onclick="document.getElementById('sidebar').classList.toggle('open')">目录 Contents ▾</button>

    <span class="toc-topic">{{title_cn}}</span>
    <span class="toc-topic-en">{{title_en}}</span>

    <div class="toc-divider"></div>
    <span class="toc-label">On this page</span>

    <ul class="toc-list">
      <!-- one <li> per section -->
    </ul>
  </aside>

  <!-- ═══ MAIN ═══ -->
  <main class="main">

    <header class="topic-hero">
      <span class="topic-hero-eyebrow">{{category_cn}} · {{category_en}}</span>
      <h1 class="topic-hero-title">{{title_cn}}</h1>
      <span class="topic-hero-title-py">{{pinyin}}</span>
      <p class="topic-hero-desc"><!-- 1–2 sentence description --></p>
    </header>

    <!-- 3-6 content sections, each with section-anchor, section-head, and content -->
    <!-- Use .scholar boxes for essay/insight prose -->
    <!-- Use .pattern for structural/grammatical patterns (grammar type) -->
    <!-- Use .cards for vocabulary groups -->
    <!-- Use .chengyu-grid for idioms (when applicable) -->
    <!-- Use .adj-wrap for "vocabulary in this field" chips. The build hoists
         this block into the page's Related section as the chips tier; do not
         author a #adjacent section-anchor or section-head. Each chip:
           <span class="adj"
                 data-relation="synonym|antonym|collocation|derived|contrast"  (optional)
                 data-distinct="one-line distinction vs the page subject"      (optional)
           ><span class="a-cn">CN</span><span class="a-py">py</span><span class="a-en">en</span></span>
         Chips whose .a-cn matches an existing page are auto-linked at build
         time with category-color signaling. -->
    <!-- Use .adj-wrap for adjacent vocabulary chips -->

    <footer class="page-footer">
      <span class="footer-id">Jiǎoluò Shūwū · 角落書屋 · <span>{{title_cn}} {{pinyin}}</span> · {{slug}}.html</span>
      <a href="../../index.html" class="footer-back">← All Entries</a>
    </footer>

  </main>
</div>
```

---

## Quality requirements

**For topic entries:**
- Open with a substantive `.scholar` box: the most important cultural or historical context
- 3-6 sections organized around the main facets of the topic
- Include concrete vocabulary (cards) where relevant — show the language, not just the history
- ≥ 1 chengyu section when applicable
- Close with an adjacent vocabulary section

**For vocab entries:**
- Open with etymology and compound analysis
- Show the word in context across different registers (formal, colloquial, literary)
- ≥ 3 example sentences per main card
- Include 辨析 (biànxī) contrast notes for synonyms and near-synonyms

**For grammar entries:**
- Open with a `.pattern` block showing the canonical structure
- ≥ 4-5 examples showing the full range of usage
- Contrastive note: when to use this vs. a similar structure
- Common errors / pitfalls section

**Voice and register:**
- Scholarly but accessible — for a curious English reader learning Mandarin
- Specific and committed prose — no hedging
- Show the living language: modern usage, colloquial register, classical depth
- Topic pages in particular: lead with argument, not survey. Name the emperor, the text, the year. End on a concrete image or quotation, not a verdict about significance.

---

## Exemplar: 禅宗 chán zōng (condensed)

### Hero desc (from 禅宗):
> The school of meditation and direct transmission — rejecting scripture, bypassing concepts, and insisting that the Buddha's mind is available right now, in this breath, in this gesture, in a single flash of recognition that cannot be taught but only pointed toward.

### Opening scholar box (from 禅宗, Origins section):
> Chan Buddhism names itself after 禅 chán — the Chinese rendering of Sanskrit *dhyāna* (meditation). The tradition traces its founding to **菩提达摩 Pútí Dámó** (Bodhidharma), an Indian or Central Asian monk who arrived in South China around 520 CE. The emperor Liang Wudi asked him: "I have built temples, copied sutras, and supported the sangha. What merit have I earned?" Bodhidharma replied: "None." The emperor asked: "Who stands before me?" Bodhidharma replied: "I don't know." He then retired to Shaolin Monastery, where he meditated facing a wall for nine years.
>
> This founding story encodes the Chan stance on received religion: sponsoring buildings and copying texts generates no merit because merit is not something accumulated externally. The "I don't know" response is not modesty but direct pointing to a mind that cannot be grasped conceptually.
>
> Chan's historical emergence is more complex than the legend suggests. The school crystallized in the late 6th and 7th centuries through the creative synthesis of Indian meditation traditions, Madhyamaka philosophy, and distinctly Chinese elements — particularly the Daoist valorization of spontaneity and the Confucian emphasis on practical cultivation over abstract doctrine.

### Chengyu entry (from 禅宗):
> **一花五叶** — "one flower, five leaves" — the single flower of Bodhidharma's transmission opening into five Chan lineages. The phrase is attributed to Bodhidharma himself in prophecy. Used to describe the diversification of a single tradition into distinct but related schools.

Notice what this exemplar does: each paragraph leads with the concrete fact (the date, the exchange, the verse), then draws out the implication. Nothing is described as "profound" or "significant" — the prose lets the material earn that verdict.

---

Now write the full `content/{{category}}/{{slug}}.md` file for {{title_cn}} {{pinyin}}. Output only the file contents — no preamble, no explanation, no code fences.
