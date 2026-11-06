// Builds the two-tier Slagalica dictionary by TV rules: only dictionary head-words (leme).
//
//   node tools/build-dict.mjs
//
// Inputs (see data/README.md for where to get them):
//   data/raw/srLex_v1.3.gz   srLex: Serbian inflectional lexicon (form, lemma, MSD tag, ..., corpus freq)
//   data/raw/hrLex_v1.3.gz   hrLex: the Croatian counterpart, used only to drop Croatian-only words
//                            that leak into srLex (srWaC contains Croatian text); optional
//   data/dict/allow.txt      hand-kept words that srLex files under another lemma (ljudi, deca)
//   data/dict/block.txt      hand-kept exclusions (kroatizmi the ratio misses, junk interjections)
//
// A word is kept only when it is its own lemma AND its tag is one TV Slagalica accepts:
//   noun, common, nominative singular (or a lemma that is itself plural: makaze, vrata),
//   verb infinitive, adjective positive masculine singular nominative (opisni i posesivni),
//   adverb, pronoun, numeral, preposition, conjunction, particle, interjection.
// Plus the nominative plural of every accepted common noun (rukav -> rukavi).
// Proper nouns (Np), abbreviations (Y), foreign/residual (X), inflected forms, comparatives,
// participles and ijekavian variants all fall out automatically (their lemma differs).
//
// Outputs:
//   data/dict/core.txt         words seen >= MIN_FREQ_CORE times in srWaC. Spine and "best" come from here.
//   data/dict/extended.txt     rarer attested words (1-2 occurrences): accepted as answers, never spine/best.
//   data/dict/letter-freq.json relative letter frequency over core (for topping up tile sets)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { splitLetters } from '../src/engine/letters.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = path.join(root, 'data', 'raw');
const outDir = path.join(root, 'data', 'dict');

/** Serbian Latin letters only (no q w x y); 3–12 alphabet letters, so up to 15 characters with digraphs. */
export const WORD_RE = /^[a-pr-vzčćšžđ]{3,15}$/;
export const MAX_LETTERS = 12, MIN_LETTERS = 3;
const lengthOk = (w) => { const n = splitLetters(w).length; return n >= MIN_LETTERS && n <= MAX_LETTERS; };
export const MIN_FREQ_CORE = 3;
export const MIN_FREQ_EXT = 1;
/** Short words need more evidence: 3–4 letter lemmas with low counts are mostly abbreviations and noise. */
export const MIN_FREQ_BY_LEN = { 3: 50, 4: 10 };
/** Drop a word when it is this many times more frequent (per token) in hrWaC than in srWaC. */
export const MAX_HR_RATIO = 16;

/** Which Slagalica category an MSD tag belongs to, or null when the form is not a head-word shape. */
export function acceptTag(tag) {
  if (/^Nc.sn/.test(tag)) return 'N';      // common noun, singular nominative
  if (/^Nc.pn/.test(tag)) return 'N';      // lemma is a plural: pluralia tantum
  if (/^V.n/.test(tag)) return 'V';        // infinitive (Vmn, Van, Vcn)
  if (/^A[gs]pmsn/.test(tag)) return 'A';  // general/possessive adjective, positive, masc. sg. nom.
  if (tag[0] === 'R') return 'R';          // adverb
  if ('PMSCQI'.includes(tag[0])) return tag[0]; // pronoun, numeral, preposition, conjunction, particle, interjection
  return null;
}

const ROMAN_RE = /^[ivx]+$/;

function readList(file) {
  if (!fs.existsSync(file)) return new Set();
  return new Set(fs.readFileSync(file, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')));
}

/**
 * Streams a *Lex file. Calls `onRow(form, lemma, tag, freq)` for every row and returns the corpus
 * size in thousands of tokens (column 8 is occurrences per thousand tokens).
 */
async function scanLex(file, onRow) {
  const rl = readline.createInterface({ input: fs.createReadStream(file).pipe(zlib.createGunzip()) });
  let corpusK = 0;
  for await (const line of rl) {
    const p = line.split('\t');
    if (p.length < 8) continue;
    const freq = +p[6];
    if (!corpusK && freq > 0 && +p[7] > 0) corpusK = freq / +p[7];
    onRow(p[0], p[1], p[2], freq);
  }
  return corpusK;
}

const srFile = path.join(rawDir, 'srLex_v1.3.gz');
const hrFile = path.join(rawDir, 'hrLex_v1.3.gz');
if (!fs.existsSync(srFile)) { console.error('missing ' + srFile + ' (see data/README.md)'); process.exit(1); }

const sr = new Map(); // form -> max corpus freq over accepted tags
const plural = new Map(); // nominative plural form -> { lemma, freq } (rukavi -> rukav)
const srK = await scanLex(srFile, (form, lemma, tag, freq) => {
  if (!WORD_RE.test(form) || ROMAN_RE.test(form) || !lengthOk(form)) return;
  if (form !== lemma) {
    if (/^Nc.pn/.test(tag)) { const p = plural.get(form); if (!p || freq > p.freq) plural.set(form, { lemma, freq }); }
    return;
  }
  if (!acceptTag(tag)) return;
  sr.set(form, Math.max(sr.get(form) || 0, freq));
});

const hr = new Map();
let hrK = 0;
if (fs.existsSync(hrFile)) {
  hrK = await scanLex(hrFile, (form, lemma, tag, freq) => {
    if (form !== lemma || !sr.has(form)) return;
    hr.set(form, Math.max(hr.get(form) || 0, freq));
  });
} else {
  console.warn('note: ' + hrFile + ' not found, Croatian-only words are not filtered');
}

/**
 * Ijekavian head-words that srLex did not map to their ekavian lemma (ljetopisac, savjesno, djed):
 * a word is ijekavian when turning one "ije"/"je" into "e" gives another head-word (letopisac,
 * savesno, ded). Words with no such twin (objekat, odjednom, perje) are untouched.
 */
function hasEkavianTwin(w) {
  for (const m of w.matchAll(/ije|je/g)) {
    if (m.index === 0) continue; // jat never reflects at word start: ijekavac, jekavica, jevanđelje are Serbian
    const alt = w.slice(0, m.index) + 'e' + w.slice(m.index + m[0].length);
    if (sr.has(alt)) return true;
  }
  return false;
}

const allow = readList(path.join(outDir, 'allow.txt'));
const block = readList(path.join(outDir, 'block.txt'));
const core = new Set(), extended = new Set();
let droppedHr = 0, droppedIje = 0;
for (const [w, freq] of sr) {
  if (block.has(w)) continue;
  if (hasEkavianTwin(w)) { droppedIje++; continue; }
  if (hrK && freq > 0) {
    const ratio = ((hr.get(w) || 0) / hrK) / (freq / srK);
    if (ratio >= MAX_HR_RATIO) { droppedHr++; continue; }
  }
  const min = Math.max(MIN_FREQ_CORE, MIN_FREQ_BY_LEN[w.length] || 0);
  if (freq >= min) core.add(w);
  else if (freq >= MIN_FREQ_EXT && !(w.length in MIN_FREQ_BY_LEN)) extended.add(w);
}
// Nominative plural of every accepted common noun (rukav -> rukavi, ljudi for čovek), tiered by its own count.
let plurals = 0;
for (const [form, { lemma, freq }] of plural) {
  if (block.has(form) || sr.has(form) || !(core.has(lemma) || extended.has(lemma))) continue;
  const min = Math.max(MIN_FREQ_CORE, MIN_FREQ_BY_LEN[form.length] || 0);
  if (freq >= min) core.add(form);
  else if (freq >= MIN_FREQ_EXT && !(form.length in MIN_FREQ_BY_LEN)) extended.add(form);
  else continue;
  plurals++;
}
for (const w of allow) if (WORD_RE.test(w) && lengthOk(w)) core.add(w);

// Letter frequency over alphabet letters (lj, nj, dž count as their own letter), for tile top-up.
const freq = {};
let total = 0;
for (const w of core) for (const ch of splitLetters(w)) { freq[ch] = (freq[ch] || 0) + 1; total++; }

const sortSr = (a, b) => a.localeCompare(b, 'sr-Latn');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'core.txt'), [...core].sort(sortSr).join('\n') + '\n', 'utf8');
fs.writeFileSync(path.join(outDir, 'extended.txt'), [...extended].sort(sortSr).join('\n') + '\n', 'utf8');
const rel = Object.fromEntries(Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +(v / total).toFixed(5)]));
fs.writeFileSync(path.join(outDir, 'letter-freq.json'), JSON.stringify(rel, null, 2) + '\n', 'utf8');

const byLen = (set) => { const m = {}; for (const w of set) { const n = splitLetters(w).length; m[n] = (m[n] || 0) + 1; } return m; };
console.log(`srLex head-words considered: ${sr.size}; dropped as Croatian-only: ${droppedHr}; dropped as ijekavian: ${droppedIje}; blocked: ${block.size}; plurals added: ${plurals}`);
console.log(`core: ${core.size} words`, byLen(core));
console.log(`extended: ${extended.size} words`, byLen(extended));
