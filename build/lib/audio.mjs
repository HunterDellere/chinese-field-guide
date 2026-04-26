/**
 * audio.mjs — Azure Neural TTS pipeline for character & vocab pronunciation.
 *
 * Reads:  data/entries.json (built first by `npm run build`)
 * Writes: audio/<category>/<slug>-{xiaoxiao|yunxi}.mp3
 *         data/audio-manifest.json  (hash → relative path map)
 *
 * Idempotent: each entry × voice is hashed against (text|pinyin|voice|version);
 * unchanged entries are skipped. Re-runs are free.
 *
 * Requires AZURE_TTS_KEY and AZURE_TTS_REGION env vars at runtime. Without
 * them, this module exits with a notice — `npm run build` itself never depends
 * on TTS, so offline / contributor builds always work.
 */

import { createHash } from 'crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import matter from 'gray-matter';
import { pinyinToNumericSyllables } from './pinyin.mjs';

const VOICES = [
  { id: 'xiaoxiao', name: 'zh-CN-XiaoxiaoNeural', label: '女', gender: 'female' },
  { id: 'yunxi',    name: 'zh-CN-YunxiNeural',    label: '男', gender: 'male'   },
];

// Bump when the rendering parameters change (rate/pitch/voice version) to
// invalidate cached audio without manually deleting files.
const RENDER_VERSION = 1;

/**
 * Decide whether an entry should have audio.
 * Currently: characters (single hanzi) and vocab (multi-hanzi words).
 * Topics, grammar, hubs, families, hsk: skipped — their titles aren't always
 * pronounceable Chinese phrases, and the page's "subject" is conceptual.
 */
export function isAudioEligible(entry) {
  if (entry.status !== 'complete') return false;
  if (entry.type === 'character' && entry.char && entry.pinyin) return true;
  if (entry.type === 'vocab' && entry.pinyin) {
    // vocab entries derive their text from the title's CN portion
    const cn = extractCnFromTitle(entry.title);
    return Boolean(cn);
  }
  return false;
}

function extractCnFromTitle(title) {
  if (!title) return '';
  // Title shape: "茶道 · the way of tea" — take the CN portion
  const cn = title.split('·')[0].trim();
  // Must contain at least one hanzi
  return /[一-鿿]/.test(cn) ? cn : '';
}

/**
 * Resolve the text + pinyin for an entry.
 */
export function resolveAudioInputs(entry) {
  if (entry.type === 'character') {
    return { text: entry.char, pinyin: entry.pinyin };
  }
  if (entry.type === 'vocab') {
    return { text: extractCnFromTitle(entry.title), pinyin: entry.pinyin };
  }
  return null;
}

/**
 * Build SSML that forces Microsoft sapi pronunciation per character based on
 * the page's pinyin. This handles polyphonic characters correctly.
 *
 * If the syllable count doesn't match the hanzi count, we fall back to
 * letting the TTS engine pick — better to ship correct-sounding default
 * pronunciation than a misaligned phoneme override.
 */
export function buildSsml(text, pinyin, voiceName) {
  const hanzi = Array.from(text).filter(c => /[一-鿿]/.test(c));
  const syllables = pinyinToNumericSyllables(pinyin);

  let inner;
  if (hanzi.length && hanzi.length === syllables.length) {
    inner = Array.from(text).map(ch => {
      if (!/[一-鿿]/.test(ch)) return escapeXml(ch);
      const idx = hanzi.indexOf(ch);
      // indexOf will find the first occurrence — but we walk through `text`
      // in order, so we need a positional mapping. Rebuild it:
      return ''; // replaced below
    }).join('');
    // Positional mapping
    let h = 0;
    inner = '';
    for (const ch of text) {
      if (/[一-鿿]/.test(ch)) {
        const ph = syllables[h++];
        inner += `<phoneme alphabet="sapi" ph="${ph}">${escapeXml(ch)}</phoneme>`;
      } else {
        inner += escapeXml(ch);
      }
    }
  } else {
    inner = escapeXml(text);
  }

  return (
    `<speak version="1.0" xml:lang="zh-CN" ` +
    `xmlns="http://www.w3.org/2001/10/synthesis" ` +
    `xmlns:mstts="http://www.w3.org/2001/mstts">` +
      `<voice name="${voiceName}">` +
        `<prosody rate="-8%">${inner}</prosody>` +
      `</voice>` +
    `</speak>`
  );
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function hashKey(text, pinyin, voiceId) {
  return createHash('sha1')
    .update(`${RENDER_VERSION}|${voiceId}|${text}|${pinyin || ''}`)
    .digest('hex')
    .slice(0, 12);
}

/**
 * A clip is uniquely identified by (text, pinyin). Inline clips harvested
 * from page bodies (chengyu cards, vocab compound cards) get content-hashed
 * filenames so we don't collide across pages and don't re-synthesize the
 * same phrase that appears on multiple pages.
 *
 * Inline filename: audio/inline/<sha1-of-text-pinyin>-{voice}.mp3
 */
function inlineClipId(text, pinyin) {
  return createHash('sha1')
    .update(`${text}|${pinyin || ''}`)
    .digest('hex')
    .slice(0, 16);
}

/**
 * Walk content/ for inline clips: <span class="cy-cn">…</span><span class="cy-py">…</span>
 * pairs (chengyu cards) and <span class="card-cn">…</span><span class="card-py">…</span>
 * pairs (vocab compound cards on character pages).
 *
 * Returns Array<{ text, pinyin, kind }>. Kind is purely informational.
 */
export function harvestInlineClips(contentDir) {
  const clips = [];
  const seen = new Set();

  function pushClip(text, pinyin, kind) {
    if (!text || !pinyin) return;
    text = text.trim();
    pinyin = pinyin.trim();
    if (!/[一-鿿]/.test(text)) return;
    const k = `${text}|${pinyin}`;
    if (seen.has(k)) return;
    seen.add(k);
    clips.push({ text, pinyin, kind });
  }

  function walk(dir) {
    for (const name of readdirSync(dir)) {
      if (name.startsWith('_')) continue;
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) { walk(full); continue; }
      if (!name.endsWith('.md')) continue;

      const raw = readFileSync(full, 'utf8');
      const { content: body } = matter(raw);

      // Chengyu cards: cy-cn + cy-py adjacency
      const cyRe = /<span class="cy-cn">([\s\S]*?)<\/span>\s*<span class="cy-py">([\s\S]*?)<\/span>/g;
      for (const m of body.matchAll(cyRe)) {
        pushClip(stripTags(m[1]), stripTags(m[2]), 'chengyu');
      }

      // Vocab compound cards: card-cn + card-py adjacency (used on character pages
      // for 感觉 / 感动 / 感谢 etc.)
      const cardRe = /<span class="card-cn">([\s\S]*?)<\/span>\s*<span class="card-py">([\s\S]*?)<\/span>/g;
      for (const m of body.matchAll(cardRe)) {
        pushClip(stripTags(m[1]), stripTags(m[2]), 'compound');
      }
    }
  }

  walk(contentDir);
  return clips;
}

function stripTags(s) {
  return String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Synthesize one (text, voice) pair. Returns the MP3 buffer.
 */
async function synthesize(ssml, key, region) {
  const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'jiaoluo-shuwu-build',
    },
    body: ssml,
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Azure TTS ${res.status}: ${res.statusText} — ${errBody.slice(0, 200)}`);
  }
  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}

/**
 * Main entry point — synthesize audio for every eligible entry × voice,
 * skipping anything already in the manifest with a matching hash.
 */
export async function buildAudio({ root, entries, force = false } = {}) {
  const key    = process.env.AZURE_TTS_KEY;
  const region = process.env.AZURE_TTS_REGION || 'eastus';

  const manifestPath = join(root, 'data', 'audio-manifest.json');
  const audioDir     = join(root, 'audio');
  mkdirSync(audioDir, { recursive: true });

  let manifest = { version: RENDER_VERSION, voices: VOICES, entries: {}, inline: {} };
  if (existsSync(manifestPath)) {
    try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch {}
  }
  if (manifest.version !== RENDER_VERSION) {
    // Bumped version — discard old hashes (files stay on disk, will re-overwrite).
    manifest = { version: RENDER_VERSION, voices: VOICES, entries: {}, inline: {} };
  }
  if (!manifest.inline) manifest.inline = {};

  const eligible = entries.filter(isAudioEligible);
  const todo = [];
  for (const entry of eligible) {
    const inputs = resolveAudioInputs(entry);
    if (!inputs) continue;
    const slug = entry.path.replace(/^pages\//, '').replace(/\.html$/, ''); // "characters/gan3_感"
    const dir  = join(audioDir, dirname(slug));
    mkdirSync(dir, { recursive: true });

    const entryRecord = manifest.entries[entry.path] || { voices: {} };

    for (const voice of VOICES) {
      const hash = hashKey(inputs.text, inputs.pinyin, voice.id);
      const fileRel = `audio/${slug}-${voice.id}.mp3`;
      const fileAbs = join(root, fileRel);

      const cached = entryRecord.voices[voice.id];
      if (!force && cached && cached.hash === hash && existsSync(fileAbs)) {
        continue; // up-to-date
      }
      todo.push({ entry, inputs, voice, hash, fileAbs, fileRel });
    }
    manifest.entries[entry.path] = entryRecord;
  }

  // Inline clips harvested from chengyu / vocab-compound cards in content/
  const contentDir = join(root, 'content');
  let inlineClips = [];
  try { inlineClips = harvestInlineClips(contentDir); } catch (err) {
    console.warn(`audio: harvestInlineClips failed: ${err.message}`);
  }

  const inlineDir = join(audioDir, 'inline');
  mkdirSync(inlineDir, { recursive: true });

  for (const clip of inlineClips) {
    const id = inlineClipId(clip.text, clip.pinyin);
    const record = manifest.inline[id] || {
      text: clip.text, pinyin: clip.pinyin, kind: clip.kind, voices: {},
    };
    // Refresh metadata in case the clip's pinyin/kind shifted upstream.
    record.text = clip.text;
    record.pinyin = clip.pinyin;
    record.kind = clip.kind;

    for (const voice of VOICES) {
      const hash = hashKey(clip.text, clip.pinyin, voice.id);
      const fileRel = `audio/inline/${id}-${voice.id}.mp3`;
      const fileAbs = join(root, fileRel);

      const cached = record.voices[voice.id];
      if (!force && cached && cached.hash === hash && existsSync(fileAbs)) continue;

      todo.push({
        kind: 'inline',
        clipId: id,
        inputs: { text: clip.text, pinyin: clip.pinyin },
        voice, hash, fileAbs, fileRel,
      });
    }
    manifest.inline[id] = record;
  }

  if (!todo.length) {
    console.log(`audio: ${eligible.length} entries × ${VOICES.length} voices — all up to date.`);
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    return { synthesized: 0, eligible: eligible.length };
  }

  if (!key) {
    console.warn(
      `audio: ${todo.length} clip(s) need synthesis but AZURE_TTS_KEY is not set.\n` +
      `       Set AZURE_TTS_KEY and AZURE_TTS_REGION (default: eastus), then run \`npm run build:audio\`.\n` +
      `       Pages will fall back to browser SpeechSynthesis until cached audio is committed.`
    );
    return { synthesized: 0, skipped: todo.length, eligible: eligible.length };
  }

  console.log(`audio: synthesizing ${todo.length} clip(s) with Azure (${region})…`);

  let done = 0;
  for (const job of todo) {
    const { inputs, voice, hash, fileAbs, fileRel } = job;
    const ssml = buildSsml(inputs.text, inputs.pinyin, voice.name);
    try {
      const buf = await synthesize(ssml, key, region);
      writeFileSync(fileAbs, buf);
      const record = {
        hash,
        path: fileRel,
        bytes: buf.length,
        text: inputs.text,
        pinyin: inputs.pinyin,
      };
      if (job.kind === 'inline') {
        manifest.inline[job.clipId].voices[voice.id] = record;
      } else {
        manifest.entries[job.entry.path].voices[voice.id] = record;
      }
      done++;
      if (done % 10 === 0) console.log(`  …${done}/${todo.length}`);
    } catch (err) {
      const label = job.kind === 'inline' ? `inline:${job.inputs.text}` : job.entry.path;
      console.error(`  ✗ ${label} (${voice.id}): ${err.message}`);
    }
  }

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`audio: synthesized ${done}/${todo.length} clip(s); manifest written.`);
  return { synthesized: done, eligible: eligible.length };
}

export { VOICES };
