// Ko zna zna generator: ten questions a day in the TV order (language first, sport last),
// mixing difficulties.
//
// Sources, merged per category:
//   data/kozna/NN-<category>.json    hand-written  {q, o:[3], a?, d?}   (a defaults to 0, d to 1)
//   data/kozna/oz/<category>.json    real entrance-exam questions (OZ Eval, Apache-2.0)
//                                    {q, o:[3], a, d, src:"oz:<index>"}, built by kozna-import-oz.mjs
//   data/kozna/opentdb/<category>.json  Open Trivia DB (CC BY-SA 4.0) translated into Serbian
//                                    {q, o:[3], a, d, src:"otdb:<id>"}, built by kozna-import-opentdb.mjs
//   data/kozna/generated/<cat>.json  Wikidata-derived {q, o:[3], a, d, src:"Q…"}
//
// The first three are "curated" and are preferred; Wikidata templates fill what is left, paced so
// the curated questions last the whole year instead of running out in spring.
//
// "Which year…" questions (all three options are years) are rationed: at most one a day, and only
// on every YEAR_EVERY-th day. A category that would run out of other questions before the year is
// over hands some of its slots to the category with the largest surplus, so a day normally has
// one question per category but sometimes two from a well-stocked one.
//
// No question repeats within HORIZON days. Days up to FROZEN_THROUGH were published before this
// dealer existed; they are read back from the day files, never regenerated, and their questions
// are not dealt again. Option order is shuffled per day so the answer lands on A, B or C evenly.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rng } from './slagalica-gen.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BANK_DIR = path.join(root, 'data', 'kozna');
export const GEN_DIR = path.join(BANK_DIR, 'generated');
export const OZ_DIR = path.join(BANK_DIR, 'oz');
export const DAYS_DIR = path.join(root, 'src', 'puzzles', 'days');
export const QUESTIONS_PER_DAY = 10;
/** Difficulty per slot before rotation: 2 easy, 4 medium, 4 hard. */
export const PATTERN = [1, 2, 3, 2, 3, 1, 2, 3, 2, 3];
/** A year question may appear only on days divisible by this, and then only once. */
export const YEAR_EVERY = 3;
/** Days the bank is paced for (one year of puzzles). */
export const HORIZON = 366;
/** Last day published before the current bank (2026-11-17); these day files are kept as they are. */
export const FROZEN_THROUGH = 12;

const LABELS = { knjizevnost: 'književnost', 'muzika-film': 'muzika i film', 'opsta-kultura': 'opšta kultura' };
const keyOf = (file) => file.replace(/^\d+-/, '').replace(/\.json$/, '');
const labelOf = (key) => LABELS[key] || key.replace(/-/g, ' ');
const norm = (s) => s.toLowerCase().replace(/[„“”"'’.,:;!?()]/g, '').replace(/\s+/g, ' ').trim();

// a year, optionally a full date, an era, or a span / pair of years:
// "1389", "1804.", "6. aprila 1941.", "490. godine pre n. e.", "1912–1913", "1972. i 1984."
const YEAR = String.raw`\d{3,4}\.?( godine)?( pre n\. ?e\.| p\. ?n\. ?e\.)?`;
const YEAR_RE = new RegExp(String.raw`^(\d{1,2}\. [a-zčćšžđ]+ )?${YEAR}( ?(–|-|i) ?${YEAR})?$`, 'i');
/** True when the question asks for a date: at least two options are years and the third names one too. */
export const isYearQuestion = (q) => {
  const o = q.o.map((x) => String(x).trim());
  return o.filter((x) => YEAR_RE.test(x)).length >= 2 && o.every((x) => /\d{3,4}/.test(x) && !/[°%/]/.test(x));
};

const readJson = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []);

export function loadBank(dir = BANK_DIR) {
  const files = fs.readdirSync(dir).filter((f) => /^\d+-.*\.json$/.test(f)).sort();
  const cats = files.map((f) => ({ key: keyOf(f), file: f }));
  // hand-written questions win over exam questions, and both win over generated ones with the same text
  const seen = new Set();
  const fresh = (q) => { const k = norm(q.q); if (seen.has(k)) return false; seen.add(k); return true; };
  const hand = cats.map((c) => readJson(path.join(dir, c.file)).map((q) => ({ ...q, a: q.a ?? 0, d: q.d ?? 1, hand: true })).filter(fresh));
  const oz = cats.map((c) => readJson(path.join(dir, 'oz', c.key + '.json')).map((q) => ({ ...q, a: q.a ?? 0, d: q.d ?? 2, exam: true })).filter(fresh));
  const trivia = cats.map((c) => readJson(path.join(dir, 'opentdb', c.key + '.json')).map((q) => ({ ...q, a: q.a ?? 0, d: q.d ?? 2, trivia: true })).filter(fresh));
  const gen = cats.map((c) => readJson(path.join(dir, 'generated', c.key + '.json')).map((q) => ({ ...q, a: q.a ?? 0, d: q.d ?? 2 })).filter(fresh));
  // Wikidata templates are filler: where a category is deep enough without them, the obscure third
  // (few sitelinks, d = 3) is left out so the filler that does appear is about well-known things.
  gen.forEach((list, i) => {
    const plain = (qs) => qs.filter((q) => !isYearQuestion(q)).length;
    const known = list.filter((q) => q.d < 3 || isYearQuestion(q));
    if (plain(hand[i]) + plain(oz[i]) + plain(trivia[i]) + plain(known) >= HORIZON * 1.25) gen[i] = known;
  });
  return cats.map((c, i) => ({
    cat: labelOf(c.key), key: c.key, file: c.file,
    questions: [...hand[i], ...oz[i], ...trivia[i], ...gen[i]].map((q) => ({ ...q, year: isYearQuestion(q) })),
    hand: hand[i].length, exam: oz[i].length, trivia: trivia[i].length, generated: gen[i].length,
  }));
}

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

/** Ko zna zna sections of the frozen day files: Map(day → questions). */
export function loadPublished(dir = DAYS_DIR, through = FROZEN_THROUGH) {
  const out = new Map();
  for (let day = 1; day <= through; day++) {
    const f = path.join(dir, String(day).padStart(3, '0') + '.json');
    const qs = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).koZnaZna : null;
    if (qs) out.set(day, qs);
  }
  return out;
}

const isCurated = (q) => !!(q.hand || q.exam || q.trivia);

/** Per-category pools, each in a fixed seeded order. */
function pools(c, ci) {
  const by = (keep, salt) => {
    const p = {};
    for (const d of [1, 2, 3]) p[d] = shuffle(rng(0x5a1a + ci * 7919 + d * 131 + salt), c.questions.filter((q) => !q.year && q.d === d && keep(q)));
    return p;
  };
  // year questions: curated first, then generated from famous to obscure
  const rank = (q) => (isCurated(q) ? 0 : q.d);
  const year = shuffle(rng(0x7e4a + ci * 104729), c.questions.filter((q) => q.year)).sort((a, b) => rank(a) - rank(b));
  return { cur: by(isCurated, 0), gen: by((q) => !isCurated(q), 53), year };
}

/**
 * Builds a dealer: `deal(day)` returns the ten questions for that day. Days must be dealt in
 * increasing order (the dealer tracks which questions are used); `published` days are returned
 * as stored. `dealer.repeats` counts questions that had to be reused.
 */
export function makeDealer(bank, { published = loadPublished() } = {}) {
  const P = bank.map(pools);
  const used = new Set();
  for (const qs of published.values()) for (const q of qs) used.add(norm(q.q));
  const isFree = (q) => !used.has(norm(q.q));
  const left = (p) => [1, 2, 3].reduce((n, d) => n + p[d].filter(isFree).length, 0);
  /** First unused question of the level nearest to `want`, trying the pools in the given order at each level. */
  const pick = (ps, want) => {
    for (const d of [want, want - 1, want + 1, want - 2, want + 2]) {
      for (const p of ps) { const q = p[d] && p[d].find(isFree); if (q) return q; }
    }
    return null;
  };
  const dealer = { repeats: 0, deal };
  let nextDay = 0;

  function dealDay(day) {
    const r = rng(day * 7919 + 17);
    const daysLeft = Math.max(1, HORIZON - day + 1);
    const stock = P.map((p) => ({ cur: left(p.cur), gen: left(p.gen), year: p.year.filter(isFree).length }));
    const plain = (ci) => stock[ci].cur + stock[ci].gen;
    // the year question of the day goes to one of the categories shortest of other questions
    let yearSlot = -1;
    if (day % YEAR_EVERY === 0) {
      const cand = bank.map((_, ci) => ci).filter((ci) => stock[ci].year > 0).sort((a, b) => plain(a) - plain(b)).slice(0, 3);
      if (cand.length) yearSlot = cand[Math.floor(r() * cand.length)];
    }
    const donated = new Set();
    const take = (q, ci) => { used.add(norm(q.q)); stock[ci][q.year ? 'year' : isCurated(q) ? 'cur' : 'gen']--; return q; };
    /** A non-year question from category `ci`, curated ones paced to last the year. */
    const own = (ci, want) => {
      const need = Math.min(daysLeft, plain(ci));
      const order = stock[ci].gen === 0 || r() < stock[ci].cur / Math.max(1, need) ? ['cur', 'gen'] : ['gen', 'cur'];
      // the chosen source first at any level: curated questions must not be left over at the end of the year
      const q = pick([P[ci][order[0]]], want) || pick([P[ci][order[1]]], want);
      return q ? take(q, ci) : null;
    };
    return bank.map((c, ci) => {
      const want = slotDifficulty(day, ci);
      let from = ci;
      let q = null;
      if (ci === yearSlot) q = take(P[ci].year.find(isFree), ci);
      // a category short of questions keeps only as many slots as it can fill over the year
      else if (r() < plain(ci) / daysLeft) q = own(ci, want);
      if (!q) {
        // lend the slot to a category with a surplus, the bigger the surplus the likelier
        const donors = bank.map((_, di) => di).filter((di) => di !== ci && !donated.has(di) && plain(di) > daysLeft)
          .map((di) => [di, r() * (plain(di) - daysLeft)]).sort((a, b) => b[1] - a[1]).map(([di]) => di);
        for (const di of donors) { q = own(di, want); if (q) { from = di; donated.add(di); break; } }
      }
      if (!q) q = own(ci, want);
      if (!q) { // bank exhausted: this category's questions start over
        dealer.repeats++;
        for (const x of c.questions) used.delete(norm(x.q));
        stock[ci] = { cur: left(P[ci].cur), gen: left(P[ci].gen), year: P[ci].year.filter(isFree).length };
        q = own(ci, want) || take(P[ci].year.find(isFree), ci);
      }
      return { q, from };
    });
  }

  function deal(day) {
    while (nextDay < day) { if (!published.has(nextDay)) dealDay(nextDay); nextDay++; }
    if (day !== nextDay) throw new Error('deal days in increasing order (asked ' + day + ' after ' + nextDay + ')');
    nextDay++;
    if (published.has(day)) return published.get(day);
    const r = rng(day * 31337 + 101);
    return dealDay(day).map(({ q: src, from }) => {
      const correct = src.o[src.a];
      const o = shuffle(r, src.o);
      const out = { q: src.q, o, a: o.indexOf(correct), cat: bank[from].cat, d: src.d };
      if (src.src) out.src = src.src;
      return out;
    });
  }
  return dealer;
}

/** Convenience for a single day (replays from day 0). */
export function generateKoZnaZna(day, bank, opts) {
  return makeDealer(bank, opts).deal(day);
}

/** Days the bank lasts without repeating a question, given the year-question ration. */
export function repeatHorizon(bank) {
  const plain = bank.reduce((n, c) => n + c.questions.filter((q) => !q.year).length, 0);
  return Math.floor(plain / (QUESTIONS_PER_DAY - 1 / YEAR_EVERY));
}
