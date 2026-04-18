# chinese-field-guide — Project Instructions

## What this is
A personal HTML/CSS/JS site — a field guide to Chinese characters and topics. No build system. Files are served statically. Run locally with `python3 -m http.server 8080` from this directory.

## File conventions

### Stylesheet
The shared stylesheet is **`style.css`** — always. Never `han_style.css` or any other name. Every page must link it as:
```html
<link rel="stylesheet" href="style.css">
```

### Metadata comment block
Place the JSON metadata comment immediately after `<!DOCTYPE html>`, before `<html>`. Format:
```html
<!DOCTYPE html>
<!-- {"type":"character","char":"感","pinyin":"gǎn","tone":3,"hsk":3,"radical":"心","topic":"emotion","tags":[...]} -->
<html lang="zh-Hans">
```
For topic pages use `"type":"topic"` and omit character-specific fields.

### Page naming
- Character entries: `[pinyin][tone]_[char].html` — e.g. `gan3_感.html`, `shi4_是.html`
- Topic entries: `topic_[slug].html` — e.g. `topic_chado.html`, `topic_qingming.html`

## Two page types

### Character entries (`type: character`)
Structure: glyph hero → etymology scholar box → word-formation pattern box → grouped vocab card sections → 成语 chengyu-grid → adjacent vocab adj-chips → retention image scholar box → page footer.

Sidebar: `.toc-glyph` + `.toc-pinyin` hero, then `.toc-list` with anchors matching all sections.

### Topic entries (`type: topic`)
Structure: topic-hero (eyebrow + title + pinyin + desc) → prose scholar sections → relevant vocab card sections → 成语 → adjacent vocab → page footer.

Sidebar: `.toc-topic` + `.toc-topic-en` hero, then `.toc-list`.

## Required page elements (both types)
- `lang="zh-Hans"` on `<html>`
- Descriptive `<title>`: `感 gǎn — Field Notes on Chinese` / `茶道 · The Way of Tea — Field Notes on Chinese`
- Google Fonts link (Cormorant Garamond + Noto Serif SC + Inconsolata) in `<head>`
- Top nav with brand linking to `index.html` and `← All Entries` back link
- Mobile TOC toggle button inside `<aside class="sidebar" id="sidebar">`
- Scroll-active TOC JS (IntersectionObserver on `.section-anchor` elements)
- Page footer with filename reference

## CSS components (from style.css)
`.shell` → `.sidebar` + `.main` layout. Components: `.hero` / `.topic-hero`, `.scholar`, `.pattern`, `.cards` + `.card.c-{red|ochre|teal|violet|sienna}`, `.chengyu-grid` + `.cy`, `.adj-wrap` + `.adj`, `.table-wrap` + `table`, `.page-footer`. Chips: `.chip`, `.chip-hsk`, `.chip-topic`. Tags: `.tag-v`, `.tag-n`, `.tag-vn`, `.tag-adj`.

## index.html
When adding a new page, add a card to the appropriate section in `index.html`:
- Character: `.entry-card` in the 字条 grid
- Topic: `.entry-card.topic-card` in the 专题 grid

## Git
Commit each new page as: `feat: add [char/topic] page — [pinyin] [english gloss]`
