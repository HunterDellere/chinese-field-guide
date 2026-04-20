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
import { injectStrokeOrder, buildLinkMap, autoLinkBody, addPinyinAudio, buildPageFooter, renderSourcesHtml, ensureMainContentId } from './lib/augment.mjs';
import { renderOgSvg, categoryFaviconDataUri } from './lib/og.mjs';

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
 * 'characters/cha2_茶' → 'cha2'
 * 'culinary/topic_cha' → 'topic_cha'
 */
function cardId(memberSlug) {
  const base = memberSlug.split('/').pop();
  // If basename contains an underscore followed by a non-ASCII char, keep only the ASCII prefix
  const asciiPrefix = base.match(/^([A-Za-z0-9_-]+)_[^\x00-\x7F]/);
  return asciiPrefix ? asciiPrefix[1] : base;
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
  return JSON.stringify(obj);
}

function buildPageTitle(fm) {
  if (fm.type === 'character') return `${fm.char} ${fm.pinyin}`;
  if (fm.title) return fm.title.split('·')[0].trim();
  return fm.title || '';
}

const SITE_URL = 'https://jiaoshoo.com';

function buildJsonLd(fm, slug, category) {
  if (fm.status !== 'complete') return '';
  const url = `${SITE_URL}/pages/${category}/${slug}.html`;
  const description = fm.metaDesc || fm.desc || '';
  const author = { '@type': 'Person', name: 'Hunter Dellere' };

  let data;
  if (fm.type === 'character' || fm.type === 'vocab' || fm.type === 'grammar') {
    data = {
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
    data = {
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
  for (const k of Object.keys(data)) if (data[k] === undefined) delete data[k];
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

function buildOgTags(fm, slug, category) {
  if (fm.status !== 'complete') return '';
  const url = `${SITE_URL}/pages/${category}/${slug}.html`;
  const ogImg = `${SITE_URL}/og/${category}/${slug}.svg`;
  const title = fm.pageTitle || buildPageTitle(fm);
  const desc = fm.metaDesc || fm.desc || '';
  return [
    `<meta property="og:type" content="article">`,
    `<meta property="og:title" content="${escapeAttr(title)}">`,
    `<meta property="og:description" content="${escapeAttr(desc)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${ogImg}">`,
    `<meta property="og:site_name" content="Jiǎoluò Shūwū · 角落書屋">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeAttr(title)}">`,
    `<meta name="twitter:description" content="${escapeAttr(desc)}">`,
    `<meta name="twitter:image" content="${ogImg}">`,
  ].join('\n');
}

function escapeAttr(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function renderPage(fm, body, slug, category) {
  const filename = `${slug}.html`;
  const metaComment = buildMetaComment(fm);
  const pageTitle = fm.pageTitle || buildPageTitle(fm);
  const metaDesc = fm.metaDesc || fm.desc || '';
  const jsonLd = buildJsonLd(fm, slug, category);
  const ogTags = buildOgTags(fm, slug, category);
  const favicon = categoryFaviconDataUri(category);

  const page = LAYOUT
    .replace('{{{metaComment}}}', metaComment)
    .replace('{{{pageTitle}}}', pageTitle)
    .replace('{{{metaDesc}}}', metaDesc)
    .replace('{{{jsonLd}}}', jsonLd)
    .replace('{{{ogTags}}}', ogTags)
    .replace('{{{favicon}}}', favicon)
    .replace('{{{pageBody}}}', body.trim());

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

    if (entry.status === 'complete') {
      // Hub badges on member pages
      const hubInfos = hubMemberMap.get(entry.path);
      if (hubInfos && hubInfos.length) {
        augmentedBody = injectHubBadges(augmentedBody, hubInfos, entry.path);
      }

      // 1. Stroke order on character pages
      augmentedBody = injectStrokeOrder(augmentedBody, fm);

      // 2. Pinyin audio buttons in heroes
      augmentedBody = addPinyinAudio(augmentedBody, fm);

      // 3. Auto-link other entries (one link per target per page)
      const linkMap = buildLinkMap(entries, entry);
      const beforeLen = augmentedBody.length;
      augmentedBody = autoLinkBody(augmentedBody, linkMap, entry);
      if (augmentedBody.length !== beforeLen) autoLinkCount++;

      // 4. Sources + related entries + prev/next at the bottom (inject before footer)
      const sourcesHtml = renderSourcesHtml(fm);
      const relatedHtml = renderRelatedHtml(relations.get(entry.path) || [], entry.path);
      const adjacencyHtml = renderAdjacencyHtml(adjacency.get(entry.path), entry.path);
      const injection = `${sourcesHtml}${relatedHtml}${adjacencyHtml}`;
      if (injection && augmentedBody.includes('</main>')) {
        augmentedBody = augmentedBody.replace('</main>', `${injection}\n  </main>`);
      }

    }

    // Inject unified footer on all pages (strips authored stub if present)
    augmentedBody = buildPageFooter(augmentedBody, fm, slug, category);

    // Ensure skip-link target is present on every page
    augmentedBody = ensureMainContentId(augmentedBody);

    const html = renderPage(fm, augmentedBody, slug, category);
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
for (const cat of readdirSync(pagesRoot)) {
  if (cat === 'hsk') continue;
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

const recent = entries
  .filter(e => e.status === 'complete' && e.updated)
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

// Sitemap + robots
const today = new Date().toISOString().slice(0, 10);
const urls = [
  { loc: SITE_URL + '/', lastmod: today, priority: '1.0', changefreq: 'weekly' },
  ...entries
    .filter(e => e.status === 'complete')
    .map(e => ({
      loc: `${SITE_URL}/${e.path}`,
      lastmod: e.updated || today,
      priority: '0.8',
      changefreq: 'monthly',
    })),
];
const sitemapXml =
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
  `\n</urlset>\n`;
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
  `    <description>Notes on Chinese language and civilisation — characters, vocabulary, grammar, history, philosophy, and the world they shaped.</description>\n` +
  `    <language>en</language>\n` +
  `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n` +
  rssItems + `\n` +
  `  </channel>\n` +
  `</rss>\n`;
writeFileSync(join(ROOT, 'feed.xml'), rssXml, 'utf8');

// Per-entry OG SVG cards
const ogDir = join(ROOT, 'og');
mkdirSync(ogDir, { recursive: true });
let ogWritten = 0;
for (const e of entries) {
  if (e.status !== 'complete') continue;
  const slug = basename(e.path, '.html');
  const cat = e.category;
  const dir = join(ogDir, cat);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${slug}.svg`), renderOgSvg(e), 'utf8');
  ogWritten++;
}

// PWA manifest
const manifest = {
  name: 'Jiǎoluò Shūwū · 角落書屋',
  short_name: 'Jiǎoluò Shūwū',
  description: 'Notes on Chinese language and civilisation — characters, vocabulary, grammar, history, philosophy, and the world they shaped.',
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

console.log(`\nBuild complete: ${built} pages written, ${pruned} pruned, ${errors} errors.`);
console.log(`OG cards: ${ogWritten} SVGs generated.`);
console.log(`Sitemap: ${urls.length} URLs.`);
console.log(`Auto-linked: ${autoLinkCount}/${pending.length} pages.`);
if (errors) process.exit(1);
