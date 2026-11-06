// Ko zna zna generator: ten questions a day, one per category, in the TV order
// (language first, sport last), mixing difficulties.
//
// Sources, merged per category:
//   data/kozna/NN-<category>.json   hand-written  {q, o:[3], a?, d?}   (a defaults to 0, d to 1)
//   data/kozna/generated/<cat>.json Wikidata-derived {q, o:[3], a, d, src}
//
// Each (category, difficulty) pool is dealt in a fixed seeded order, so a question does
// not repeat until that pool is exhausted. The difficulty of each slot follows a daily
// pattern (mostly medium/hard, rotated per day so every category sees every level);
// a missing level falls back to the nearest available one. Option order is shuffled
// per day so the correct answer lands on A, B or C evenly.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rng } from './slagalica-gen.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BANK_DIR = path.join(root, 'data', 'kozna');
export const GEN_DIR = path.join(BANK_DIR, 'generated');
export const QUESTIONS_PER_DAY = 10;
/** Difficulty per slot before rotation: 2 easy, 4 medium, 4 hard. */
export const PATTERN = [1, 2, 3, 2, 3, 1, 2, 3, 2, 3];

const LABELS = { knjizevnost: 'književnost', 'muzika-film': 'muzika i film', 'opsta-kultura': 'opšta kultura' };
const keyOf = (file) => file.replace(/^\d+-/, '').replace(/\.json$/, '');
const labelOf = (key) => LABELS[key] || key.replace(/-/g, ' ');

export function loadBank(dir = BANK_DIR) {
  const files = fs.readdirSync(dir).filter((f) => /^\d+-.*\.json$/.test(f)).sort();
  return files.map((f) => {
    const key = keyOf(f);
    const hand = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).map((q) => ({ ...q, a: q.a ?? 0, d: q.d ?? 1, hand: true }));
    const genFile = path.join(dir, 'generated', key + '.json');
    const handKeys = new Set(hand.map((q) => norm(q.q)));
    // hand-written questions win over generated ones with the same text
    const gen = fs.existsSync(genFile)
      ? JSON.parse(fs.readFileSync(genFile, 'utf8')).map((q) => ({ ...q, a: q.a ?? 0, d: q.d ?? 2 })).filter((q) => !handKeys.has(norm(q.q)))
      : [];
    return { cat: labelOf(key), key, file: f, questions: [...hand, ...gen], hand: hand.length, generated: gen.length };
  });
}

const norm = (s) => s.toLowerCase().replace(/[„“"'’.,:;!?()]/g, '').replace(/\s+/g, ' ').trim();

/** Structural checks. Returns a list of error strings (empty = ok). */
export function validateBank(bank) {
  const errors = [];
  if (bank.length !== QUESTIONS_PER_DAY) errors.push(`expected ${QUESTIONS_PER_DAY} categories, found ${bank.length}`);
  const globalQ = new Map();
  for (const c of bank) {
    if (!Array.isArray(c.questions) || !c.questions.length) { errors.push(`${c.file}: empty`); continue; }
    c.questions.forEach((q, i) => {
      const where = `${c.file}[${i}]${q.src ? ' ' + q.src : ''}`;
      if (!q || typeof q.q !== 'string' || !q.q.trim()) errors.push(`${where}: missing question text`);
      if (!Array.isArray(q.o) || q.o.length !== 3) errors.push(`${where}: needs exactly 3 options`);
      else {
        if (q.o.some((o) => typeof o !== 'string' || !o.trim())) errors.push(`${where}: empty option`);
        if (new Set(q.o.map(norm)).size !== 3) errors.push(`${where}: duplicate options`);
      }
      if (![0, 1, 2].includes(q.a)) errors.push(`${where}: bad answer index`);
      if (![1, 2, 3].includes(q.d)) errors.push(`${where}: bad difficulty`);
      const key = norm(q.q || '');
      if (key) {
        const prev = globalQ.get(key);
        if (prev) errors.push(`${where}: duplicate question (also ${prev})`); else globalQ.set(key, where);
      }
    });
  }
  return errors;
}

function shuffle(r, arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Difficulty wanted for category slot `ci` on `day`. */
export const slotDifficulty = (day, ci) => PATTERN[(ci + day) % PATTERN.length];

/** Pools per difficulty for a category, each in a fixed seeded order. */
function pools(c, ci) {
  const p = {};
  for (const d of [1, 2, 3]) {
    const list = c.questions.filter((q) => q.d === d);
    p[d] = shuffle(rng(0x5a1a + ci * 7919 + d * 131), list);
  }
  return p;
}

/**
 * Nearest difficulty to `want` that still has unused questions; when every pool is used
 * up, the nearest non-empty one (questions then start repeating).
 */
function pickLevel(p, used, want) {
  const order = [want, want - 1, want + 1, want - 2, want + 2];
  for (const d of order) if (p[d] && used[d] < p[d].length) return d;
  for (const d of order) if (p[d] && p[d].length) return d;
  return null;
}

/**
 * Builds a dealer: `deal(day)` returns the ten questions for that day. Days must be dealt in
 * order from 0 for the no-repeat guarantee (the dealer tracks how often each pool was used).
 */
export function makeDealer(bank) {
  const P = bank.map(pools);
  const used = bank.map(() => ({ 1: 0, 2: 0, 3: 0 }));
  let nextDay = 0;
  const dealOne = (day, ci) => {
    const level = pickLevel(P[ci], used[ci], slotDifficulty(day, ci));
    const list = P[ci][level];
    const src = list[used[ci][level] % list.length];
    used[ci][level]++;
    return src;
  };
  return {
    deal(day) {
      while (nextDay < day) { bank.forEach((c, ci) => dealOne(nextDay, ci)); nextDay++; }
      if (day !== nextDay) throw new Error('deal days in increasing order (asked ' + day + ' after ' + nextDay + ')');
      nextDay++;
      const r = rng(day * 31337 + 101);
      return bank.map((c, ci) => {
        const src = dealOne(day, ci);
        const correct = src.o[src.a];
        const o = shuffle(r, src.o);
        const out = { q: src.q, o, a: o.indexOf(correct), cat: c.cat, d: src.d };
        if (src.src) out.src = src.src;
        return out;
      });
    },
  };
}

/** Convenience for a single day (replays from day 0). */
export function generateKoZnaZna(day, bank) {
  return makeDealer(bank).deal(day);
}

/** Days until the first repeat: one question per category per day, pools spill into neighbours when used up. */
export function repeatHorizon(bank) {
  return Math.min(...bank.map((c) => c.questions.length));
}
