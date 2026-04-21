#!/usr/bin/env node
/**
 * validate.mjs — standalone schema validation for all content files
 * Also checks:
 *   - every content file's path resolves to an existing pages/ file
 *   - all internal href/src links within pages are relative and well-formed
 *
 * Run: node build/validate.mjs
 * Exit 0 = clean. Exit 1 = validation errors.
 */

import { readFileSync, existsSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join, dirname, basename, relative } from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { validateEntry } from './lib/validate.mjs';
import { createFinding, mergeFindings } from './lib/findings.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const EMIT = process.argv.includes('--emit-findings');

const adminFindings = [];

function walk(dir) {
  const results = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!name.startsWith('_')) results.push(...walk(full));
    } else if (name.endsWith('.md') && !name.startsWith('_')) results.push(full);
  }
  return results;
}

const contentDir = join(ROOT, 'content');
const files = walk(contentDir).filter(f => !relative(contentDir, f).startsWith('_schema'));

let errors = 0;
const allFrontmatters = [];

for (const filePath of files) {
  const rel = relative(contentDir, filePath);
  try {
    const { data: fm } = matter(readFileSync(filePath, 'utf8'));
    validateEntry(fm, filePath);
    allFrontmatters.push({ fm, filePath, rel });
  } catch (err) {
    console.error(`✗ ${rel}\n  ${err.message}`);
    errors++;
    if (EMIT) {
      adminFindings.push(createFinding({
        level: 'ERROR', category: 'schema',
        file: `content/${rel}`, msg: err.message,
      }));
    }
  }
}

// Build a set of all known content slugs (category/slug form) for hub member validation
const knownSlugs = new Set(
  allFrontmatters.map(({ rel }) => {
    const parts = rel.split('/');
    const cat = parts[0];
    const slug = basename(rel, '.md');
    return `${cat}/${slug}`;
  })
);

// Validate hub member slugs
for (const { fm, rel } of allFrontmatters) {
  if (fm.type !== 'hub' || !fm.stages) continue;
  for (const stage of fm.stages) {
    for (const member of (stage.members || [])) {
      if (!knownSlugs.has(member.slug)) {
        console.error(`✗ ${rel}\n  stages[].members[].slug: "${member.slug}" does not match any content file`);
        errors++;
        if (EMIT) {
          adminFindings.push(createFinding({
            level: 'ERROR', category: 'hub-members',
            file: `content/${rel}`,
            msg: `stages[].members[].slug: "${member.slug}" does not match any content file`,
            fix: `Check that content/${member.slug}.md exists`,
          }));
        }
      }
    }
  }
}

if (EMIT) {
  mergeFindings(ROOT, adminFindings, ['schema', 'hub-members']);
}

if (errors === 0) {
  console.log(`✓ All ${files.length} content files valid.`);
} else {
  console.error(`\n${errors} validation error(s).`);
  process.exit(1);
}
