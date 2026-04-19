import { readFileSync, writeFileSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import matter from 'gray-matter';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const cats = ['characters','vocab','grammar','religion','philosophy','history'];

let updated = 0;
for (const cat of cats) {
  // Get list of html files in this category from git HEAD
  let files;
  try {
    const out = execSync(`git ls-tree --name-only HEAD pages/${cat}/`, { cwd: ROOT }).toString();
    files = out.trim().split('\n').filter(f => f.endsWith('.html')).map(f => basename(f));
  } catch { continue; }

  for (const f of files) {
    const gitPath = `pages/${cat}/${f}`;
    let html;
    try {
      html = execSync(`git show HEAD:${gitPath}`, { cwd: ROOT }).toString();
    } catch { continue; }

    const m = html.match(/<meta name="description" content="([^"]+)">/);
    if (!m) continue;
    const metaDesc = m[1];

    const mdPath = join(ROOT, 'content', cat, basename(f, '.html') + '.md');
    const raw = readFileSync(mdPath, 'utf8');
    const parsed = matter(raw);

    if (parsed.data.metaDesc === metaDesc) { continue; }
    parsed.data.metaDesc = metaDesc;
    writeFileSync(mdPath, matter.stringify(parsed.content, parsed.data), 'utf8');
    console.log(`  ✓ ${cat}/${basename(f, '.html')}`);
    updated++;
  }
}
console.log(`\n${updated} files updated with original meta descriptions.`);
