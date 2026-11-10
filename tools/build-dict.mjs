// Builds the Slagalica dictionary. The set word (and the spine a day's tiles are built from)
// follows TV rules: dictionary head-words only. Accepted answers are more lenient than TV: any
// attested form of a real Serbian word counts (forms.txt), so the game never rejects a legitimate word.
//
//   node tools/build-dict.mjs [--dropped]   (--dropped writes data/raw/dropped-forms.txt for review)
//
// Inputs (see data/README.md for where to get them):
//   data/raw/srLex_v1.3.gz   srLex: Serbian inflectional lexicon (form, lemma, MSD tag, ..., corpus freq)
//   data/raw/hrLex_v1.3.gz   hrLex: the Croatian counterpart, used only to drop Croatian-only words
//                            that leak into srLex (srWaC contains Croatian text); optional
//   data/dict/allow.txt      hand-kept words that srLex files under another lemma (ljudi, deca)
//   data/dict/block.txt      hand-kept exclusions (kroatizmi the ratio misses, junk interjections)
//   data/raw/sr-Latn.dic               Hunspell sr-Latn word forms (optional, for extra.txt)
//   data/raw/serbian-words-latin.txt   CC0 merged list of ~2.8M forms (optional, for extra.txt)
//
// A word is kept only when it is its own lemma AND its tag is one TV Slagalica accepts:
//   noun, common, nominative singular (or a lemma that is itself plural: makaze, vrata),
//   verb infinitive, adjective positive masculine singular nominative (opisni i posesivni),
//   adverb, pronoun, numeral, preposition, conjunction, particle, interjection.
// Plus the nominative plural of every accepted common noun (rukav -> rukavi), and masculine singular
// nominative forms srLex files under another lemma: definite adjectives (veliki) and passive verbal
// adjectives (blokiran, blokirani).
// Proper nouns (Np), abbreviations (Y) and foreign/residual (X) never count; Croatian-only and
// ijekavian words are filtered (see data/README.md).
//
// Outputs:
//   data/dict/core.txt         head-words seen >= MIN_FREQ_CORE times in srWaC. Spine and "best" come from here.
//   data/dict/extended.txt     rarer head-words (1-2 occurrences): accepted as answers, never spine/best.
//   data/dict/forms.txt        every other attested form (padeži, rod, glagolski oblici, komparativ):
//                              accepted as answers, never spine/best.
//   data/dict/extra.txt        words srLex lacks or never saw in srWaC (đon, rare inflections), taken from
//                              the Hunspell and CC0 lists through the same Croatian/ijekavian/block
//                              filters: accepted as answers, never spine/best.
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
/**
 * Drop a lower-case form when srWaC has it as a proper noun (capitalised, tag Np) this many times
 * more often than as a common word: srbija (218366 Np / 2249), ivan, vojvodina. Words that are both
 * (nada 5612/5099, vuk, zora, sunce) stay. Real words over the line go in allow.txt (vučić, novak).
 */
export const MAX_NAME_RATIO = 10;

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

/**
 * Masculine singular nominative forms that srLex files under another lemma but TV Slagalica accepts:
 * the definite adjective (veliki, lokalni: lemma velik, lokalan) and the passive verbal adjective
 * (blokiran, blokirani, zatvoren: lemma blokirati, zatvoriti), indefinite or definite. Ijekavian
 * forms that map to an ekavian lemma the same way (lijepi -> lep) are caught by hasEkavianTwin.
 */
export function acceptInflectedTag(tag) {
  return /^Agpmsny/.test(tag) || /^Appmsn/.test(tag);
}

/** Rows of real vocabulary: everything but proper nouns (Np), abbreviations (Y) and residuals (X). */
export function lexicalTag(tag) {
  return tag[0] === 'N' ? tag[1] === 'c' : 'VARPMSCQI'.includes(tag[0]);
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

/** Extra word lists, read before the scans so hrLex counts are kept for their words too. */
function readRaw(file, firstLine = 0) {
  if (!fs.existsSync(file)) { console.warn('note: ' + file + ' not found, skipped for extra.txt'); return new Set(); }
  const out = new Set();
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/).slice(firstLine)) {
    const w = line.split('/')[0].trim();
    if (WORD_RE.test(w) && !ROMAN_RE.test(w) && lengthOk(w)) out.add(w);
  }
  return out;
}
const hunspell = readRaw(path.join(rawDir, 'sr-Latn.dic'), 1);
const cc0 = readRaw(path.join(rawDir, 'serbian-words-latin.txt'));
/** Lower-cased capitalised entries of both lists (Garibaldi, Čulića): names, which CC0 often repeats in lower case. */
const capitalised = new Set();
for (const [file, first] of [['sr-Latn.dic', 1], ['serbian-words-latin.txt', 0]]) {
  const f = path.join(rawDir, file);
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/).slice(first)) {
    const w = line.split('/')[0].trim();
    if (/^[A-PR-VZČĆŠŽĐ][a-pr-vzčćšžđ]+$/.test(w)) capitalised.add(w.toLowerCase());
  }
}

const sr = new Map(); // form -> max corpus freq over accepted tags
const plural = new Map(); // nominative plural form -> { lemma, freq } (rukavi -> rukav)
const formLemmas = new Map(); // every lexical form -> Set of its lemmas (for forms.txt)
const comparative = new Set(); // forms with a comparative reading (lošije, toplije): their -ije is not ijekavian
/**
 * Total occurrences of each form over all its rows (every lemma and tag). Frequencies and the
 * Croatian filter use these totals: the row of one tag alone can be tiny next to the form's other
 * readings (obzir is 120× Ncmsn but 27877× Ncmsan in srWaC), and comparing that row with the hrWaC
 * total wrongly flagged obzir, žalost, minuta and tona as Croatian.
 */
const srTotal = new Map();
const nonLexical = new Set(); // forms with a proper-noun / abbreviation / residual reading (beograd, itd)
const npTotal = new Map(); // lower-cased proper-noun form (Srbija -> srbija) -> its total count in srWaC
const srK = await scanLex(srFile, (form, lemma, tag, freq) => {
  if (tag.startsWith('Np')) { const lc = form.toLowerCase(); if (WORD_RE.test(lc)) npTotal.set(lc, (npTotal.get(lc) || 0) + freq); }
  if (!WORD_RE.test(form) || ROMAN_RE.test(form) || !lengthOk(form)) return;
  srTotal.set(form, (srTotal.get(form) || 0) + freq);
  if (!lexicalTag(tag)) nonLexical.add(form);
  if (lexicalTag(tag)) { let s = formLemmas.get(form); if (!s) formLemmas.set(form, s = new Set()); s.add(lemma); if (/^[AR].c/.test(tag)) comparative.add(form); }
  if (form !== lemma) {
    if (/^Nc.pn/.test(tag)) { const p = plural.get(form); if (!p || freq > p.freq) plural.set(form, { lemma, freq }); }
    if (!acceptInflectedTag(tag)) return;
  } else if (!acceptTag(tag)) return;
  sr.set(form, Math.max(sr.get(form) || 0, freq));
});

let hr = new Map();
let hrK = 0;
const hrNames = new Set(); // lower-cased hrLex proper nouns among the Hunspell/CC0 words
if (fs.existsSync(hrFile)) {
  hrK = await scanLex(hrFile, (form, lemma, tag, freq) => {
    if (formLemmas.has(form) || hunspell.has(form) || cc0.has(form)) hr.set(form, (hr.get(form) || 0) + freq);
    if (tag.startsWith('Np')) { const lc = form.toLowerCase(); if (hunspell.has(lc) || cc0.has(lc)) hrNames.add(lc); }
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

/** True when the form is used in hrWaC at least MAX_HR_RATIO times more often (per token) than in srWaC. */
function croatian(w) {
  const s = srTotal.get(w) || 0;
  return !!hrK && s > 0 && ((hr.get(w) || 0) / hrK) / (s / srK) >= MAX_HR_RATIO;
}
const shortOf = (w) => MIN_FREQ_BY_LEN[splitLetters(w).length];
const minCore = (w) => Math.max(MIN_FREQ_CORE, shortOf(w) || 0);
const extOk = (w, f) => f >= MIN_FREQ_EXT && !shortOf(w);

const allow = readList(path.join(outDir, 'allow.txt'));
const block = readList(path.join(outDir, 'block.txt'));

/**
 * Proper nouns are never accepted. A form srLex knows as a common word is a name when srWaC uses
 * it capitalised as a proper noun MAX_NAME_RATIO times more often (srbija, srbije, ivan). A form srLex
 * does not know as a common word is a name when any source has it as one: srLex or hrLex proper
 * nouns, or a capitalised entry in the Hunspell/CC0 lists (garibaldi, čulić, zagorec).
 * allow.txt words, and forms of an allow.txt lemma (novaka for novak), are exempt.
 */
function properName(w) {
  const lemmas = [...(formLemmas.get(w) || [])];
  if (allow.has(w) || lemmas.some((l) => allow.has(l))) return false;
  const n = npTotal.get(w) || 0;
  if (!lemmas.length) return n > 0 || hrNames.has(w) || capitalised.has(w);
  if (n / Math.max(srTotal.get(w) || 0, 0.5) < MAX_NAME_RATIO) return false;
  // a case form of an accepted word stays even when the name is more frequent:
  // bugarskoj (bugarski), kina (kino), rimu (rima), barbara (barbar)
  return !lemmas.some((l) => l !== w && (core.has(l) || extended.has(l)));
}
/**
 * names.txt: proper nouns srLex files as common words (nemac, srbin). The word and every form of it
 * are out (nemca, nemci), unless the form also belongs to a core word.
 */
const nameList = readList(path.join(outDir, 'names.txt'));
const blockedLemma = (w) => {
  if (nameList.has(w)) return true;
  const ls = [...(formLemmas.get(w) || [])];
  return ls.some((l) => nameList.has(l)) && !ls.some((l) => core.has(l) && !nameList.has(l));
};

const core = new Set(), extended = new Set();
const ijeLemmas = new Set();
const rejected = new Set(); // dropped as Croatian, ijekavian or a name: extra.txt must not bring them back
const names = []; // every form dropped as a proper noun, for review (--dropped)
let droppedHr = 0, droppedIje = 0;
for (const [w, freq] of sr) {
  if (block.has(w) || nameList.has(w)) continue;
  if (properName(w)) { rejected.add(w); names.push(w); continue; }
  if (hasEkavianTwin(w) && !allow.has(w)) { droppedIje++; ijeLemmas.add(w); rejected.add(w); continue; }
  if (croatian(w)) { droppedHr++; rejected.add(w); continue; }
  if (freq >= minCore(w)) core.add(w);
  else if (extOk(w, freq)) extended.add(w);
}
// Nominative plural of every accepted common noun (rukav -> rukavi, ljudi for čovek), tiered by its own count.
let plurals = 0;
for (const [form, { lemma, freq }] of plural) {
  if (block.has(form) || sr.has(form) || !(core.has(lemma) || extended.has(lemma))) continue;
  if (properName(form)) { rejected.add(form); names.push(form); continue; }
  if (freq >= minCore(form)) core.add(form);
  else if (extOk(form, freq)) extended.add(form);
  else continue;
  plurals++;
}
for (const w of allow) if (WORD_RE.test(w) && lengthOk(w)) core.add(w);

/**
 * forms.txt: every other attested form of a lexical word (padeži, rod, broj, glagolski oblici,
 * komparativ, superlativ: blokirane, kuće, pisao, najbolji). Accepted as answers so the game never
 * rejects a real Serbian word, but never used as the spine or the set word, which stay head-words.
 * Same filters as head-words: Croatian ratio, ijekavian (a form whose "ije"/"je" -> "e" twin is a
 * form of the same lemma, lijepe -> lepe, or whose lemmas are all ijekavian head-words, cvijeta),
 * block list, and the short-word frequency floor.
 */
function ijekavianForm(w, lemmas) {
  if ([...lemmas].every((l) => ijeLemmas.has(l))) return true;
  if (comparative.has(w)) return false;
  for (const m of w.matchAll(/ije|je/g)) {
    if (m.index === 0) continue;
    const twin = formLemmas.get(w.slice(0, m.index) + 'e' + w.slice(m.index + m[0].length));
    // every reading must be the twin's lemma: njega is ijekavian for nega, but also a form of on
    if (twin && [...lemmas].every((l) => twin.has(l))) return true;
  }
  return false;
}
const forms = new Set();
const dropped = []; // with --dropped: written to data/raw/dropped-forms.txt for review
let formsHr = 0, formsIje = 0;
for (const [w, lemmas] of formLemmas) {
  if (core.has(w) || extended.has(w) || block.has(w) || blockedLemma(w)) continue;
  const f = srTotal.get(w) || 0;
  if (f < (shortOf(w) || MIN_FREQ_EXT)) continue;
  if (properName(w)) { rejected.add(w); names.push(w); continue; }
  if (ijekavianForm(w, lemmas)) { formsIje++; rejected.add(w); dropped.push(`ije\t${w}\t${f}`); continue; }
  if (croatian(w)) { formsHr++; rejected.add(w); dropped.push(`hr\t${w}\t${f}`); continue; }
  forms.add(w);
}

/**
 * extra.txt: words from the Hunspell and CC0 lists that srLex lacks (đon) or never saw in srWaC
 * (rare inflections). Both lists mix in Croatian and ijekavian words (tko, tjedan, lijepo), so:
 *   - whatever the srLex filters rejected, the block list, and proper names / abbreviations stay out;
 *   - a form srLex knows goes through the same ijekavian and Croatian tests as forms.txt;
 *   - a form srLex does not know is Croatian when hrWaC uses it MAX_HR_RATIO times more often than
 *     half an occurrence in srWaC would be (about 20 hrWaC hits), and ijekavian when turning a
 *     non-initial "ije"/"je" into "e" gives a known form (ljepota -> lepota). "je" after l/n is
 *     skipped (zdravlje, pisanje: lj/nj, not jat), and so is a final "ije" (comparatives: zelenije);
 *   - proper nouns are dropped (properName: garibaldi, čulić, zagorec);
 *   - a CC0-only form of 3–4 letters is dropped (mostly abbreviations and noise), and every word
 *     needs a vowel or r.
 */
const known = (w) => formLemmas.has(w) || hunspell.has(w) || cc0.has(w);
function ijekavianExtra(w) {
  for (const m of w.matchAll(/ije|je/g)) {
    const i = m.index;
    if (i === 0) continue;
    if (m[0] === 'je' && 'ln'.includes(w[i - 1])) continue;
    if (m[0] === 'ije' && i + 3 === w.length) continue;
    const alt = w.slice(0, i) + 'e' + w.slice(i + m[0].length);
    if (!rejected.has(alt) && known(alt)) return true;
  }
  return false;
}
const croatianUnseen = (w) => !!hrK && ((hr.get(w) || 0) / hrK) / (0.5 / srK) >= MAX_HR_RATIO;
const extra = new Set();
let extraHr = 0, extraIje = 0;
for (const src of [hunspell, cc0]) for (const w of src) {
  if (extra.has(w) || core.has(w) || extended.has(w) || forms.has(w)) continue;
  if (block.has(w) || blockedLemma(w) || rejected.has(w) || !/[aeiour]/.test(w)) continue;
  if (nonLexical.has(w) && !formLemmas.has(w)) continue;
  if (src === cc0 && !hunspell.has(w) && splitLetters(w).length <= 4) continue;
  if (properName(w)) { names.push(w); continue; }
  const lemmas = formLemmas.get(w);
  if (lemmas ? ijekavianForm(w, lemmas) : ijekavianExtra(w)) { extraIje++; dropped.push(`ije-extra\t${w}`); continue; }
  if (lemmas ? croatian(w) : croatianUnseen(w)) { extraHr++; dropped.push(`hr-extra\t${w}`); continue; }
  extra.add(w);
}
if (process.argv.includes('--dropped')) {
  fs.writeFileSync(path.join(rawDir, 'dropped-forms.txt'), dropped.join('\n') + '\n', 'utf8');
  fs.writeFileSync(path.join(rawDir, 'dropped-names.txt'), names.join('\n') + '\n', 'utf8');
}

// Letter frequency over alphabet letters (lj, nj, dž count as their own letter), for tile top-up.
const freq = {};
let total = 0;
for (const w of core) for (const ch of splitLetters(w)) { freq[ch] = (freq[ch] || 0) + 1; total++; }

const sortSr = (a, b) => a.localeCompare(b, 'sr-Latn');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'core.txt'), [...core].sort(sortSr).join('\n') + '\n', 'utf8');
fs.writeFileSync(path.join(outDir, 'extended.txt'), [...extended].sort(sortSr).join('\n') + '\n', 'utf8');
fs.writeFileSync(path.join(outDir, 'forms.txt'), [...forms].sort(sortSr).join('\n') + '\n', 'utf8');
fs.writeFileSync(path.join(outDir, 'extra.txt'), [...extra].sort(sortSr).join('\n') + '\n', 'utf8');
const rel = Object.fromEntries(Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +(v / total).toFixed(5)]));
fs.writeFileSync(path.join(outDir, 'letter-freq.json'), JSON.stringify(rel, null, 2) + '\n', 'utf8');

const byLen = (set) => { const m = {}; for (const w of set) { const n = splitLetters(w).length; m[n] = (m[n] || 0) + 1; } return m; };
console.log(`srLex head-words considered: ${sr.size}; dropped as Croatian-only: ${droppedHr}; dropped as ijekavian: ${droppedIje}; blocked: ${block.size}; plurals added: ${plurals}`);
console.log(`core: ${core.size} words`, byLen(core));
console.log(`extended: ${extended.size} words`, byLen(extended));
console.log(`forms: ${forms.size} words (dropped as Croatian: ${formsHr}, as ijekavian: ${formsIje})`);
console.log(`dropped as proper nouns: ${names.length}`);
console.log(`extra: ${extra.size} words from Hunspell ${hunspell.size} + CC0 ${cc0.size} (dropped as Croatian: ${extraHr}, as ijekavian: ${extraIje})`);
