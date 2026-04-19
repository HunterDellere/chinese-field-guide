#!/usr/bin/env node
/**
 * watch.mjs — rebuild on content/ or templates/ changes
 *
 * Usage: npm run watch
 * Serves the site at http://localhost:8080 and rebuilds on save.
 */

import { watch } from 'chokidar';
import { spawn } from 'child_process';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');
const PORT      = 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'text/javascript',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.txt':  'text/plain',
};

// ── static file server ────────────────────────────────────────────────────────

const server = createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = join(ROOT, urlPath);
  const safe = filePath.startsWith(ROOT);

  if (!safe || !existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
    return;
  }

  const ext = extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'content-type': mime });
  res.end(readFileSync(filePath));
});

server.listen(PORT, () => {
  console.log(`\nDev server: http://localhost:${PORT}`);
  console.log('Watching content/ and templates/ for changes…\n');
});

// ── rebuild on change ─────────────────────────────────────────────────────────

let building = false;
let queued = false;

function build() {
  if (building) { queued = true; return; }
  building = true;
  const start = Date.now();
  const proc = spawn('node', ['build/build.mjs'], { cwd: ROOT, stdio: 'inherit' });
  proc.on('close', code => {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    if (code === 0) {
      console.log(`  → built in ${elapsed}s\n`);
    } else {
      console.log(`  → build failed (${elapsed}s)\n`);
    }
    building = false;
    if (queued) { queued = false; build(); }
  });
}

const watcher = watch(
  ['content', 'templates'],
  { cwd: ROOT, ignoreInitial: true, ignored: /node_modules/ }
);

watcher.on('change', path => { console.log(`changed: ${path}`); build(); });
watcher.on('add',    path => { console.log(`added:   ${path}`); build(); });
watcher.on('unlink', path => { console.log(`removed: ${path}`); build(); });

// Initial build
build();
