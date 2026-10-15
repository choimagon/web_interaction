import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

// Vite can retain import.meta even with target: chrome63. Modern-only worker
// code must not make the initial UI unparseable on the embedded browser.
const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const entries = [...html.matchAll(/<script\b(?=[^>]*\btype="module")[^>]*\bsrc="([^"]+)"/g)];
assert.ok(entries.length, 'No browser entry was found in dist/index.html.');
for (const [, src] of entries) {
  const filename = basename(new URL(src, 'https://localhost/').pathname);
  const code = await readFile(new URL(`../dist/assets/${filename}`, import.meta.url), 'utf8');
  assert.ok(!/\bimport\s*\.\s*meta\b/.test(code), `${filename} contains import.meta, unsupported by Chromium 63.`);
}
console.log('Embedded browser entry check passed.');
