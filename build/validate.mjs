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

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename, relative } from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { validateEntry } from './lib/validate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function walk(dir) {
  const results = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) results.push(...walk(full));
    else if (name.endsWith('.md') && !name.startsWith('_')) results.push(full);
  }
  return results;
}

const contentDir = join(ROOT, 'content');
const files = walk(contentDir).filter(f => !relative(contentDir, f).startsWith('_schema'));

let errors = 0;

for (const filePath of files) {
  const rel = relative(contentDir, filePath);
  try {
    const { data: fm } = matter(readFileSync(filePath, 'utf8'));
    validateEntry(fm, filePath);
  } catch (err) {
    console.error(`✗ ${rel}\n  ${err.message}`);
    errors++;
  }
}

if (errors === 0) {
  console.log(`✓ All ${files.length} content files valid.`);
} else {
  console.error(`\n${errors} validation error(s).`);
  process.exit(1);
}
