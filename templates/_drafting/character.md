You are writing a content entry for **Jiǎoluò Shūwū · 角落書屋**, a scholar's field guide to the Chinese language and civilization. Your output must be a single complete `content/characters/<slug>.md` file — frontmatter followed by the full HTML body. No other text, no code fences, no commentary.

---

## Target character

- Character: {{char}}
- Pinyin: {{pinyin}}
- Tone: {{tone}}
- HSK level: {{hsk}}
- Radical: {{radical}}
- Suggested tags: {{tags}}
- Slug: {{slug}}

---

## Frontmatter format

Output exactly this structure (adjust values):

```
---
type: 'character'
category: 'characters'
status: 'complete'
title: '{{char}} · <short english gloss>'
desc: "<one sentence — the most interesting or culturally significant thing about this character. Shown on the index card. No quotes inside.>"
metaDesc: "<fuller SEO sentence including char, pinyin, gloss, and a hook. May quote classical or modern usage.>"
pageTitle: '{{char}} {{pinyin}}'
tags:
  - '<tag1>'
  - '<tag2>'
updated: '{{date}}'
char: '{{char}}'
pinyin: '{{pinyin}}'
tone: {{tone}}
hsk: {{hsk}}
radical: '{{radical}}'
---
```

Tags must come from the controlled vocabulary in `content/_schema/tags.json`. Use only slugs from that list.

---

## HTML body structure

After the frontmatter, output the full HTML body. Follow this exact structure:

```html
<div class="shell">

  <!-- ═══ SIDEBAR ═══ -->
  <aside class="sidebar" id="sidebar">
    <button class="toc-toggle" onclick="document.getElementById('sidebar').classList.toggle('open')">目录 Contents ▾</button>

    <span class="toc-glyph">{{char}}</span>
    <span class="toc-pinyin">{{pinyin}} · tone {{tone}}</span>

    <div class="toc-divider"></div>
    <span class="toc-label">On this page</span>

    <ul class="toc-list">
      <!-- one <li> per section, e.g.: -->
      <li><a href="#etymology">
        <span class="toc-cn">字源</span> Etymology
        <span class="toc-sub">zìyuán · origin &amp; structure</span>
      </a></li>
      <!-- add more sections here -->
      <li><a href="#chengyu">
        <span class="toc-cn">成语</span> Idioms
        <span class="toc-sub">chéngyǔ · set phrases</span>
      </a></li>
      <li><a href="#adjacent">
        <span class="toc-cn">相邻</span> Adjacent Vocab
        <span class="toc-sub">xiānglín cíhuì</span>
      </a></li>
    </ul>
  </aside>

  <!-- ═══ MAIN ═══ -->
  <main class="main">

    <!-- HERO -->
    <header class="hero">
      <div class="hero-inner">
        <div class="hero-glyph-col">
          <span class="hero-glyph">{{char}}</span>
        </div>
        <div class="hero-meta">
          <div class="hero-pinyin">{{pinyin}}</div>
          <div class="hero-en"><!-- english gloss --></div>
          <div class="hero-chips">
            <span class="chip">部首 bùshǒu · {{radical}} <!-- radical name --></span>
            <span class="chip"><!-- N --> 笔画 bǐhuà strokes</span>
            <span class="chip chip-hsk">HSK {{hsk}}</span>
            <span class="chip">tone {{tone}} · {{pinyin}}</span>
          </div>
        </div>
      </div>
    </header>

    <!-- SECTION: Etymology (required) -->
    <span class="section-anchor" id="etymology"></span>
    <div class="section-head">
      <span class="sh-cn">字源</span>
      <span class="sh-py">zìyuán</span>
      <span class="sh-en">Etymology &amp; Structure</span>
      <span class="sh-rule"></span>
    </div>

    <div class="scholar" data-glyph="{{char}}">
      <div class="scholar-label">字源洞见 zìyuán dòngjiàn · Etymological Insight</div>
      <!-- 3-4 paragraphs: decomposition, oracle-bone/bronze history, semantic evolution, cross-cultural note if relevant -->
    </div>

    <!-- 1-4 more compound/vocabulary sections, each with: section-anchor, section-head, optional .pattern, .cards -->
    <!-- Each section groups thematically related compounds -->

    <!-- SECTION: Chengyu (required, ≥ 3 entries) -->
    <span class="section-anchor" id="chengyu"></span>
    <div class="section-head">
      <span class="sh-cn">成语</span>
      <span class="sh-py">chéngyǔ</span>
      <span class="sh-en">Idioms &amp; Set Phrases</span>
      <span class="sh-rule"></span>
    </div>

    <div class="chengyu-grid">
      <!-- ≥ 3 chengyu, each as: -->
      <div class="cy">
        <span class="cy-cn"><!-- chengyu --></span>
        <span class="cy-py"><!-- pinyin --></span>
        <span class="cy-en"><!-- literal translation and meaning --></span>
        <span class="cy-note"><!-- source, usage context, cultural note --></span>
      </div>
    </div>

    <!-- SECTION: Adjacent Vocab (required) -->
    <span class="section-anchor" id="adjacent"></span>
    <div class="section-head">
      <span class="sh-cn">相邻词汇</span>
      <span class="sh-py">xiānglín cíhuì</span>
      <span class="sh-en">Adjacent Vocabulary</span>
      <span class="sh-rule"></span>
    </div>

    <div class="adj-wrap">
      <!-- 8-15 chips -->
      <span class="adj"><span class="a-cn"><!-- cn --></span><span class="a-py"><!-- py --></span><span class="a-en"><!-- en --></span></span>
    </div>

    <!-- RETENTION IMAGE (required) — a scholar box with a vivid memory hook -->
    <div class="scholar" data-glyph="{{char}}">
      <div class="scholar-label">记忆法 jìyìfǎ · Master Retention Image</div>
      <!-- 2-3 paragraphs: sensory image, etymological hook, why the compound pattern makes sense -->
    </div>

    <!-- FOOTER -->
    <footer class="page-footer">
      <span class="footer-id">Jiǎoluò Shūwū · 角落書屋 · <span>{{char}} {{pinyin}}</span> · {{slug}}.html</span>
      <a href="../../index.html" class="footer-back">← All Entries</a>
    </footer>

  </main>
</div>
```

---

## Quality requirements (every draft must satisfy all of these)

**Etymology scholar box** (required, ≥ 3 paragraphs):
- Open with: component analysis — which radicals/phonetic components make up the character, what each means
- Include: oracle-bone or bronze inscription description if known; how the visual form changed
- Include: semantic range — how the meaning extended from the concrete to the abstract
- Optional: cross-civilizational note (Japanese, Vietnamese, or Korean usage of the same character)

**Compound sections** (≥ 3 vocabulary sections total beyond etymology):
- Each section has a thematic title in Chinese + pinyin + English
- Open each section with either a `.pattern` (showing the morphological rule) or a `.scholar` insight box
- Each `.cards` group: 3-5 cards, rotating through `.c-red`, `.c-ochre`, `.c-teal`, `.c-violet`, `.c-sienna`
- Each card: `.card-head` (cn, pinyin, English gloss) + `.tags` (POS: tag-v / tag-n / tag-adj / tag-vn) + `.card-def` (definition with component breakdown) + `.examples` (2-3 examples with cn/pinyin/en) + optionally `.note` (contrastive, cultural, or pragmatic note)
- Examples must be natural, idiomatic Mandarin — not textbook-stilted

**Chengyu** (required, ≥ 3):
- Include the classical source (Analects, Mencius, Shiji, etc.) when traceable
- Note modern usage register and typical contexts
- Include a full `.cy-note` — not just a translation

**Retention image** (required):
- Open with a concrete sensory image — place, moment, physical experience
- Connect the image to the character's visual form or component decomposition
- Extend the image into the compound pattern — show how the root meaning flows through all the key words

**Voice and register:**
- Scholarly but accessible — write for a curious English reader who is learning Mandarin, not for a linguistics professor
- Never write "This character means X" as an opener — open with the etymology or image
- Prefer active, specific prose: "The oracle bone shows a hand grasping a sprout" not "It depicts a hand and a plant"
- Avoid hedging phrases: "seems to," "it is thought that," "possibly" — commit to the most defensible reading

---

## Exemplar: 道 dào (condensed)

Below is a condensed excerpt from the 道 page to show the expected density, voice, and structure.

### Etymology box (from 道 dào):
> **道 dào = 辶 chuò** (the walk-movement radical — a foot in motion) **+ 首 shǒu** (head). A head moving purposefully forward along a path: the guided way, navigated with intelligence. Oracle-bone and bronze inscriptions show a crossroads with a head positioned at it — the moment of choosing direction, of reading the way ahead. 道 encodes both the physical path AND the principle of navigation simultaneously.
>
> This ambiguity was not an accident — it was an invitation. Laozi seized it: 道可道，非常道 — "The Way that can be spoken is not the eternal Way."
>
> In Japanese, 道 *dō* becomes the suffix for every traditional discipline-art that embodies a "Way" of practice: 柔道 *jūdō*, 茶道 *sadō*, 書道 *shodō*. One character carrying two civilizations' deepest conceptions of pursuing excellence.

### Card example (from 道, 知道 zhīdào):
> 知 zhī (to know; knowledge) + 道 dào (way; path). The most common verb of knowledge in everyday speech. 知道 covers factual awareness, learned information, and received news — knowing that something is the case.
>
> Note — *Three Kinds of Knowing:* 知道 = factual / informational knowledge (know that). 了解 liǎojiě = deeper, contextual understanding. 认识 rènshi = to know a person; to recognize.

### Chengyu example (from 道, 任重道远):
> **任重道远** — "the burden is heavy, the road is far" — great responsibility with a long journey ahead. From the Analects of Confucius: 仁以为己任，不亦重乎？死而后已，不亦远乎？Used to describe serious long-term undertakings: social reform, academic work, national development. Conveys gravitas without complaint.

### Retention image (from 道):
> A crossroads at dawn. Four paths, no signs. The ancient character shows a head positioned at that crossroads, moving forward. 道 is not one path but the knowing of how to walk any path — the intelligence that reads the terrain and chooses direction.
>
> When Laozi wrote 道可道，非常道, he was standing at that crossroads, pointing at all four paths simultaneously, refusing to collapse the mystery into a single direction. The eternal 道 remains the capacity to read any terrain, not the map of one particular road.

---

Now write the full `content/characters/{{slug}}.md` file for {{char}} {{pinyin}}. Output only the file contents — no preamble, no explanation, no code fences.
