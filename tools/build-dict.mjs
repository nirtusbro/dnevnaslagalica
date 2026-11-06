// Builds the two-tier Slagalica dictionary.
//
//   node tools/build-dict.mjs
//
// Inputs (see data/README.md for where to get them):
//   data/raw/sr-Latn.dic              Hunspell Serbian (Latin) spellchecker list — curated, ~264k forms
//   data/raw/serbian-words-latin.txt  CC0 merged list — huge (~2.8M), all inflections, but noisy
//
// Outputs:
//   data/dict/core.txt         curated words (Hunspell), lowercase, 3–12 letters, a–z č ć š ž đ only.
//                              Used for picking the day's spine word and the "best" answer, and accepted.
//   data/dict/extended.txt     CC0-only words of 5+ letters that are not in core. Accepted as answers
//                              (so players are not punished for legitimate rare inflections) but never
//                              chosen as the spine or the best word. 3–4 letter CC0-only entries are
//                              mostly junk (abbreviations, onomatopoeia), so they are dropped.
//   data/dict/letter-freq.json relative letter frequency over core (for topping up tile sets)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = path.join(root, 'data', 'raw');
const outDir = path.join(root, 'data', 'dict');

export const WORD_RE = /^[a-zčćšžđ]{3,12}$/;
export const EXTENDED_MIN_LEN = 5;

function readLines(file) {
  return fs.readFileSync(file, 'utf8').split(/\r?\n/);
}

const core = new Set();
for (const line of readLines(path.join(rawDir, 'sr-Latn.dic')).slice(1)) {
  const w = line.split('/')[0].trim();
  if (WORD_RE.test(w)) core.add(w);
}

const extended = new Set();
const freq = {};
let total = 0;
for (const line of readLines(path.join(rawDir, 'serbian-words-latin.txt'))) {
  const w = line.trim();
  if (!WORD_RE.test(w) || core.has(w)) continue;
  if (w.length >= EXTENDED_MIN_LEN) extended.add(w);
}
for (const w of core) for (const ch of w) { freq[ch] = (freq[ch] || 0) + 1; total++; }

const sortSr = (a, b) => a.localeCompare(b, 'sr-Latn');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'core.txt'), [...core].sort(sortSr).join('\n') + '\n', 'utf8');
fs.writeFileSync(path.join(outDir, 'extended.txt'), [...extended].sort(sortSr).join('\n') + '\n', 'utf8');
const rel = Object.fromEntries(Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +(v / total).toFixed(5)]));
fs.writeFileSync(path.join(outDir, 'letter-freq.json'), JSON.stringify(rel, null, 2) + '\n', 'utf8');
try { fs.unlinkSync(path.join(outDir, 'sr-latn.txt')); } catch (e) { /* old single-tier file, if any */ }

const byLen = (set) => { const m = {}; for (const w of set) m[w.length] = (m[w.length] || 0) + 1; return m; };
console.log(`core: ${core.size} words`, byLen(core));
console.log(`extended: ${extended.size} words`, byLen(extended));
