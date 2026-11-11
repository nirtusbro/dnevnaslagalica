// Imports the TV Slagalica association archive into candidate puzzles for the bank.
//
// Source: data/raw/py-asocijacije/manual/*.txt (github.com/djordje34/PY-Asocijacije, a fan
// transcription of the Asocijacije round of TV Slagalica episodes 5611–7402, two per file).
// Every file lists А1..А4, А, Б1.., В1.., Г1.., ??? in Serbian Cyrillic.
//
//   node tools/asocijacije-import.mjs            report + write data/raw/asoc-candidates.json
//   node tools/asocijacije-import.mjs --write    also rebuild the bank, data/asocijacije/tv-NN.json
//
// A candidate is kept only when it fits the game as it is: every clue <= 14 and every solution
// <= 12 characters, letters / single spaces / hyphens only, and it passes the bank validator on
// its own. `acc` (other accepted forms) is filled from srLex: every case and number of a
// one-word solution, the joined spelling of a multi-word one, and the surname of a person.
// Candidates carry `src` (episode + 1|2) and `unknown`, the clues and solutions with a word that is
// rare in the srWaC corpus (obscure names and terms), which the bank builder uses to rank them.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { validateBank, BANK_DIR, MAX_CLUE_LENGTH, MAX_SOLUTION_LENGTH, MAX_SOLUTION_REUSE } from './asocijacije-gen.mjs';
import { normalize } from '../src/engine/text.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(root, 'data', 'raw', 'py-asocijacije', 'manual');
const OUT = path.join(root, 'data', 'raw', 'asoc-candidates.json');

const CYR = { А: 'A', Б: 'B', В: 'V', Г: 'G', Д: 'D', Ђ: 'Đ', Е: 'E', Ж: 'Ž', З: 'Z', И: 'I', Ј: 'J', К: 'K', Л: 'L', Љ: 'LJ', М: 'M', Н: 'N', Њ: 'NJ', О: 'O', П: 'P', Р: 'R', С: 'S', Т: 'T', Ћ: 'Ć', У: 'U', Ф: 'F', Х: 'H', Ц: 'C', Ч: 'Č', Џ: 'DŽ', Ш: 'Š' };
/** Cyrillic → upper-case Serbian Latin; stray Latin look-alikes in the source pass through. */
export function toLatin(s) {
  return [...s.toUpperCase()].map((ch) => CYR[ch] ?? ch).join('').replace(/[„“”"'`’]/g, '').replace(/\s+/g, ' ').replace(/[.!?]+$/, '').trim();
}

const KEY = { А: 0, A: 0, Б: 1, B: 1, В: 2, Г: 3 };

/** Parses one episode file into up to two raw puzzles (Latin, upper-case, unfiltered). */
export function parseEpisode(text, id) {
  const puzzles = [];
  let cur = null;
  const start = () => { cur = { cols: [0, 1, 2, 3].map(() => ({ f: [], s: null })), final: null }; };
  for (const raw of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const m = raw.match(/^\s*(\?\?\?|[АБВГAB])\s*([1-4])?\s*-\s*(.+?)\s*$/);
    if (!m) continue;
    if (!cur) start();
    const val = toLatin(m[3]);
    if (m[1] === '???') {
      cur.final = { s: val };
      puzzles.push({ ...cur, src: `${id}/${puzzles.length + 1}` });
      cur = null;
    } else {
      const col = cur.cols[KEY[m[1]]];
      if (m[2]) col.f[+m[2] - 1] = val; else col.s = val;
    }
  }
  return puzzles;
}

/** Bank size: one puzzle a day for a year, the cleanest candidates first. */
export const BANK_SIZE = 366;
const PER_FILE = 40;

const TEXT_RE = /^[A-ZČĆŠŽĐ]+(?:[ -][A-ZČĆŠŽĐ]+)*$/;
/** Why a raw puzzle cannot be used as it is, or null. */
export function unfit(p) {
  if (!p.final?.s) return 'incomplete';
  for (const c of p.cols) {
    if (!c.s || c.f.length !== 4 || c.f.some((f) => !f)) return 'incomplete';
    if (!TEXT_RE.test(c.s)) return 'characters';
    if (c.s.length > MAX_SOLUTION_LENGTH) return 'long solution';
    for (const f of c.f) {
      if (!TEXT_RE.test(f)) return 'characters';
      if (f.length > MAX_CLUE_LENGTH) return 'long clue';
    }
  }
  if (!TEXT_RE.test(p.final.s)) return 'characters';
  // fragments (U SJAJ) and abbreviations (TV) make poor answers
  if ([...p.cols, p.final].some((e) => e.s.length < 3 || e.s.split(/[ -]/).some((w) => w.length < 2))) return 'short solution';
  if (p.final.s.length > MAX_SOLUTION_LENGTH) return 'long solution';
  return null;
}

/**
 * Two passes over srLex. `freq` maps each given lower-case token to its srWaC count over all
 * readings (proper nouns included, so TITO and DUNAV count as familiar while GRIZELJ does not).
 * `forms` maps each given lower-case word (a one-word solution) to the other forms a player may
 * type: for a noun every case and number of its lemma (SUDOVI → SUD, SUDA...), for an adjective
 * the positive nominatives (ZELENA → ZELEN, ZELENI, ZELENO, ZELENE).
 */
async function readLexicon(words, tokens) {
  const file = path.join(root, 'data', 'raw', 'srLex_v1.3.gz');
  if (!fs.existsSync(file)) throw new Error('data/raw/srLex_v1.3.gz is missing (see data/README.md)');
  const rows = () => readline.createInterface({ input: fs.createReadStream(file).pipe(zlib.createGunzip()) });
  const isNominative = (msd) => (msd[0] === 'N' ? msd[4] === 'n' : msd[2] === 'p' && msd[5] === 'n');
  const freq = new Map();
  const lemmaWords = new Map(); // "lemma|N" → the solution words that are a nominative of it
  for await (const line of rows()) {
    const [form, lemma, msd, , , , n] = line.split('\t');
    const lf = form.toLowerCase();
    if (tokens.has(lf)) freq.set(lf, (freq.get(lf) || 0) + (+n || 0));
    if (!words.has(lf) || !msd || !/^(Nc|Np|Ag)/.test(msd) || !isNominative(msd)) continue;
    const key = lemma + '|' + msd[0];
    if (!lemmaWords.has(key)) lemmaWords.set(key, new Set());
    lemmaWords.get(key).add(lf);
  }
  const forms = new Map();
  for await (const line of rows()) {
    const [form, lemma, msd] = line.split('\t');
    const owners = msd && lemmaWords.get(lemma + '|' + msd[0]);
    if (!owners || !/^(Nc|Np|Ag)/.test(msd) || (msd[0] === 'A' && !isNominative(msd))) continue;
    if (!/^[a-zčćšžđ]+$/i.test(form)) continue;
    for (const w of owners) {
      if (!forms.has(w)) forms.set(w, new Set());
      forms.get(w).add(form.toUpperCase());
    }
  }
  // drop ijekavian spellings (SJEVER, SMIJEH) when the ekavian one is there
  for (const set of forms.values()) {
    for (const f of [...set]) {
      const ekavian = [f.replace('IJE', 'E'), f.replace('JE', 'E')].filter((e) => e !== f);
      if (ekavian.some((e) => set.has(e))) set.delete(f);
    }
  }
  return { forms, freq };
}

/** A clue or solution word seen fewer times than this in srWaC counts as rare. */
export const RARE_BELOW = 100;

function loadWords(...names) {
  const set = new Set();
  for (const n of names) {
    const f = path.join(root, 'data', 'dict', n);
    if (!fs.existsSync(f)) continue;
    for (const w of fs.readFileSync(f, 'utf8').split(/\r?\n/)) if (w && !w.startsWith('#')) set.add(w);
  }
  return set;
}

async function main() {
  const files = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith('.txt')).sort();
  const raw = files.flatMap((f) => parseEpisode(fs.readFileSync(path.join(SRC_DIR, f), 'utf8'), f.replace(/^s|a?\.txt$/g, '')));
  const reasons = {};
  let fit = raw.filter((p) => { const r = unfit(p); if (r) reasons[r] = (reasons[r] || 0) + 1; return !r; });
  console.log(`parsed ${raw.length} puzzles from ${files.length} episodes; fit ${fit.length}; rejected`, reasons);

  const core = loadWords('core.txt');
  const lemmas = new Set();
  const tokens = new Set();
  for (const p of fit) for (const e of [...p.cols, p.final]) {
    if (!e.s.includes(' ')) lemmas.add(e.s.toLowerCase());
    for (const t of [e.s, ...(e.f || [])]) for (const w of t.split(/[ -]/)) tokens.add(w.toLowerCase());
  }
  const { forms, freq } = await readLexicon(lemmas, tokens);
  const familiar = fs.readFileSync(path.join(BANK_DIR, 'familiar.txt'), 'utf8').split(/\r?\n/).filter((l) => !l.startsWith('#')).join(' ').split(/\s+/).filter(Boolean);
  for (const w of familiar) freq.set(w.toLowerCase(), Infinity);

  const out = [];
  let invalid = 0;
  for (const p of fit) {
    const taken = new Set(p.cols.flatMap((c) => c.f.map(normalize)));
    const entries = [...p.cols, p.final];
    const own = entries.map((e) => normalize(e.s));
    entries.forEach((e, i) => {
      const acc = new Set();
      const words = e.s.split(/[ -]/);
      if (words.length === 1) for (const f of forms.get(e.s.toLowerCase()) || []) acc.add(f);
      else {
        acc.add(words.join(''));
        acc.add(words.join(' '));
        // a person (the last word is not a dictionary word): the surname alone is enough
        if (words.length === 2 && !core.has(words[1].toLowerCase())) acc.add(words[1]);
      }
      const seen = new Set([own[i]]);
      const list = [];
      for (const a of [...acc].sort()) {
        const n = normalize(a);
        if (seen.has(n) || taken.has(n) || own.includes(n) || a.length > MAX_SOLUTION_LENGTH + 4) continue;
        seen.add(n);
        list.push(a);
      }
      if (list.length) e.acc = list; else delete e.acc;
    });
    // two entries must not accept the same form
    const owner = new Map();
    for (const e of entries) for (const a of e.acc || []) { const n = normalize(a); owner.set(n, (owner.get(n) || 0) + 1); }
    for (const e of entries) if (e.acc) { e.acc = e.acc.filter((a) => owner.get(normalize(a)) === 1); if (!e.acc.length) delete e.acc; }

    const unknown = [];
    for (const e of entries) for (const t of [e.s, ...(e.f || [])]) {
      if (t.split(/[ -]/).some((w) => (freq.get(w.toLowerCase()) || 0) < RARE_BELOW)) unknown.push(t);
    }
    const puzzle = { cols: p.cols.map((c) => ({ f: c.f, s: c.s, ...(c.acc ? { acc: c.acc } : {}) })), final: p.final, src: p.src, unknown };
    if (validateBank([puzzle]).length) { invalid++; continue; }
    out.push(puzzle);
  }
  console.log(`valid candidates: ${out.length} (dropped by the validator: ${invalid})`);
  fs.writeFileSync(OUT, JSON.stringify(out) + '\n', 'utf8');
  console.log('wrote ' + path.relative(root, OUT));
  if (process.argv.includes('--write')) writeBank(selectBank(out));
}

/**
 * The bank: candidates with the fewest rare words first (source order within a tier), unique
 * finals, and no column solution used more than MAX_SOLUTION_REUSE times.
 */
export function selectBank(candidates, size = BANK_SIZE) {
  const finals = new Set();
  const use = new Map();
  const bank = [];
  const tiers = [...new Set(candidates.map((p) => p.unknown.length))].sort((a, b) => a - b);
  for (const tier of tiers) {
    for (const p of candidates) {
      if (p.unknown.length !== tier || bank.length >= size) continue;
      const f = normalize(p.final.s);
      const sols = p.cols.map((c) => normalize(c.s));
      if (finals.has(f) || sols.some((s) => (use.get(s) || 0) >= MAX_SOLUTION_REUSE)) continue;
      finals.add(f);
      for (const s of sols) use.set(s, (use.get(s) || 0) + 1);
      bank.push(p);
    }
    console.log(`  after tier ${tier} (${tier} rare words): ${bank.length} puzzles`);
    if (bank.length >= size) break;
  }
  return bank;
}

function writeBank(bank) {
  const errors = validateBank(bank.map((p, i) => ({ ...p, file: 'tv', idx: i })));
  if (errors.length) throw new Error('selected bank is invalid:\n  ' + errors.join('\n  '));
  for (const f of fs.readdirSync(BANK_DIR)) if (f.endsWith('.json')) fs.unlinkSync(path.join(BANK_DIR, f));
  for (let i = 0; i < bank.length; i += PER_FILE) {
    const rows = bank.slice(i, i + PER_FILE).map(({ cols, final, src }) => '  ' + JSON.stringify({ cols, final, src }));
    const name = `tv-${String(i / PER_FILE + 1).padStart(2, '0')}.json`;
    fs.writeFileSync(path.join(BANK_DIR, name), '[\n' + rows.join(',\n') + '\n]\n', 'utf8');
  }
  console.log(`wrote ${bank.length} puzzles to ${path.relative(root, BANK_DIR)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
