# Chinese Field Guide

A personal HTML/CSS/JS bilingual field guide to Chinese language and civilization. Characters, vocabulary, grammar, religion, philosophy, history, geography, culture, culinary traditions, arts and literature, science and medicine, and everyday life.

No build system. Pure static HTML. Open in a browser.

---

## For AI Agents — Read This First

This repo is set up for incremental authoring across many sessions. The key rules:

1. **Never edit `index.html` to add entries.** All cards are auto-rendered from `entries.js`. Adding a page means: create the HTML file + append one object to `entries.js`. That is all.
2. **All content pages live under `pages/[category]/`** — two levels deep. Paths from any content page: `../../style.css`, `../../index.html`, `../../scripts/toc-scroll.js`.
3. **Flip `status` in `entries.js`** from `"stub"` to `"complete"` when a page is fully authored.
4. **HSK pages are deferred** — `pages/hsk/` is reserved but empty. Do not create HSK content without being explicitly asked.
5. **Full project conventions are in `CLAUDE.md`** — read it before creating or editing any content page.

The one fully-authored reference page is `pages/characters/gan3_感.html`. Use it as the exemplar for character pages.

---

## Local Development

```bash
cd ~/Projects/Learning/chinese-field-guide
python3 -m http.server 8080
# open http://localhost:8080
```

---

## Hosting

**GitHub Pages** (recommended — free, zero config):
1. Push this repo to GitHub.
2. Go to Settings → Pages → Source: Deploy from branch `main`, folder `/`.
3. Site lives at `https://[username].github.io/chinese-field-guide/`.

Alternatives: **Cloudflare Pages** or **Netlify** (free tier, drag-and-drop). All three work identically — this is just static HTML.

---

## File Conventions

### Path depth
All content pages are at `pages/[category]/filename.html` — two levels from root:
- Stylesheet: `../../style.css`
- Index: `../../index.html`
- Shared script: `../../scripts/toc-scroll.js`

### Stylesheet
Always `style.css` at the repo root. Never rename it.

### Shared script
`scripts/toc-scroll.js` handles TOC scroll-spy and mobile sidebar toggle. Include at end of `<body>` on every content page — do not duplicate inline.

### Metadata comment
Immediately after `<!DOCTYPE html>`, before `<html>`:
```html
<!DOCTYPE html>
<!-- {"type":"character","char":"感","pinyin":"gǎn","tone":3,...,"status":"complete"} -->
<html lang="zh-Hans">
```

### Naming
- Character pages: `[pinyin][tone]_[char].html` → `pages/characters/gan3_感.html`
- Vocab pages: `[pinyin-ascii]_[char].html` → `pages/vocab/mianzi_面子.html`
- Grammar pages: short descriptor → `pages/grammar/le_了.html`
- Topic pages: `topic_[slug].html` → `pages/religion/topic_chan.html`

ASCII-only filenames — no toned vowels (ā á ǎ à etc.).

### Adding a new page
1. Create the HTML file in `pages/[category]/`.
2. Append one object to `entries.js` with `status: "stub"`.
3. `index.html` auto-renders. Done.

### Authoring a stub
Open the stub. Replace the placeholder scholar box with real sections:
- Section anchors + section heads
- Etymology scholar box (character pages)
- Word-formation pattern box (character/vocab/grammar)
- Vocab card groups (`.cards` > `.card.c-*`)
- 成语 chengyu grid
- Adjacent vocab adj-chips
- Retention image scholar box (character pages)

Then flip `status: "stub"` → `status: "complete"` in `entries.js`.

---

## Authoring Queue

The full 120-entry TODO checklist lives in `local/authoring-queue.md` (gitignored — local only).
