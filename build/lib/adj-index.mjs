/**
 * adj-index.mjs — Build a reverse index of "Adjacent Vocabulary" chips.
 *
 * For every chip authored as
 *     <span class="adj"><span class="a-cn">CN</span>...</span>
 * across content/**.md, this produces:
 *
 *   {
 *     "CN": {
 *       "cn": "CN",
 *       "py": "pinyin (taken from .a-py of the first occurrence)",
 *       "en": "english gloss (from .a-en of the first occurrence)",
 *       "count": 7,
 *       "appearsOn": ["pages/characters/...", ...],
 *       "hasPage": false
 *     },
 *     ...
 *   }
 *
 * `hasPage` is true iff a built page exists whose primary CN phrase matches
 * the chip — i.e., this chip is already a clickable link via linkifyAdjChips.
 *
 * Intended uses:
 *   - validate-adj-coverage.mjs surfaces high-frequency unbuilt chips as
 *     candidate-page suggestions in the admin dashboard.
 *   - Future feature: chip hover tooltip "appears alongside X, Y, Z".
 */

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

// Match a canonical chip:
//   <span class="adj"[any attrs]><span class="a-cn">CN</span><span class="a-py">PY</span><span class="a-en">EN</span></span>
// Authors may also wrap the chip in <a class="adj"> directly; match that too.
const CHIP_RE = /<(?:span|a)\s+class="adj"(?:\s[^>]*)?>\s*<span class="a-cn">([^<]+)<\/span>\s*<span class="a-py">([^<]*)<\/span>\s*<span class="a-en">([^<]*)<\/span>\s*<\/(?:span|a)>/g;

/**
 * Walk a directory, returning all .md file paths (recursive, ignoring
 * underscore-prefixed dirs like _schema).
 */
function walkMd(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith('_')) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) out.push(...walkMd(full));
    else if (name.endsWith('.md')) out.push(full);
  }
  return out;
}

/**
 * Build the reverse index by scanning content/**.md.
 * `entries` is the output of data/entries.json.
 */
export function buildAdjIndex(contentRoot, entries) {
  const index = new Map();

  // Pages that exist as built entries — used to set hasPage.
  // Match by the leading CN phrase of each entry's title and by entry.char.
  const builtCnPhrases = new Set();
  for (const e of entries) {
    if (e.status !== 'complete') continue;
    if (e.char) builtCnPhrases.add(e.char);
    if (e.title) {
      const cn = e.title.split('·')[0].trim();
      if (cn) builtCnPhrases.add(cn);
    }
  }

  for (const fp of walkMd(contentRoot)) {
    const src = fs.readFileSync(fp, 'utf8');
    const { content, data: fm } = matter(src);
    // Compute the page path the same way build.mjs does:
    //   content/<category>/<slug>.md → pages/<category>/<slug>.html
    const rel = path.relative(contentRoot, fp).replace(/\\/g, '/');
    const pagePath = `pages/${rel.replace(/\.md$/, '.html')}`;

    let m;
    CHIP_RE.lastIndex = 0;
    while ((m = CHIP_RE.exec(content)) !== null) {
      const cn = m[1].trim();
      const py = m[2].trim();
      const en = m[3].trim();
      if (!cn) continue;
      let entry = index.get(cn);
      if (!entry) {
        entry = {
          cn,
          py,
          en,
          count: 0,
          appearsOn: [],
          hasPage: builtCnPhrases.has(cn),
        };
        index.set(cn, entry);
      }
      entry.count += 1;
      // De-dupe page list (a single source page can list a chip more than once)
      if (!entry.appearsOn.includes(pagePath)) entry.appearsOn.push(pagePath);
    }
  }

  // Convert to a stable, sorted plain object for JSON output:
  // ordered by count desc, then cn (Chinese-aware locale).
  const sorted = [...index.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.cn.localeCompare(b.cn, 'zh-Hans');
  });

  const out = {};
  for (const e of sorted) out[e.cn] = e;
  return out;
}
