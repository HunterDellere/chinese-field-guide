/**
 * findings.mjs — shared findings shape, factory, and persistent writer.
 *
 * Every validator emits findings via createFinding() and then calls
 * mergeFindings() to atomically merge its results into data/_admin/findings.json.
 * The file is keyed by category so validators are independent; each run
 * replaces only its own category slice.
 *
 * Shape of a finding:
 *   { level, category, file, msg, context?, line?, fix? }
 *
 * Levels:   ERROR | WARN | INFO
 * Categories: factual | schema | tags | links | anchors | orphans |
 *             layout | hub-members | content-health | relations |
 *             search | formatting
 */

import fs from 'node:fs';
import path from 'node:path';

const VALID_LEVELS = new Set(['ERROR', 'WARN', 'INFO']);
const VALID_CATEGORIES = new Set([
  'factual', 'schema', 'tags', 'links', 'anchors', 'orphans',
  'layout', 'hub-members', 'content-health', 'relations',
  'search', 'formatting',
]);

/**
 * Create a validated finding object.
 * @param {{ level: string, category: string, file: string, msg: string, context?: string, line?: number, fix?: string }} opts
 */
export function createFinding({ level, category, file, msg, context, line, fix }) {
  if (!VALID_LEVELS.has(level))      throw new Error(`Invalid finding level: ${level}`);
  if (!VALID_CATEGORIES.has(category)) throw new Error(`Invalid finding category: ${category}`);
  if (!file) throw new Error('Finding must have a file');
  if (!msg)  throw new Error('Finding must have a msg');
  const f = { level, category, file, msg };
  if (context !== undefined && context !== null) f.context = String(context);
  if (line    !== undefined && line    !== null) f.line    = Number(line);
  if (fix     !== undefined && fix     !== null) f.fix     = String(fix);
  return f;
}

/**
 * Read the current findings file (or return empty scaffold if missing/corrupt).
 */
function readFindings(findingsPath) {
  if (!fs.existsSync(findingsPath)) {
    return { generated: new Date().toISOString(), summary: { errors: 0, warnings: 0, info: 0 }, findings: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(findingsPath, 'utf8'));
  } catch {
    return { generated: new Date().toISOString(), summary: { errors: 0, warnings: 0, info: 0 }, findings: [] };
  }
}

/**
 * Merge `newFindings` into data/_admin/findings.json, replacing all findings
 * with matching `category` values. Other categories are preserved verbatim.
 *
 * @param {string} rootDir       Repo root path
 * @param {Array}  newFindings   Array of findings from createFinding()
 * @param {string[]} categories  Which category slices these findings replace
 */
export function mergeFindings(rootDir, newFindings, categories) {
  const adminDir = path.join(rootDir, 'data', '_admin');
  const findingsPath = path.join(adminDir, 'findings.json');
  fs.mkdirSync(adminDir, { recursive: true });

  const existing = readFindings(findingsPath);

  // Drop existing findings for the categories being replaced
  const catSet = new Set(categories);
  const kept = (existing.findings || []).filter(f => !catSet.has(f.category));

  const merged = [...kept, ...newFindings];

  // Recompute summary counts
  const summary = { errors: 0, warnings: 0, info: 0 };
  for (const f of merged) {
    if (f.level === 'ERROR') summary.errors++;
    else if (f.level === 'WARN') summary.warnings++;
    else if (f.level === 'INFO') summary.info++;
  }

  const out = {
    generated: new Date().toISOString(),
    summary,
    findings: merged,
  };

  fs.writeFileSync(findingsPath, JSON.stringify(out, null, 2) + '\n');
  return out;
}

/**
 * Convenience: print a CLI summary of the findings emitted by one validator run.
 * @param {string} validatorName  Short label for console output
 * @param {Array}  findings       The findings this run emitted
 */
export function reportFindings(validatorName, findings) {
  const errors = findings.filter(f => f.level === 'ERROR');
  const warns  = findings.filter(f => f.level === 'WARN');
  const infos  = findings.filter(f => f.level === 'INFO');

  const fmt = f => {
    let s = `  ${f.file}: ${f.msg}`;
    if (f.fix)     s += `\n      fix: ${f.fix}`;
    if (f.context) s += `\n      ctx: "${String(f.context).slice(0, 180)}"`;
    return s;
  };

  if (errors.length) {
    console.log(`\n❌ ${errors.length} ERROR${errors.length === 1 ? '' : 's'} [${validatorName}]:\n`);
    errors.forEach(f => console.log(fmt(f)));
  }
  if (warns.length) {
    console.log(`\n⚠  ${warns.length} WARNING${warns.length === 1 ? '' : 's'} [${validatorName}]:\n`);
    warns.forEach(f => console.log(fmt(f)));
  }
  if (infos.length && process.env.VERBOSE) {
    console.log(`\nℹ  ${infos.length} INFO [${validatorName}]:\n`);
    infos.forEach(f => console.log(fmt(f)));
  }

  if (errors.length === 0 && warns.length === 0) {
    console.log(`✓ ${validatorName}: clean (${infos.length} info note${infos.length === 1 ? '' : 's'}).`);
  } else {
    console.log(`\n  ${validatorName} summary: ${errors.length} errors, ${warns.length} warnings, ${infos.length} info.`);
  }
}
