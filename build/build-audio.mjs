#!/usr/bin/env node
/**
 * build-audio.mjs — synthesize Azure Neural TTS audio for all eligible entries.
 *
 * Run after `npm run build` (depends on data/entries.json being up to date).
 * Idempotent: only entries whose text/pinyin/voice changed get re-synthesized.
 *
 * Env vars:
 *   AZURE_TTS_KEY     — required
 *   AZURE_TTS_REGION  — optional, defaults to "eastus"
 *
 * Flags:
 *   --force  — re-synthesize every entry, ignoring the manifest cache
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildAudio } from './lib/audio.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const force = process.argv.includes('--force');

const entriesPath = join(ROOT, 'data', 'entries.json');
let entries;
try {
  entries = JSON.parse(readFileSync(entriesPath, 'utf8'));
} catch (err) {
  console.error(`build-audio: could not read ${entriesPath}.`);
  console.error(`             Run \`npm run build\` first to generate it.`);
  process.exit(1);
}

const result = await buildAudio({ root: ROOT, entries, force });
if (result.skipped) process.exit(0); // missing key is a soft skip, not a failure
