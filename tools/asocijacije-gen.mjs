// Asocijacije generator: one hand-written puzzle a day, dealt from a bank in a fixed
// seeded order so nothing repeats until the whole bank has been played.
//
// Bank: data/asocijacije/*.json, each file an array of puzzles
//   { cols: [{ f: [4 clues], s: 'SOLUTION', acc?: ['OTHER FORM'] }] x4,
//     final: { s: 'FINAL', acc?: [...] }, d?: 1|2|3, tags?: [...] }
// Columns are kept in the author's order (A–D); the day file gets the schema shape
// { cols: [{ L, f, s, acc? }], final: { s, acc? } }.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rng } from './slagalica-gen.mjs';
import { normalize } from '../src/engine/text.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BANK_DIR = path.join(root, 'data', 'asocijacije');
export const CLUES_PER_COLUMN = 4;
export const COLUMNS = 4;
export const LETTERS = ['A', 'B', 'C', 'D'];
/** Display limits (the clue buttons and solution buttons are fixed-width). */
export const MAX_CLUE_LENGTH = 14;
export const MAX_SOLUTION_LENGTH = 12;
/** A column solution may be reused across the bank at most this many times. */
export const MAX_SOLUTION_REUSE = 3;
const SEED = 0xa50c;

/** Upper-case Serbian Latin: letters, single spaces and hyphens only. */
const TEXT_RE = /^[A-ZČĆŠŽĐ]+(?:[ -][A-ZČĆŠŽĐ]+)*$/;

/** Loads every data/asocijacije/*.json (sorted) into one flat list of puzzles. */
export function loadBank(dir = BANK_DIR) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  const bank = [];
  for (const f of files) {
    const list = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (!Array.isArray(list)) throw new Error(`${f}: expected an array of puzzles`);
    list.forEach((p, i) => bank.push({ ...p, file: f, idx: i }));
  }
  return bank;
}

const nameOf = (p) => `${p?.file ?? 'bank'}[${p?.idx ?? '?'}] "${p?.final?.s ?? '?'}"`;

/** Every rule a puzzle must satisfy. Returns a list of error strings (empty = ok). */
export function validateBank(bank) {
  const errors = [];
  if (!Array.isArray(bank) || !bank.length) return ['bank is empty'];
  const finals = new Map();
  const fingerprints = new Map();
  const solutionUse = new Map();

  bank.forEach((p, bi) => {
    const where = nameOf(p?.idx == null ? { ...p, idx: bi } : p);
    const err = (m) => errors.push(`${where}: ${m}`);
    if (!p || typeof p !== 'object') { err('not an object'); return; }
    if (!p.final || typeof p.final !== 'object') { err('missing final'); return; }
    if (!Array.isArray(p.cols) || p.cols.length !== COLUMNS) { err(`needs exactly ${COLUMNS} columns`); return; }

    const checkText = (label, s, max) => {
      if (typeof s !== 'string' || !s.trim()) { err(`${label}: empty`); return false; }
      if (s !== s.toUpperCase()) err(`${label} "${s}": must be upper-case`);
      if (!TEXT_RE.test(s)) err(`${label} "${s}": only Serbian Latin letters, single spaces and hyphens allowed`);
      if (s.length > max) err(`${label} "${s}": longer than ${max} characters`);
      return true;
    };
    const checkAcc = (label, e) => {
      if (e.acc == null) return;
      if (!Array.isArray(e.acc)) { err(`${label}: acc must be an array`); return; }
      const seen = new Set([normalize(e.s)]);
      e.acc.forEach((a) => {
        if (!checkText(`${label} acc`, a, MAX_SOLUTION_LENGTH + 4)) return;
        const n = normalize(a);
        if (seen.has(n)) err(`${label} acc "${a}": same as the solution or another acc after normalisation`);
        seen.add(n);
      });
    };

    if (p.d != null && ![1, 2, 3].includes(p.d)) err('d must be 1, 2 or 3');
    if (p.tags != null && (!Array.isArray(p.tags) || p.tags.some((t) => typeof t !== 'string'))) err('tags must be a list of strings');

    const finalOk = checkText('final', p.final.s, MAX_SOLUTION_LENGTH);
    checkAcc('final', p.final);
    const finalN = finalOk ? normalize(p.final.s) : '';

    const allClues = new Map();
    const colSolutions = new Map();
    p.cols.forEach((c, ci) => {
      const L = LETTERS[ci];
      if (!c || typeof c !== 'object') { err(`column ${L}: not an object`); return; }
      if (c.L != null && c.L !== L) err(`column ${L}: L must be ${L} or omitted`);
      if (!Array.isArray(c.f) || c.f.length !== CLUES_PER_COLUMN) { err(`column ${L}: needs exactly ${CLUES_PER_COLUMN} clues`); return; }
      const sOk = checkText(`column ${L} solution`, c.s, MAX_SOLUTION_LENGTH);
      checkAcc(`column ${L}`, c);
      const sN = sOk ? normalize(c.s) : '';
      if (sN) {
        if (colSolutions.has(sN)) err(`column ${L}: solution "${c.s}" is also column ${colSolutions.get(sN)}'s solution`);
        colSolutions.set(sN, L);
        if (finalN && sN.includes(finalN)) err(`column ${L}: solution "${c.s}" contains the final solution`);
      }
      c.f.forEach((f, fi) => {
        const label = `clue ${L}${fi + 1}`;
        if (!checkText(label, f, MAX_CLUE_LENGTH)) return;
        const fN = normalize(f);
        const prev = allClues.get(fN);
        if (prev) err(`${label} "${f}": duplicate of ${prev}`); else allClues.set(fN, label);
        if (sN && fN.includes(sN)) err(`${label} "${f}": contains the column solution "${c.s}"`);
        if (finalN && fN.includes(finalN)) err(`${label} "${f}": contains the final solution`);
      });
    });
    // every accepted answer (solution or acc) of every column and of the final, normalised
    const answers = new Map();
    const addAnswer = (label, e) => {
      if (!e || typeof e.s !== 'string') return;
      for (const a of [e.s, ...(Array.isArray(e.acc) ? e.acc : [])]) {
        if (typeof a !== 'string') continue;
        const n = normalize(a);
        const prev = answers.get(n);
        if (prev && prev !== label) err(`${label} accepts "${a}", which ${prev} also accepts`);
        else answers.set(n, label);
      }
    };
    p.cols.forEach((c, ci) => addAnswer(`column ${LETTERS[ci]}`, c));
    addAnswer('final', p.final);
    // a clue must not be an accepted answer of any column (other columns included) or of the final
    p.cols.forEach((c, ci) => {
      if (!c || !Array.isArray(c.f)) return;
      c.f.forEach((f, fi) => {
        if (typeof f !== 'string') return;
        const fN = normalize(f);
        const owner = answers.get(fN);
        const ownSolution = typeof c.s === 'string' && normalize(c.s) === fN; // already reported above
        if (owner && !ownSolution) err(`clue ${LETTERS[ci]}${fi + 1} "${f}": equals ${owner}'s solution or an accepted form of it`);
      });
    });

    if (finalN) {
      const prev = finals.get(finalN);
      if (prev) err(`duplicate final solution (also ${prev})`); else finals.set(finalN, where);
    }
    for (const sN of colSolutions.keys()) {
      const uses = solutionUse.get(sN) || [];
      uses.push(where);
      solutionUse.set(sN, uses);
    }
    const fp = p.cols.map((c) => (Array.isArray(c?.f) ? c.f.map(normalize).sort().join(',') : '')).sort().join('|');
    const dup = fingerprints.get(fp);
    if (dup) err(`duplicate puzzle (same clues as ${dup})`); else fingerprints.set(fp, where);
  });

  for (const [s, uses] of solutionUse) {
    if (uses.length > MAX_SOLUTION_REUSE) errors.push(`column solution "${s}" used ${uses.length} times (max ${MAX_SOLUTION_REUSE}): ${uses.join(', ')}`);
  }
  return errors;
}

function shuffle(r, arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Day-file shape for one bank puzzle (letters A–D in author order). */
export function toDayPuzzle(p) {
  const entry = (e) => (Array.isArray(e.acc) && e.acc.length ? { s: e.s, acc: [...e.acc] } : { s: e.s });
  return {
    cols: p.cols.map((c, i) => ({ L: LETTERS[i], f: [...c.f], ...entry(c) })),
    final: entry(p.final),
  };
}

/**
 * Builds a dealer: `deal(day)` returns the puzzle for that day. The bank is shuffled once
 * with a fixed seed and dealt in that order from day 0, so no puzzle repeats before every
 * puzzle has been used; after that the same order cycles.
 */
export function makeDealer(bank) {
  if (!Array.isArray(bank) || !bank.length) throw new Error('empty Asocijacije bank');
  const order = shuffle(rng(SEED), bank.map((_, i) => i));
  return {
    deal(day) {
      if (!Number.isInteger(day) || day < 0) throw new Error('day must be a non-negative integer');
      return toDayPuzzle(bank[order[day % order.length]]);
    },
  };
}

/** Convenience for a single day. */
export function generateAsocijacije(day, bank) {
  return makeDealer(bank).deal(day);
}

/** Days until the first repeat: one puzzle a day. */
export function repeatHorizon(bank) {
  return bank.length;
}
