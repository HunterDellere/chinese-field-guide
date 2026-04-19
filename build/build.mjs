#!/usr/bin/env node
/**
 * build.mjs — Chinese Field Guide build system
 *
 * Reads:  content/<category>/<slug>.md  (frontmatter + HTML body)
 * Writes: pages/<category>/<slug>.html
 *         data/entries.json
 *         data/search-index.json
 *         data/recent.json
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename, relative } from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { validateEntry } from './lib/validate.mjs';
import { buildSearchIndex } from './lib/search-index.mjs';
import { buildRelations, buildAdjacency, renderRelatedHtml, renderAdjacencyHtml } from './lib/relations.mjs';
import { injectStrokeOrder, buildLinkMap, autoLinkBody, addPinyinAudio, addErrataLink } from './lib/augment.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');

const LAYOUT = readFileSync(join(ROOT, 'templates/_layout.html'), 'utf8');

// ── helpers ─────────────────────────────────────────────────────────────────

function walk(dir) {
  const results = [];
  for (const name of readdirSync(dir)) {
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

const SITE_URL = 'https://hunterdellere.github.io/chinese-field-guide';

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
      inDefinedTermSet: 'Field Notes on Chinese',
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
      publisher: { '@type': 'Organization', name: 'Field Notes on Chinese' },
      mainEntityOfPage: url,
    };
  }
  // strip undefined keys
  for (const k of Object.keys(data)) if (data[k] === undefined) delete data[k];
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

function renderPage(fm, body, slug, category) {
  const filename = `${slug}.html`;
  const metaComment = buildMetaComment(fm);
  const pageTitle = fm.pageTitle || buildPageTitle(fm);
  const metaDesc = fm.metaDesc || fm.desc || '';
  const jsonLd = buildJsonLd(fm, slug, category);

  const page = LAYOUT
    .replace('{{{metaComment}}}', metaComment)
    .replace('{{{pageTitle}}}', pageTitle)
    .replace('{{{metaDesc}}}', metaDesc)
    .replace('{{{jsonLd}}}', jsonLd)
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

// Pass 1.5: compute cross-linking
const relations = buildRelations(entries);
const adjacency = buildAdjacency(entries);

// Pass 2: augment body (stroke order, auto-link, pinyin audio, related, prev/next), render, write
let built = 0;
let autoLinkCount = 0;
for (const { fm, body, slug, category, outDir, entry } of pending) {
  try {
    let augmentedBody = body;

    if (entry.status === 'complete') {
      // 1. Stroke order on character pages
      augmentedBody = injectStrokeOrder(augmentedBody, fm);

      // 2. Pinyin audio buttons in heroes
      augmentedBody = addPinyinAudio(augmentedBody, fm);

      // 3. Auto-link other entries (one link per target per page)
      const linkMap = buildLinkMap(entries, entry);
      const beforeLen = augmentedBody.length;
      augmentedBody = autoLinkBody(augmentedBody, linkMap, entry);
      if (augmentedBody.length !== beforeLen) autoLinkCount++;

      // 3.5 Errata link in footer
      augmentedBody = addErrataLink(augmentedBody, fm, slug);

      // 4. Related entries + prev/next at the bottom
      const relatedHtml = renderRelatedHtml(relations.get(entry.path) || [], entry.path);
      const adjacencyHtml = renderAdjacencyHtml(adjacency.get(entry.path), entry.path);
      const injection = `${relatedHtml}${adjacencyHtml}`;
      if (injection) {
        if (augmentedBody.includes('<footer class="page-footer">')) {
          augmentedBody = augmentedBody.replace(
            '<footer class="page-footer">',
            `${injection}\n\n    <footer class="page-footer">`
          );
        } else if (augmentedBody.includes('</main>')) {
          augmentedBody = augmentedBody.replace('</main>', `${injection}\n  </main>`);
        }
      }
    }

    const html = renderPage(fm, augmentedBody, slug, category);
    writeFileSync(join(outDir, `${slug}.html`), html, 'utf8');
    built++;
  } catch (err) {
    console.error(`\n✗ ${category}/${slug}\n${err.message}`);
    errors++;
  }
}

// Sort entries: complete first, then stubs; within each group by updated desc
entries.sort((a, b) => {
  if (a.status !== b.status) return a.status === 'complete' ? -1 : 1;
  if (a.updated && b.updated) return b.updated.localeCompare(a.updated);
  return 0;
});

writeFileSync(join(dataDir, 'entries.json'), JSON.stringify(entries, null, 2), 'utf8');

const searchIndex = buildSearchIndex(entries);
writeFileSync(join(dataDir, 'search-index.json'), JSON.stringify(searchIndex), 'utf8');

const recent = entries
  .filter(e => e.status === 'complete' && e.updated)
  .sort((a, b) => b.updated.localeCompare(a.updated))
  .slice(0, 20);
writeFileSync(join(dataDir, 'recent.json'), JSON.stringify(recent, null, 2), 'utf8');

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
  `    <title>Field Notes on Chinese</title>\n` +
  `    <link>${SITE_URL}/</link>\n` +
  `    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />\n` +
  `    <description>A field guide to Chinese — characters, language, and the long civilisation behind them.</description>\n` +
  `    <language>en</language>\n` +
  `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n` +
  rssItems + `\n` +
  `  </channel>\n` +
  `</rss>\n`;
writeFileSync(join(ROOT, 'feed.xml'), rssXml, 'utf8');

console.log(`\nBuild complete: ${built} pages written, ${errors} errors.`);
console.log(`Sitemap: ${urls.length} URLs.`);
console.log(`Auto-linked: ${autoLinkCount}/${pending.length} pages.`);
if (errors) process.exit(1);
