#!/usr/bin/env node
/**
 * build.mjs — Jiǎoluò Shūwū build system
 *
 * Reads:  content/<category>/<slug>.md  (frontmatter + HTML body)
 * Writes: pages/<category>/<slug>.html
 *         data/entries.json
 *         data/search-index.json
 *         data/recent.json
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join, dirname, basename, relative } from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { validateEntry } from './lib/validate.mjs';
import { buildSearchIndex } from './lib/search-index.mjs';
import { buildRelations, buildAdjacency, renderRelatedHtml, renderAdjacencyHtml } from './lib/relations.mjs';
import { renderHskBody } from './lib/hsk.mjs';
import { injectStrokeOrder, buildLinkMap, autoLinkBody, addPinyinAudio, injectInlineAudio, buildPageFooter, renderSourcesHtml, ensureMainContentId, buildChipLinkMap, linkifyAdjChips, injectPinyinIndexChip, transformSutraPassages } from './lib/augment.mjs';
import { buildAdjIndex } from './lib/adj-index.mjs';
import { renderFamilyContent, renderFamilyCrosslinks } from './lib/family-render.mjs';
import { renderOgSvg, renderHomepageOgSvg, rasterizeOgSvg, ogContentHash, ogAltText, categoryFaviconDataUri } from './lib/og.mjs';
import { emitPinyinPages, buildPinyinIndex } from './lib/pinyin-index.mjs';
import { buildComponentIndex, renderAppearsInHtml } from './lib/component-index.mjs';
import { injectHeroStrokes, buildSimpTradMap } from './lib/stroke.mjs';
import { BRAND } from './lib/brand.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');

const LAYOUT = readFileSync(join(ROOT, 'templates/_layout.html'), 'utf8');

// ── hub helpers ──────────────────────────────────────────────────────────────

const COLOR_TO_CARD = { teal: 'c-teal', ochre: 'c-ochre', sienna: 'c-sienna', violet: 'c-violet', red: 'c-red' };
const TYPE_LABEL = { Character: 'Character', Vocab: 'Vocab', Topic: 'Topic', Grammar: 'Grammar' };

/**
 * Build Map<memberPath, [{hubPath, hubTitle, hubPinyin, hubCn}]>
 * from all hub entries that have stages[] in frontmatter.
 */
function buildHubMemberMap(pendingList) {
  const map = new Map(); // memberPath → array of hub info objects
  for (const { fm, slug, category } of pendingList) {
    if (fm.type !== 'hub' || !fm.stages) continue;
    const hubPath = `pages/${category}/${slug}.html`;
    const hubCn   = fm.title ? fm.title.split('·')[0].trim() : slug;
    const hubEn   = fm.title ? (fm.title.split('·')[1] || '').trim().split('—')[0].trim() : '';
    const hubPy   = fm.pinyin || '';
    for (const stage of fm.stages) {
      for (const member of (stage.members || [])) {
        const memberPath = `pages/${member.slug}.html`;
        if (!map.has(memberPath)) map.set(memberPath, []);
        map.get(memberPath).push({ hubPath, hubCn, hubEn, hubPy });
      }
    }
  }
  return map;
}

function escapeHtmlBuild(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Derive a safe ASCII card id from a member slug.
 * Prepends the category so cards with the same basename in different
 * categories don't collide (e.g. 'vocab/hanzi_汉字' vs 'hubs/hanzi'
 * both used to render as id="card-hanzi").
 * 'characters/cha2_茶' → 'characters-cha2'
 * 'culinary/topic_cha' → 'culinary-topic_cha'
 * 'hubs/hanzi'         → 'hubs-hanzi'
 */
function cardId(memberSlug) {
  const parts = memberSlug.split('/');
  const category = parts.length > 1 ? parts[0] : '';
  const base = parts.pop();
  // If basename contains an underscore followed by a non-ASCII char, keep only the ASCII prefix
  const asciiPrefix = base.match(/^([A-Za-z0-9_-]+)_[^\x00-\x7F]/);
  const stem = asciiPrefix ? asciiPrefix[1] : base;
  return category ? `${category}-${stem}` : stem;
}

/**
 * Render the stages legend + staged reading-path cards HTML from frontmatter stages[].
 * Returns { html, sidebarListHtml } — html is wrapped in auto-link-skip sentinels
 * so the auto-linker never scans hrefs inside generated card markup.
 */
function renderHubStagesHtml(fm, slug, category) {
  if (!fm.stages || !fm.stages.length) return { html: '', sidebarListHtml: '' };
  const fromPath = `pages/${category}/${slug}.html`;

  // Legend block (#stages) — compact clickable list that jumps to each stage.
  // Visually distinct from the full .stage-head separators that appear above each
  // stage's cards below, so the reader can tell the overview list from the content.
  const legendItems = fm.stages.map((st, i) => {
    const cn = st.cn || st.name;
    const en = st.name_en || st.name;
    const stageColorClass = `s-${st.color || 'teal'}`;
    const count = (st.members || []).length;
    const countLabel = count ? `${count} ${count === 1 ? 'entry' : 'entries'}` : '';
    return `
      <li><a class="stage-legend-item ${stageColorClass}" href="#stage-${i + 1}">
        <span class="stage-legend-num">Stage ${i + 1}</span>
        <span class="stage-legend-body">
          <span class="stage-legend-cn">${escapeHtmlBuild(cn)}</span>
          <span class="stage-legend-en">${escapeHtmlBuild(en)}</span>
        </span>
        ${countLabel ? `<span class="stage-legend-count">${countLabel}</span>` : ''}
      </a></li>`;
  }).join('');

  const stagesSection = `
    <span class="section-anchor" id="stages"></span>
    <div class="section-head"><h2>Reading Path</h2></div>
    <ol class="stages-legend">${legendItems}
    </ol>`;

  // Cards by stage (#path — each stage gets its own stage-head + cards block)
  const stageCards = fm.stages.map((st, i) => {
    const colorClass = COLOR_TO_CARD[st.color] || 'c-teal';
    const stageColorClass = `s-${st.color || 'teal'}`;
    const cn = st.cn || st.name;
    const en = st.name_en || st.name;
    const stageIdAttr = `stage-${i + 1}`;
    const cards = (st.members || []).map(member => {
      const href = relPathBuild(fromPath, `pages/${member.slug}.html`);
      const typeLabel = member.type ? TYPE_LABEL[member.type] || member.type : '';
      const minsLabel = member.mins ? `${member.mins} min` : '';
      const metaStr = [typeLabel, minsLabel].filter(Boolean).join(' · ');
      const cid = cardId(member.slug);
      return `
      <div class="card ${colorClass}" id="card-${cid}">
        ${metaStr ? `<div class="card-meta">${escapeHtmlBuild(metaStr)}</div>` : ''}
        <div class="card-head">
          <span class="card-cn">${escapeHtmlBuild(member.label_cn)}</span>
          ${member.label_en ? `<span class="card-en">${escapeHtmlBuild(member.label_en)}</span>` : ''}
          <a class="card-anchor" href="#card-${cid}" aria-label="Link to this entry">#</a>
        </div>
        <p><a href="${escapeHtmlBuild(href)}">${escapeHtmlBuild(member.label_cn)}</a>${member.note ? ` — ${escapeHtmlBuild(member.note)}` : ''}</p>
      </div>`;
    }).join('');

    return `
    <div class="stage-head ${stageColorClass}" id="${stageIdAttr}">
      <span class="stage-num">Stage ${i + 1}</span>
      <h3 class="stage-name">${escapeHtmlBuild(cn)}</h3>
      <span class="stage-name-en">${escapeHtmlBuild(en)}</span>
      ${st.note ? `<span class="stage-note">${escapeHtmlBuild(st.note)}</span>` : ''}
    </div>
    <div class="cards">${cards}
    </div>`;
  }).join('');

  // Sidebar TOC nested list for stages
  const sidebarListHtml = fm.stages.map((st, i) => {
    const en = st.name_en || st.name;
    return `<li><a href="#stage-${i + 1}">${escapeHtmlBuild(en)}</a></li>`;
  }).join('\n        ');

  const pathSection = `
    <span class="section-anchor" id="path"></span>
    <div class="path-begin" role="presentation"><span class="path-begin-label">开始阅读 · Begin the path</span></div>
    ${stageCards}`;

  const html = `<!-- auto-link-skip -->${stagesSection}\n${pathSection}<!-- /auto-link-skip -->`;
  return { html, sidebarListHtml };
}

function relPathBuild(fromPath, toPath) {
  const fromParts = fromPath.split('/').slice(0, -1);
  const toParts = toPath.split('/');
  let common = 0;
  while (common < fromParts.length && common < toParts.length - 1 && fromParts[common] === toParts[common]) common++;
  const ups = fromParts.length - common;
  const downs = toParts.slice(common);
  return ('../'.repeat(ups) + downs.join('/')) || './';
}

/**
 * Inject .hub-badge links after .topic-hero or inside .hero-chips for a member page.
 * hubInfos: [{hubPath, hubCn, hubEn, hubPy}]
 */
function injectHubBadges(body, hubInfos, fromPath) {
  if (!hubInfos || !hubInfos.length) return body;
  const badges = hubInfos.map(h => {
    const href = relPathBuild(fromPath, h.hubPath) + '#path';
    const label = h.hubCn + (h.hubEn ? ` · ${h.hubEn}` : '') + ' hub →';
    return `<a class="hub-badge" href="${escapeHtmlBuild(href)}">${escapeHtmlBuild(label)}</a>`;
  }).join('\n      ');
  const block = `\n    <div class="hub-badges">\n      ${badges}\n    </div>`;

  // For character pages: inject inside .hero-chips area — after </header>
  if (body.includes('<div class="hero-chips">')) {
    return body.replace(/<\/header>/, `${block}\n  </header>`);
  }
  // For topic pages: inject after .topic-hero-desc's closing </p> — after </header>
  if (body.includes('class="topic-hero"')) {
    return body.replace(/<\/header>/, `${block}\n  </header>`);
  }
  return body;
}

/**
 * Compute a reading-time estimate for a content page body and return the
 * snippet to inject into the hero. Counts ASCII words at ~220 wpm and
 * CJK ideographs at ~300 cpm — separate baselines because the corpus is
 * roughly 60/40 English/Chinese and the two read at different speeds.
 * Floor of 2 minutes (a 1-min badge feels dismissive even for short cards).
 *
 * The hero badge uses a small mono caption matching .topic-hero-eyebrow's
 * typography ("~3 min read"). Skips family / hsk / hubs / explore index
 * pages — those are navigational, not articles.
 */
function readingMinutesFromBody(body) {
  const text = body
    .replace(/<button[^>]*class="toc-toggle"[^>]*>[\s\S]*?<\/button>/g, ' ')
    .replace(/<aside[^>]*class="sidebar"[^>]*>[\s\S]*?<\/aside>/g, ' ')
    .replace(/<header[^>]*class="(topic-hero|hero)"[^>]*>[\s\S]*?<\/header>/g, ' ')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/g, ' ')
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  const cjkChars = (text.match(/[一-鿿㐀-䶿]/g) || []).length;
  const asciiWords = (text.match(/[A-Za-z][A-Za-z'’-]*/g) || []).length;
  // 250 wpm for English (medium-fast adult reader); 400 cpm for CJK (a
  // proficient reader; learners will read slower but the badge is meant
  // to be a typical-reader floor, not a worst-case ceiling).
  const minutes = Math.ceil(asciiWords / 250 + cjkChars / 400);
  return Math.max(2, minutes);
}

function injectReadingTime(body, fm) {
  if (!fm || fm.status !== 'complete') return body;
  // Skip navigational / index page types.
  const skipCats = new Set(['families', 'hsk', 'hubs', 'explore']);
  if (skipCats.has(fm.category)) return body;
  if (body.includes('class="topic-hero-meta-time"')) return body; // already injected
  const minutes = readingMinutesFromBody(body);
  const block = `\n    <span class="topic-hero-meta-time" aria-label="Approximate reading time">~${minutes} min read</span>`;

  // For character pages (.hero with .hero-chips) or topic pages
  // (.topic-hero with eyebrow), insert before </header>.
  if (body.includes('class="topic-hero"') || body.includes('<div class="hero-chips">')) {
    return body.replace(/<\/header>/, `${block}\n  </header>`);
  }
  return body;
}

// ── helpers ─────────────────────────────────────────────────────────────────

function walk(dir) {
  const results = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith('_')) continue; // skip _schema, _source, _featured, etc.
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      results.push(...walk(full));
    } else if (name.endsWith('.md') && !name.startsWith('_')) {
      results.push(full);
    }
  }
  return results;
}

function hskDisplay(hsk) {
  if (!hsk) return '';
  if (typeof hsk === 'number') return String(hsk);
  return `${hsk.from}–${hsk.to}`;
}

function buildMetaComment(fm) {
  const obj = {};
  for (const k of ['type','char','pinyin','tone','hsk','radical','category','topic','tags','status']) {
    if (fm[k] !== undefined) obj[k] = fm[k];
  }
  // Carousel-exporter overrides — read by /pages/share/ if present. Embedding
  // them in the meta comment means share.js can pull authored hooks without
  // a separate fetch to entries.json (which doesn't carry per-page share blocks).
  if (fm.share) obj.share = fm.share;
  return JSON.stringify(obj);
}

// Strip tone diacritics to the bare-ASCII syllable searchers actually type
// ("xīn" → "xin", "yě" → "ye"). Mirrors the normalization in
// augment.mjs:injectPinyinIndexChip so title and pinyin-index agree.
function tonelessPinyin(pinyin) {
  return String(pinyin || '')
    .replace(/[āáǎà]/g, 'a').replace(/[ēéěè]/g, 'e').replace(/[īíǐì]/g, 'i')
    .replace(/[ōóǒò]/g, 'o').replace(/[ūúǔù]/g, 'u').replace(/[ǖǘǚǜü]/g, 'u')
    .toLowerCase().replace(/[^a-z ]/g, '').trim();
}

function buildPageTitle(fm) {
  // Hand-tuned SERP titles take priority for top-impression pages. These are
  // written to lead with the searched form (usually pinyin in romanized form)
  // and carry a concrete hook, since the SERP audience is overwhelmingly
  // English-reading and skips CJK-leading titles.
  if (fm.seo_title) return fm.seo_title;
  if (fm.type === 'character') {
    // Lead with the bare-ASCII pinyin (the token English searchers type), keep
    // the glyph as a parenthetical for relevance, then append the gloss and a
    // natural "in Chinese" tail that matches the dominant query shape
    // ("samsara in chinese", "ye pinyin"). appendGloss is a no-op here because
    // this string already contains "(" and "—".
    const ascii = tonelessPinyin(fm.pinyin);
    const gloss = extractEnglishGloss(fm);
    const lead = ascii ? `${ascii} (${fm.char})` : `${fm.char} ${fm.pinyin}`;
    if (gloss) return `${lead} — ${gloss} in Chinese`;
    return lead;
  }
  if (fm.type === 'hub' && fm.title) return fm.title.split('—')[0].trim();

  // Vocab / grammar / topic / chengyu: derive an English-leading SERP title
  // from the "CN [· CN] · EN gloss" title convention, so every page ships a
  // searcher-shaped title without waiting for a hand-tuned seo_title. This is
  // the same fix the character template got in the page-2→page-1 effort:
  // English searchers skip CJK-leading titles, and GSC query shapes are
  // pinyin-led for words ("gongzuo meaning") and gloss-led for topics
  // ("tang poetry"). Aggregate categories (families/hubs/hsk) keep their
  // authored titles.
  if (['vocab', 'chengyu', 'grammar', 'topic'].includes(fm.type)
      && !['families', 'hubs', 'hsk'].includes(fm.category)) {
    const parts = String(fm.title || '').split('·').map(s => s.trim()).filter(Boolean);
    let i = 0;
    while (i < parts.length && /[一-鿿]/.test(parts[i])) i++;
    const cn = parts.slice(0, i).join(' · ');
    const gloss = (parts.slice(i).join(' · ').split('—')[0].trim()) || extractEnglishGloss(fm);
    const ascii = tonelessPinyin(fm.pinyin).replace(/\s+/g, ' ');
    if (cn && gloss) {
      if (fm.type === 'topic') {
        return `${gloss} — ${cn}${ascii ? ' ' + ascii : ''}`;
      }
      if (fm.type === 'grammar') {
        const base = `${cn}${ascii ? ` (${ascii})` : ''} — ${gloss}`;
        return base.length <= 42 ? `${base} · Chinese grammar` : base;
      }
      // vocab + chengyu: lead with the bare-ASCII pinyin searchers type
      const lead = ascii ? `${ascii} (${cn})` : cn;
      const base = `${lead} — ${gloss}`;
      return base.length <= 49 ? `${base} in Chinese` : base;
    }
  }

  if (fm.title) return fm.title.split('·')[0].trim();
  return fm.title || '';
}

// Single source of truth for the SERP/OG title chain: hand-tuned seo_title
// wins; otherwise the derived English-leading buildPageTitle; authored
// pageTitle only survives for types the deriver doesn't cover.
function serpTitle(fm) {
  if (fm.seo_title) return fm.seo_title;
  const derivedTypes = ['character', 'vocab', 'chengyu', 'grammar', 'topic'];
  if (derivedTypes.includes(fm.type) && !['families', 'hubs', 'hsk'].includes(fm.category)) {
    return buildPageTitle(fm);
  }
  return fm.pageTitle || buildPageTitle(fm);
}

const SITE_URL = 'https://jiaoshoo.com';

const CATEGORY_LABELS = {
  characters: 'Chinese Characters', vocab: 'Vocabulary', grammar: 'Grammar',
  chengyu: 'Chengyu', religion: 'Religion', philosophy: 'Philosophy',
  history: 'History', geography: 'Geography', culture: 'Culture',
  culinary: 'Culinary', arts: 'Arts & Literature', science: 'Science & Medicine',
  daily: 'Daily Life', hubs: 'Reading Paths', hsk: 'HSK',
};

function buildBreadcrumbLd(fm, slug, category) {
  const url = `${SITE_URL}/pages/${category}/${slug}.html`;
  const catLabel = CATEGORY_LABELS[category] || category;
  const entryName = fm.char || (fm.title ? fm.title.split('·')[0].trim() : slug);
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Jiǎoluò Shūwū', item: SITE_URL + '/' },
      { '@type': 'ListItem', position: 2, name: catLabel, item: `${SITE_URL}/#cat-${category}` },
      { '@type': 'ListItem', position: 3, name: entryName, item: url },
    ],
  };
}

function buildJsonLd(fm, slug, category) {
  if (fm.status !== 'complete') return '';
  const url = `${SITE_URL}/pages/${category}/${slug}.html`;
  const description = fm.seo_desc || fm.metaDesc || fm.desc || '';
  const author = { '@type': 'Person', name: 'Hunter Dellere' };

  let termData;
  if (fm.type === 'character' || fm.type === 'vocab' || fm.type === 'grammar') {
    termData = {
      '@context': 'https://schema.org',
      '@type': 'DefinedTerm',
      name: fm.char || (fm.title ? fm.title.split('·')[0].trim() : slug),
      alternateName: fm.pinyin || undefined,
      description,
      inDefinedTermSet: 'Jiǎoluò Shūwū · 角落書屋',
      url,
      inLanguage: 'zh-Hans',
      author,
    };
  } else {
    termData = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: fm.title || slug,
      description,
      url,
      inLanguage: 'en',
      author,
      datePublished: fm.updated || undefined,
      dateModified: fm.updated || undefined,
      publisher: { '@type': 'Organization', name: 'Jiǎoluò Shūwū · 角落書屋' },
      mainEntityOfPage: url,
    };
  }
  // strip undefined keys
  for (const k of Object.keys(termData)) if (termData[k] === undefined) delete termData[k];

  const breadcrumb = buildBreadcrumbLd(fm, slug, category);

  const blocks = [
    `<script type="application/ld+json">${JSON.stringify(termData)}</script>`,
    `<script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>`,
  ];

  if (Array.isArray(fm.faq) && fm.faq.length > 0) {
    const faqLd = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: fm.faq
        .filter(qa => qa && qa.q && qa.a)
        .map(qa => ({
          '@type': 'Question',
          name: String(qa.q),
          acceptedAnswer: { '@type': 'Answer', text: String(qa.a) },
        })),
    };
    if (faqLd.mainEntity.length > 0) {
      blocks.push(`<script type="application/ld+json">${JSON.stringify(faqLd)}</script>`);
    }
  }

  return blocks.join('\n');
}

const LANG_LOCALE = {
  characters: 'zh_CN', vocab: 'zh_CN', grammar: 'zh_CN', chengyu: 'zh_CN',
};

function buildOgTags(fm, slug, category) {
  if (fm.status !== 'complete') return '';
  const url = `${SITE_URL}/pages/${category}/${slug}.html`;
  const ogPng = `${SITE_URL}/assets/og/${category}/${slug}.png`;
  const ogSvg = `${SITE_URL}/og/${category}/${slug}.svg`;
  const title = serpTitle(fm);
  const desc = fm.seo_desc || fm.metaDesc || fm.desc || '';
  const primaryLocale = LANG_LOCALE[category] || 'en_US';
  const alternateLocale = primaryLocale === 'zh_CN' ? 'en_US' : 'zh_CN';
  const altEntry = {
    category,
    char: fm.char,
    title: fm.title,
    pinyin: fm.pinyin,
  };
  const alt = ogAltText(altEntry);
  return [
    `<meta property="og:type" content="article">`,
    `<meta property="og:title" content="${escapeAttr(title)}">`,
    `<meta property="og:description" content="${escapeAttr(desc)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${ogPng}">`,
    `<meta property="og:image:type" content="image/png">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${escapeAttr(alt)}">`,
    `<meta property="og:image" content="${ogSvg}">`,
    `<meta property="og:image:type" content="image/svg+xml">`,
    `<meta property="og:site_name" content="Jiǎoluò Shūwū · 角落書屋">`,
    `<meta property="og:locale" content="${primaryLocale}">`,
    `<meta property="og:locale:alternate" content="${alternateLocale}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeAttr(title)}">`,
    `<meta name="twitter:description" content="${escapeAttr(desc)}">`,
    `<meta name="twitter:image" content="${ogPng}">`,
    `<meta name="twitter:image:alt" content="${escapeAttr(alt)}">`,
  ].join('\n');
}

function escapeAttr(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function extractEnglishGloss(fm) {
  // Prefer the English portion of the title field: "CN · EN [— extra]"
  if (fm.title && fm.title.includes('·')) {
    const afterDot = fm.title.split('·').slice(1).join('·').trim();
    const enGloss = afterDot.split('—')[0].trim();
    if (enGloss && enGloss.length <= 55) return enGloss;
  }
  // Fall back to a gloss extracted from the desc first line
  if (fm.desc) {
    const byDash = fm.desc.split(' — ')[0].trim();
    const gloss = byDash.length <= 50 ? byDash : fm.desc.split(',')[0].trim();
    if (gloss && gloss.length <= 55) return gloss;
  }
  return '';
}

function appendGloss(baseTitle, fm) {
  // Hand-tuned seo_title already encodes the hook + gloss in a single sentence;
  // appending another " — gloss" would just blow past the 60-char SERP budget.
  if (fm.seo_title) return baseTitle;
  if (baseTitle.includes('—') || baseTitle.includes('·')) return baseTitle;
  if (baseTitle.includes(':') || baseTitle.includes('(')) return baseTitle;
  const gloss = extractEnglishGloss(fm);
  return gloss ? `${baseTitle} — ${gloss}` : baseTitle;
}

function injectTopicHeroEn(body, fm) {
  if (!body.includes('topic-hero-title-py')) return body;
  if (body.includes('topic-hero-en')) return body;
  const gloss = extractEnglishGloss(fm);
  if (!gloss) return body;
  const escaped = gloss.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return body.replace(
    /(<span class="topic-hero-title-py">[^<]*<\/span>)/,
    `$1\n      <span class="topic-hero-en">${escaped}</span>`,
  );
}

function renderPage(fm, body, slug, category, prevNext) {
  const filename = `${slug}.html`;
  const metaComment = buildMetaComment(fm);
  // SERP title chain lives in serpTitle(): seo_title override, else the
  // English-leading derived title for all content types (characters, vocab,
  // chengyu, grammar, topics), else the authored pageTitle for aggregates.
  const rawTitle = serpTitle(fm);
  const needsGloss = fm.type === 'character' || fm.type === 'vocab' || fm.type === 'grammar' || fm.type === 'topic';
  const pageTitle = needsGloss ? appendGloss(rawTitle, fm) : rawTitle;
  const metaDesc = fm.seo_desc || fm.metaDesc || fm.desc || '';
  const jsonLd = buildJsonLd(fm, slug, category);
  const ogTags = buildOgTags(fm, slug, category);
  const favicon = categoryFaviconDataUri(category);
  const canonicalUrl = `${SITE_URL}/pages/${category}/${slug}.html`;

  // <link rel="prev"/rel="next"> for sibling characters. Lives in <head>
  // alongside canonical so search engines pick up the reading order.
  let prevNextLinks = '';
  if (prevNext) {
    const lines = [];
    if (prevNext.prev) lines.push(`<link rel="prev" href="${SITE_URL}/${encodeURI(prevNext.prev.path)}">`);
    if (prevNext.next) lines.push(`<link rel="next" href="${SITE_URL}/${encodeURI(prevNext.next.path)}">`);
    prevNextLinks = lines.join('\n');
  }

  // Stub pages get noindex,nofollow so they don't dilute topical authority.
  // Once flipped to status: complete, they index normally.
  const robotsMeta = (fm.status === 'stub' || fm.status === 'draft')
    ? `<meta name="robots" content="noindex,nofollow">`
    : '';

  let page = LAYOUT
    .replace('{{{metaComment}}}', metaComment)
    .replace('{{{pageTitle}}}', pageTitle)
    .replace('{{{metaDesc}}}', metaDesc)
    .replace('{{{jsonLd}}}', jsonLd)
    .replace('{{{ogTags}}}', ogTags)
    .replace('{{{prevNextLinks}}}', prevNextLinks)
    .replace('{{{robotsMeta}}}', robotsMeta)
    .replace('{{{favicon}}}', favicon)
    .replace('{{{canonicalUrl}}}', canonicalUrl)
    .replace('{{{pageBody}}}', injectTopicHeroEn(body, fm).trim());

  // On the master Explore page itself, strip the topnav "Explore" back-link
  // (it would just point at the current page). Random link stays.
  if (fm.family === 'explore') {
    page = page.replace(/\s*<a [^>]*class="topnav-back"[^>]*>[\s\S]*?<\/a>/, '');
  }

  return page;
}

function toEntryObject(fm, slug, category) {
  const path = `pages/${category}/${slug}.html`;
  const entry = {
    path,
    type: fm.type,
    category: fm.category || category,
    title: fm.title,
    desc: fm.desc,
    tags: fm.tags || [],
    status: fm.status,
  };

  if (fm.char)    entry.char    = fm.char;
  if (fm.pinyin)  entry.pinyin  = fm.pinyin;
  if (fm.tone)    entry.tone    = fm.tone;
  if (fm.hsk)     entry.hsk     = fm.hsk;
  if (fm.radical) entry.radical = fm.radical;
  if (fm.updated) entry.updated = fm.updated;

  if (fm.type === 'hub' && fm.stages) {
    entry.memberCount = fm.stages.reduce((n, s) => n + (s.members || []).length, 0);
  }

  return entry;
}

// ── main ────────────────────────────────────────────────────────────────────

const contentDir = join(ROOT, 'content');
const pagesDir   = join(ROOT, 'pages');
const dataDir    = join(ROOT, 'data');
mkdirSync(dataDir, { recursive: true });

const files = walk(contentDir).filter(f => {
  const rel = relative(contentDir, f);
  return !rel.startsWith('_schema');
});

// Pass 1: parse and validate all files; collect entries + bodies in memory.
const entries = [];
const pending = []; // { fm, body, slug, category, outDir }
let errors = 0;

for (const filePath of files) {
  const rel      = relative(contentDir, filePath);
  const parts    = rel.split('/');
  const category = parts[0];
  const slug     = basename(filePath, '.md');

  try {
    const raw  = readFileSync(filePath, 'utf8');
    const { data: fm, content: body } = matter(raw);
    validateEntry(fm, filePath);

    const outDir = join(pagesDir, category);
    mkdirSync(outDir, { recursive: true });

    const entry = toEntryObject(fm, slug, category);
    entries.push(entry);
    pending.push({ fm, body, slug, category, outDir, entry });
  } catch (err) {
    console.error(`\n✗ ${rel}\n${err.message}`);
    errors++;
  }
}

// Pass 1.5: compute cross-linking + hub membership
const relations = buildRelations(entries);
const adjacency = buildAdjacency(entries);
const hubMemberMap = buildHubMemberMap(pending);

// Precompute the set of pinyin syllables that will get a generated index page,
// so character-page augmentation can decide whether to render the
// "all <pinyin> readings →" chip without dead-linking.
const pinyinIndexPreview = buildPinyinIndex(entries);
const pinyinSyllableSet = new Set(
  [...pinyinIndexPreview.entries()].filter(([, g]) => g.entries.length > 0).map(([s]) => s)
);

// Reverse component index: hanzi → [pages mentioning this hanzi]. Used to
// inject an "Appears in" section on each character page (Session 4 of the
// growth plan). Doubles internal-link density without new content.
const componentIndex = buildComponentIndex(contentDir, entries);

// Simp ↔ trad lookup for hero stroke-order injection (used in pass 2).
const simpTradMap = buildSimpTradMap();

// Sibling-character ordering for prev/next nav + rel=prev/rel=next.
// Order primary by HSK level (1, 2, ..., 7-9), then within each level by
// pinyin alpha. Characters with no HSK level go to a final bucket sorted
// the same way. Yields a stable predictable reading order.
const characterEntries = entries
  .filter(e => e.status === 'complete' && e.type === 'character' && e.char);

function hskBucketKey(e) {
  if (typeof e.hsk === 'number') return String(e.hsk).padStart(2, '0');
  if (e.hsk && typeof e.hsk === 'object' && typeof e.hsk.from === 'number') return String(e.hsk.from).padStart(2, '0');
  return '99';
}
const characterOrder = characterEntries.slice().sort((a, b) => {
  const ka = hskBucketKey(a);
  const kb = hskBucketKey(b);
  if (ka !== kb) return ka.localeCompare(kb);
  return String(a.pinyin || '').localeCompare(String(b.pinyin || ''));
});
const characterPrevNext = new Map(); // path → { prev, next }
for (let i = 0; i < characterOrder.length; i++) {
  characterPrevNext.set(characterOrder[i].path, {
    prev: i > 0 ? characterOrder[i - 1] : null,
    next: i < characterOrder.length - 1 ? characterOrder[i + 1] : null,
  });
}

// Pass 2: augment body (stroke order, auto-link, pinyin audio, related, prev/next), render, write
let built = 0;
let autoLinkCount = 0;
for (const { fm, body, slug, category, outDir, entry } of pending) {
  try {
    let augmentedBody = body;

    // HSK level pages: substitute placeholder with generated list body
    if (category === 'hsk' && augmentedBody.includes('HSK_BODY_PLACEHOLDER')) {
      const levelMatch = slug.match(/^hsk-(.+)$/);
      if (levelMatch) {
        augmentedBody = renderHskBody(levelMatch[1], entries, ROOT);
      }
    }

    // Hub pages: inject "Other reading paths" nav into sidebar
    if (fm.type === 'hub') {
      const otherHubs = entries.filter(e => e.category === 'hubs' && e.path !== entry.path);
      if (otherHubs.length) {
        const depth = category === 'hubs' ? '../../' : '../';
        const hubLinks = otherHubs.map(h => {
          const cn = h.title ? h.title.split('·')[0].trim() : '';
          const en = h.title ? (h.title.split('·').slice(1).join('·').trim().split('—')[0].trim()) : '';
          const rel = relPathBuild(entry.path, h.path);
          return `<li><a class="toc-hub-link" href="${rel}"><span class="toc-hub-cn">${escapeHtmlBuild(cn)}</span><span class="toc-hub-en">${escapeHtmlBuild(en)}</span></a></li>`;
        }).join('\n        ');
        const hubNav = `\n    <div class="toc-divider"></div>\n    <span class="toc-label">Other reading paths</span>\n    <ul class="toc-list toc-hub-list">\n        ${hubLinks}\n    </ul>`;
        augmentedBody = augmentedBody.replace('</aside>', hubNav + '\n  </aside>');
      }
    }

    // Hub pages: inject stages section from frontmatter (if stages[] present)
    if (fm.type === 'hub' && fm.stages && fm.stages.length) {
      const { html: stagesHtml, sidebarListHtml } = renderHubStagesHtml(fm, slug, category);
      if (augmentedBody.includes('id="path"')) {
        // Remove old hand-typed #stages section if present
        augmentedBody = augmentedBody.replace(
          /<span class="section-anchor" id="stages"><\/span>[\s\S]*?(?=<span class="section-anchor" id="path">)/,
          ''
        );
        // Replace the authored "path" block with generated stages content.
        // Terminate at the NEXT section-anchor (not specifically "also") so
        // any in-between anchors like "questions" are preserved.
        augmentedBody = augmentedBody.replace(
          /<span class="section-anchor" id="path"><\/span>[\s\S]*?(?=<span class="section-anchor")/,
          stagesHtml + '\n\n    '
        );
      }
      // Inject nested stage list into sidebar TOC under the #path link
      if (sidebarListHtml) {
        augmentedBody = augmentedBody.replace(
          /(<li><a href="#path">[\s\S]*?<\/a><\/li>)/,
          `$1\n        <ul class="toc-sublist">\n        ${sidebarListHtml}\n        </ul>`
        );
      }
    }

    // Family-index pages: replace marker comments with rendered art / grids /
    // crosslinks. Family pages live under content/families/<key>.md and
    // declare `family` in frontmatter; we run before status === 'complete'
    // augmentations so their entry-cards and other autolinks aren't
    // disturbed. (Family pages are themselves status: complete and will
    // pass through the rest of the pipeline normally.)
    if (fm.family && augmentedBody.includes('<!--FAMILY_CONTENT-->')) {
      // Family hero is text-only — no decorative art layer behind the meta
      // block. Card art for family-cards (familyCardArt) is unaffected.
      augmentedBody = augmentedBody
        .replace('<!--FAMILY_CONTENT-->',    renderFamilyContent(fm.family, entries))
        .replace('<!--FAMILY_CROSSLINKS-->', renderFamilyCrosslinks(fm.family));
    }

    if (entry.status === 'complete') {
      // Hub badges on member pages
      const hubInfos = hubMemberMap.get(entry.path);
      if (hubInfos && hubInfos.length) {
        augmentedBody = injectHubBadges(augmentedBody, hubInfos, entry.path);
      }

      // Reading-time estimate in the hero. Cheap to compute (one regex pass),
      // visible on every content page, helps readers decide which pick to
      // open from the Today page or homepage.
      augmentedBody = injectReadingTime(augmentedBody, fm);

      // 1. Stroke order on character pages
      augmentedBody = injectStrokeOrder(augmentedBody, fm);

      // 1a. Animated hero glyphs — upgrade each `<span class="hero-glyph">`
      //     to an inline SVG that animates its strokes on first view. Falls
      //     back to the static glyph when stroke data isn't vendored.
      augmentedBody = injectHeroStrokes(augmentedBody, fm, simpTradMap);

      // 1b. Pinyin-index chip on character pages (links to /pinyin/<base>.html)
      augmentedBody = injectPinyinIndexChip(augmentedBody, fm, pinyinSyllableSet);

      // 2. Pinyin audio buttons in heroes (character + vocab/chengyu)
      augmentedBody = addPinyinAudio(augmentedBody, fm);

      // 2b. Inline audio buttons on chengyu cards & vocab compound cards
      augmentedBody = injectInlineAudio(augmentedBody);

      // 2c. Sutra passage refinements — ordinal numbering, marker trim,
      //     mantra modifier, action wrapping. No-op on non-sutra pages.
      augmentedBody = transformSutraPassages(augmentedBody);

      // 3a. Linkify Adjacent-Vocabulary chips first (Tier 1): if a chip's
      //     .a-cn matches an existing page, wrap the entire chip in <a> with
      //     a data-category attr for color signaling. Running this before
      //     autoLinkBody means the resulting <a class="adj"> is already an
      //     anchor by the time autolink runs — autolink's protect-list skips
      //     all <a> trees, so chips can't be double-wrapped.
      const chipMap = buildChipLinkMap(entries, entry);
      augmentedBody = linkifyAdjChips(augmentedBody, chipMap, entry.path);

      // 3b. Auto-link other entries (one link per target per page)
      const linkMap = buildLinkMap(entries, entry);
      const beforeLen = augmentedBody.length;
      augmentedBody = autoLinkBody(augmentedBody, linkMap, entry);
      if (augmentedBody.length !== beforeLen) autoLinkCount++;

      // 4. Hoist legacy "Adjacent Vocabulary" block into the new Related section.
      //    Capture the existing .adj-wrap (if any) and the section-head wrapping
      //    it, so we can move the chips into the Related section's chips slot
      //    and remove the standalone "#adjacent" anchor + section-head from body.
      let hoistedChipsHtml = '';
      const adjacentBlockRe = /<span class="section-anchor" id="adjacent"><\/span>\s*<div class="section-head">[\s\S]*?<\/div>\s*(<div class="adj-wrap">[\s\S]*?<\/div>)/;
      const adjMatch = augmentedBody.match(adjacentBlockRe);
      if (adjMatch) {
        hoistedChipsHtml = adjMatch[1];
        augmentedBody = augmentedBody.replace(adjacentBlockRe, '');
      } else {
        // Fallback: a bare .adj-wrap without the standard wrapper (rare).
        const bareWrapRe = /(<div class="adj-wrap">[\s\S]*?<\/div>)/;
        const bareMatch = augmentedBody.match(bareWrapRe);
        if (bareMatch) {
          hoistedChipsHtml = bareMatch[1];
          augmentedBody = augmentedBody.replace(bareWrapRe, '');
        }
      }

      // Rewrite any sidebar TOC link that pointed at the retired #adjacent
      // anchor → point at the new #related anchor with updated label.
      // Use a permissive match: any <li><a href="#adjacent">...</a></li>,
      // since some pages use varied toc-cn / toc-sub text ("Adjacent Vocab",
      // "related structures", etc.).
      augmentedBody = augmentedBody.replace(
        /<li><a href="#adjacent">[\s\S]*?<\/a><\/li>/g,
        `<li><a href="#related">\n        <span class="toc-cn">相关</span> Related\n        <span class="toc-sub">xiāngguān · pages &amp; vocab</span>\n      </a></li>`
      );

      // 5. Sources + related (cards + hoisted chips) + prev/next, injected before footer.
      // Family-index pages (category: 'families') intentionally skip Related and
      // prev-next: their sidebar already lists every other family + Explore, so
      // bottom nav is duplicate noise.
      const sourcesHtml = renderSourcesHtml(fm);
      const isFamilyPage = fm.category === 'families';
      const relatedHtml = isFamilyPage ? '' : renderRelatedHtml(
        relations.get(entry.path) || [],
        entry.path,
        { hasChips: Boolean(hoistedChipsHtml) }
      );
      const chipsTier = hoistedChipsHtml
        ? `<div class="related-chips-tier">\n        <span class="related-chips-head"><span class="rch-cn">词族</span> <span class="rch-py">cízú</span> <span class="rch-en">Vocabulary in this field</span></span>\n        ${hoistedChipsHtml}\n      </div>`
        : '';
      const relatedHtmlFilled = relatedHtml.replace('<!--RELATED_CHIPS_SLOT-->', chipsTier);

      const adjacencyHtml = isFamilyPage ? '' : renderAdjacencyHtml(adjacency.get(entry.path), entry.path);

      // Reverse component index: on character pages, list every other page
      // that contains this hanzi. Excludes self-page. Skipped on non-character
      // and family-index pages.
      let appearsInHtml = '';
      if (!isFamilyPage && fm.type === 'character' && fm.char) {
        const allMatches = (componentIndex.get(fm.char) || []).filter(e => e.path !== entry.path);
        if (allMatches.length) {
          appearsInHtml = renderAppearsInHtml(fm.char, allMatches, entry.path);
        }
      }

      const injection = `${sourcesHtml}${relatedHtmlFilled}${adjacencyHtml}${appearsInHtml}`;
      if (injection && augmentedBody.includes('</main>')) {
        augmentedBody = augmentedBody.replace('</main>', `${injection}\n  </main>`);
      }

      // If the page had no #adjacent TOC link AND we have anything to show in
      // Related, inject a TOC entry at the end of the toc-list so the new
      // section is discoverable from the sidebar.
      if (relatedHtmlFilled && !/href="#related"/.test(augmentedBody.split('</aside>')[0] || '')) {
        augmentedBody = augmentedBody.replace(
          /(<ul class="toc-list">[\s\S]*?)(<\/ul>)/,
          (m, listOpen, listClose) => {
            // Avoid double-injection if the regex above already added one.
            if (/href="#related"/.test(listOpen)) return m;
            return `${listOpen}      <li><a href="#related">\n        <span class="toc-cn">相关</span> Related\n        <span class="toc-sub">xiāngguān · pages &amp; vocab</span>\n      </a></li>\n    ${listClose}`;
          }
        );
      }

      // TOC entry for #appears-in (character pages only, when injected)
      if (appearsInHtml && !/href="#appears-in"/.test(augmentedBody.split('</aside>')[0] || '')) {
        augmentedBody = augmentedBody.replace(
          /(<ul class="toc-list">[\s\S]*?)(<\/ul>)/,
          (m, listOpen, listClose) => {
            if (/href="#appears-in"/.test(listOpen)) return m;
            return `${listOpen}      <li><a href="#appears-in">\n        <span class="toc-cn">出现于</span> Appears in\n        <span class="toc-sub">chūxiànyú · pages with this hanzi</span>\n      </a></li>\n    ${listClose}`;
          }
        );
      }
    }

    // Inject visible FAQ section if frontmatter has faq:
    if (Array.isArray(fm.faq) && fm.faq.length > 0 && augmentedBody.includes('</main>')) {
      const items = fm.faq
        .filter(qa => qa && qa.q && qa.a)
        .map(qa => `        <details class="faq-item"><summary class="faq-q">${escapeHtmlBuild(String(qa.q))}</summary><div class="faq-a">${escapeHtmlBuild(String(qa.a))}</div></details>`)
        .join('\n');
      if (items) {
        const faqHtml = `\n    <span class="section-anchor" id="faq"></span>\n    <div class="section-head"><span class="sh-cn">常见问题</span><span class="sh-py">chángjiàn wèntí</span><span class="sh-en">Frequently Asked Questions</span></div>\n    <div class="faq">\n${items}\n    </div>\n`;
        augmentedBody = augmentedBody.replace('</main>', `${faqHtml}  </main>`);
        // Inject TOC entry for FAQ if not already present in sidebar
        if (!/href="#faq"/.test((augmentedBody.split('</aside>')[0] || ''))) {
          augmentedBody = augmentedBody.replace(
            /(<ul class="toc-list">[\s\S]*?)(<\/ul>)/,
            (m, listOpen, listClose) => {
              if (/href="#faq"/.test(listOpen)) return m;
              return `${listOpen}      <li><a href="#faq">\n        <span class="toc-cn">常见问题</span> FAQ\n        <span class="toc-sub">chángjiàn wèntí</span>\n      </a></li>\n    ${listClose}`;
            }
          );
        }
      }
    }

    // Inject unified footer on all pages (strips authored stub if present)
    augmentedBody = buildPageFooter(augmentedBody, fm, slug, category);

    // Ensure skip-link target is present on every page
    augmentedBody = ensureMainContentId(augmentedBody);

    // HSK reading-order prev/next for character pages — emitted as
    // <link rel="prev"/rel="next"> in <head> only (powers j/k keyboard nav
    // and gives search engines an explicit reading-order graph). The
    // existing .pn-prev/.pn-next nav at the bottom of the page handles the
    // visible UI; we deliberately do not render a second visible block.
    const prevNext = (fm.type === 'character' && fm.status === 'complete')
      ? characterPrevNext.get(entry.path) : null;

    const html = renderPage(fm, augmentedBody, slug, category, prevNext);
    writeFileSync(join(outDir, `${slug}.html`), html, 'utf8');
    built++;
  } catch (err) {
    console.error(`\n✗ ${category}/${slug}\n${err.message}`);
    errors++;
  }
}

// Prune orphan pages: any pages/<category>/*.html without a matching content source
const expectedPaths = new Set(entries.map(e => e.path));
let pruned = 0;
const pagesRoot = join(ROOT, 'pages');
const PRUNE_SKIP = new Set(['hsk', 'maps', '_admin', 'pinyin', 'today', 'exports', 'share']);
for (const cat of readdirSync(pagesRoot)) {
  if (PRUNE_SKIP.has(cat)) continue;
  const catDir = join(pagesRoot, cat);
  if (!statSync(catDir).isDirectory()) continue;
  for (const name of readdirSync(catDir)) {
    if (!name.endsWith('.html')) continue;
    const rel = `pages/${cat}/${name}`;
    if (!expectedPaths.has(rel)) {
      unlinkSync(join(catDir, name));
      console.log(`  ⌫  pruned orphan: ${rel}`);
      pruned++;
    }
  }
}

// Sort entries: complete first, then stubs; within each group by updated desc
entries.sort((a, b) => {
  if (a.status !== b.status) return a.status === 'complete' ? -1 : 1;
  if (a.updated && b.updated) return b.updated.localeCompare(a.updated);
  return 0;
});

writeFileSync(join(dataDir, 'entries.json'), JSON.stringify(entries, null, 2), 'utf8');

// Reverse index for Adjacent Vocabulary chips: every chip-cn mapped to the
// pages that mention it, with `hasPage` flagging whether the chip is already
// auto-linked. Consumed by validate-adj-coverage.mjs to surface candidate
// vocab entries (high-frequency chips that don't have a page yet).
const adjIndex = buildAdjIndex(contentDir, entries);
writeFileSync(join(dataDir, 'adj-index.json'), JSON.stringify(adjIndex, null, 2), 'utf8');

// Build a path → plain-text body map for search indexing.
// Strip HTML tags and collapse whitespace; drop content inside the sidebar
// (it's navigation, not content) and inside <script>/<style>.
function extractBodyText(raw) {
  return raw
    .replace(/<button[^>]*class="toc-toggle"[^>]*>[\s\S]*?<\/button>/g, ' ')
    .replace(/<aside[^>]*class="sidebar"[^>]*>[\s\S]*?<\/aside>/g, ' ')
    .replace(/<header[^>]*class="(topic-hero|hero)"[^>]*>[\s\S]*?<\/header>/g, ' ')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/g, ' ')
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
const bodies = {};
for (const { body, entry } of pending) {
  if (entry.status !== 'complete') continue;
  bodies[entry.path] = extractBodyText(body);
}

const searchIndex = buildSearchIndex(entries, bodies);
writeFileSync(join(dataDir, 'search-index.json'), JSON.stringify(searchIndex), 'utf8');

// Recently added: real content entries only. Family-index pages and HSK
// list pages are navigational surfaces, not content — they'd otherwise
// dominate the Recently-added section every time the families/HSK build
// touched its `updated` field.
const NON_CONTENT_CATEGORIES = new Set(['families', 'hsk']);
const recent = entries
  .filter(e => e.status === 'complete' && e.updated && !NON_CONTENT_CATEGORIES.has(e.category))
  .sort((a, b) => b.updated.localeCompare(a.updated))
  .slice(0, 20);
writeFileSync(join(dataDir, 'recent.json'), JSON.stringify(recent, null, 2), 'utf8');

// Daily featured rotation — copy curated content/_featured/daily.json into data/
try {
  const featuredSrc = join(ROOT, 'content', '_featured', 'daily.json');
  const featured = JSON.parse(readFileSync(featuredSrc, 'utf8'));
  writeFileSync(join(dataDir, 'featured.json'), JSON.stringify(featured), 'utf8');
} catch (err) {
  console.warn('Could not emit data/featured.json:', err.message);
}

// Pinyin index pages — generated from entries; capture the long-tail
// "[pinyin] chinese character" search query and disambiguate polyphones.
const { generated: pinyinPaths } = emitPinyinPages(entries, pagesDir);

// Sitemap + robots
const today = new Date().toISOString().slice(0, 10);
function encodeSitemapUrl(rawUrl) {
  // Percent-encode any non-ASCII characters; leave ASCII and already-encoded sequences alone
  return rawUrl.replace(/[^\x00-\x7F]/g, c => encodeURIComponent(c));
}

const contentUrls = [
  { loc: SITE_URL + '/', lastmod: today, priority: '1.0', changefreq: 'weekly' },
  // Hand-authored evergreen pages — group with content for crawler ergonomics.
  { loc: SITE_URL + '/pages/today/', lastmod: today, priority: '0.7', changefreq: 'daily' },
  { loc: SITE_URL + '/pages/exports/', lastmod: today, priority: '0.5', changefreq: 'weekly' },
  ...entries
    .filter(e => e.status === 'complete')
    .map(e => ({
      loc: encodeSitemapUrl(`${SITE_URL}/${e.path}`),
      lastmod: e.updated || today,
      priority: '0.8',
      changefreq: 'monthly',
    })),
];
const pinyinUrls = pinyinPaths.map(p => ({
  loc: encodeSitemapUrl(`${SITE_URL}/${p}`),
  lastmod: today,
  priority: '0.6',
  changefreq: 'monthly',
}));

function renderUrlset(urls) {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(u =>
      `  <url>\n` +
      `    <loc>${u.loc}</loc>\n` +
      `    <lastmod>${u.lastmod}</lastmod>\n` +
      `    <changefreq>${u.changefreq}</changefreq>\n` +
      `    <priority>${u.priority}</priority>\n` +
      `  </url>`
    ).join('\n') +
    `\n</urlset>\n`
  );
}

writeFileSync(join(ROOT, 'sitemap-content.xml'), renderUrlset(contentUrls), 'utf8');
writeFileSync(join(ROOT, 'sitemap-pinyin.xml'),  renderUrlset(pinyinUrls),  'utf8');

// sitemap.xml is the index referencing the two children. Search engines
// follow either form; this one keeps the per-section lastmod accurate
// (a content edit doesn't bust the pinyin sitemap's freshness signal).
const sitemapXml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  `  <sitemap><loc>${SITE_URL}/sitemap-content.xml</loc><lastmod>${today}</lastmod></sitemap>\n` +
  `  <sitemap><loc>${SITE_URL}/sitemap-pinyin.xml</loc><lastmod>${today}</lastmod></sitemap>\n` +
  `</sitemapindex>\n`;
writeFileSync(join(ROOT, 'sitemap.xml'), sitemapXml, 'utf8');

const robotsTxt =
  `User-agent: *\n` +
  `Allow: /\n\n` +
  `Sitemap: ${SITE_URL}/sitemap.xml\n`;
writeFileSync(join(ROOT, 'robots.txt'), robotsTxt, 'utf8');

// RSS feed (latest 30 entries)
function rssEscape(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
const rssItems = entries
  .filter(e => e.status === 'complete' && e.updated)
  .slice()
  .sort((a, b) => b.updated.localeCompare(a.updated))
  .slice(0, 30)
  .map(e => {
    const url = `${SITE_URL}/${e.path}`;
    const pubDate = new Date(e.updated + 'T00:00:00Z').toUTCString();
    return `    <item>
      <title>${rssEscape(e.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${rssEscape(e.desc)}</description>
      <category>${rssEscape(e.category)}</category>
    </item>`;
  })
  .join('\n');
const rssXml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n` +
  `  <channel>\n` +
  `    <title>Jiǎoluò Shūwū · 角落書屋</title>\n` +
  `    <link>${SITE_URL}/</link>\n` +
  `    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />\n` +
  `    <description>${rssEscape(BRAND.description)}</description>\n` +
  `    <language>en</language>\n` +
  `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n` +
  rssItems + `\n` +
  `  </channel>\n` +
  `</rss>\n`;
writeFileSync(join(ROOT, 'feed.xml'), rssXml, 'utf8');

// Per-entry OG cards — SVG (fallback) + PNG (primary, 1200×630)
// The PNG is the primary og:image because most unfurlers (Twitter/X,
// LinkedIn, iMessage, Slack, WeChat) handle PNG more reliably than SVG.
// SVG stays as a secondary tag for SVG-friendly clients.
//
// PNGs are cached in data/og-manifest.json keyed by content hash of
// (svg + font corpus) so warm builds skip rasterization when unchanged.
const ogSvgDir = join(ROOT, 'og');
const ogPngDir = join(ROOT, 'assets', 'og');
mkdirSync(ogSvgDir, { recursive: true });
mkdirSync(ogPngDir, { recursive: true });

const ogManifestPath = join(ROOT, 'data', 'og-manifest.json');
let ogManifest = {};
try { ogManifest = JSON.parse(readFileSync(ogManifestPath, 'utf8')); } catch { ogManifest = {}; }
const nextOgManifest = {};

let ogSvgWritten = 0;
let ogPngWritten = 0;
let ogPngCached = 0;

// Stage 1: emit SVGs and queue PNG work.
const pngJobs = [];
for (const e of entries) {
  if (e.status !== 'complete') continue;
  const slug = basename(e.path, '.html');
  const cat = e.category;

  const svgDir = join(ogSvgDir, cat);
  mkdirSync(svgDir, { recursive: true });
  const svg = renderOgSvg(e);
  writeFileSync(join(svgDir, `${slug}.svg`), svg, 'utf8');
  ogSvgWritten++;

  const pngDir = join(ogPngDir, cat);
  mkdirSync(pngDir, { recursive: true });
  const pngPath = join(pngDir, `${slug}.png`);
  const key = `${cat}/${slug}`;
  const hash = ogContentHash(svg);
  nextOgManifest[key] = hash;
  let needsRender = true;
  try {
    if (ogManifest[key] === hash) {
      statSync(pngPath);
      needsRender = false;
      ogPngCached++;
    }
  } catch { /* missing file — render */ }
  if (needsRender) pngJobs.push({ svg, pngPath });
}

// Stage 2: rasterize PNGs in parallel batches to amortize per-call cost.
// resvg-js is sync per call but Node will let us interleave I/O cleanly
// via Promise.all on micro-batches.
const BATCH = 16;
for (let i = 0; i < pngJobs.length; i += BATCH) {
  const slice = pngJobs.slice(i, i + BATCH);
  await Promise.all(slice.map(async (job) => {
    const png = rasterizeOgSvg(job.svg);
    writeFileSync(job.pngPath, png);
    ogPngWritten++;
  }));
}

// Homepage OG card — same parchment, brand wordmark, tagline.
const homepageSvg = renderHomepageOgSvg();
writeFileSync(join(ROOT, 'assets', 'og-image.svg'), homepageSvg, 'utf8');
const homepageKey = '__homepage';
const homepageHash = ogContentHash(homepageSvg);
nextOgManifest[homepageKey] = homepageHash;
const homepagePngPath = join(ROOT, 'assets', 'og-image.png');
let homepageNeeds = true;
try {
  if (ogManifest[homepageKey] === homepageHash) {
    statSync(homepagePngPath);
    homepageNeeds = false;
    ogPngCached++;
  }
} catch { /* render */ }
if (homepageNeeds) {
  writeFileSync(homepagePngPath, rasterizeOgSvg(homepageSvg));
  ogPngWritten++;
}

writeFileSync(ogManifestPath, JSON.stringify(nextOgManifest, null, 2) + '\n', 'utf8');

// PWA manifest
const manifest = {
  name: '角落書屋',
  short_name: '角落書屋',
  description: BRAND.description,
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: '#f2e8d5',
  theme_color: '#1c1208',
  lang: 'en',
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
  ]
};
writeFileSync(join(ROOT, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2), 'utf8');

// Brand strings — emit once per build so client-side renderers (the
// carousel exporter at /pages/share/) can read the same source of truth
// the homepage OG card and PWA manifest use. Single edit point in
// build/lib/brand.mjs propagates everywhere.
writeFileSync(join(dataDir, 'brand.json'), JSON.stringify(BRAND, null, 2) + '\n', 'utf8');

console.log(`\nBuild complete: ${built} pages written, ${pruned} pruned, ${errors} errors.`);
console.log(`OG cards: ${ogSvgWritten} SVGs · ${ogPngWritten} PNGs rasterized · ${ogPngCached} cached.`);
console.log(`Sitemap: ${contentUrls.length} content + ${pinyinUrls.length} pinyin URLs (sitemap-index).`);
console.log(`Auto-linked: ${autoLinkCount}/${pending.length} pages.`);

// ── Admin dashboard (last: depends on entries.json being fresh) ────────────
// Runs validate-facts for machine-readable findings, then generates the admin
// page. Validator errors do NOT fail the build — the admin page IS the surface
// for seeing those errors. Hard gating lives in `npm run check`.
try {
  const { spawnSync } = await import('node:child_process');
  const vf = spawnSync(process.execPath, [join(__dirname, 'validate-facts.mjs')], { stdio: 'inherit' });
  const admin = spawnSync(process.execPath, [join(__dirname, 'build-admin.mjs')], { stdio: 'inherit' });
  if (admin.status !== 0) console.warn('build-admin: exited non-zero (admin page may be stale)');
  // Pleco/Anki flashcard exports — read entries.json so they pick up any
  // pages added in this build. Soft-fail (warn) so a corrupt export
  // doesn't break the deploy.
  const exports = spawnSync(process.execPath, [join(__dirname, 'build-exports.mjs')], { stdio: 'inherit' });
  if (exports.status !== 0) console.warn('build-exports: exited non-zero (exports may be stale)');
} catch (e) {
  console.warn('admin pipeline failed:', e.message);
}

if (errors) process.exit(1);
