import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { generateSlagalica, spellable, rng } from '../tools/slagalica-gen.mjs';
import { generateMojBroj, MID, BIG } from '../tools/mojbroj-gen.mjs';
import { solve } from '../src/engine/mojbroj.js';
import { generateSkocko } from '../tools/skocko-gen.mjs';
import { loadBank, validateBank, generateKoZnaZna, repeatHorizon, makeDealer } from '../tools/kozna-gen.mjs';
import { loadBank as loadAsocBank, validateBank as validateAsocBank, generateAsocijacije, repeatHorizon as asocHorizon, makeDealer as makeAsocDealer, MAX_CLUE_LENGTH, MAX_SOLUTION_LENGTH } from '../tools/asocijacije-gen.mjs';
import { matchGuess } from '../src/engine/asocijacije.js';
import { normalize } from '../src/engine/text.js';
import { SYMBOLS } from '../src/engine/skocko.js';
import { canSpell } from '../src/engine/slagalica.js';
import { splitLetters, letterCount } from '../src/engine/letters.js';
import { validatePuzzle } from '../src/puzzles/schema.js';
import { SAMPLE_PUZZLE } from '../src/puzzles/sample.js';
import { mergeWithSample } from './helpers.mjs';

// A small synthetic dictionary keeps the test fast and independent of data/.
const DICT = ('krastavac krastavca krastavci nastavak nastava stranac strana kravata kravate svetac ostava oktava traka krava ' +
  'krasta vrana konac vosak otac savet stan starac karta karton navrat novac vatra vetar cvet crta trava kosa kost rosa nos nova ' +
  'stoka vrata ranac kanta sova rak sat trn vrsta sako rana reka arena avet vek vest nerv srce crv vrat san nas ona ton tok kov rok ' +
  'planinarenje planinar planina planine plan lane nina rane nera rena pena pan anin arena ranjen jelen jele lena neran prenaran').split(' ');
const FREQ = { a: 0.12, e: 0.1, i: 0.1, o: 0.09, n: 0.08, r: 0.07, t: 0.06, s: 0.06, k: 0.05, v: 0.05, l: 0.04, j: 0.04, p: 0.03, c: 0.03, u: 0.03, d: 0.02, m: 0.02 };

test('rng is deterministic', () => {
  const a = rng(42), b = rng(42);
  assert.equal(a(), b());
  assert.notEqual(rng(1)(), rng(2)());
});

test('spellable matches the engine check', () => {
  const letters = splitLetters('planinarenje');
  assert.deepEqual(letters, ['p', 'l', 'a', 'n', 'i', 'n', 'a', 'r', 'e', 'nj', 'e'], 'nj is one tile');
  const got = spellable(DICT, letters);
  for (const w of DICT) assert.equal(got.includes(w), canSpell(w, letters), w);
  assert.ok(got.includes('planinarenje'));
  assert.ok(got.includes('ranjen'), 'ra-nj-e-n uses the nj tile');
  // with n, j tiles instead of nj the digraph words are not spellable
  const plain = 'planinarenje'.split('');
  assert.ok(!spellable(DICT, plain).includes('planinarenje'));
  assert.ok(!spellable(DICT, plain).includes('ranjen'), 'n + j tiles do not spell nj');
  assert.ok(spellable(['konj', 'injekcija'], splitLetters('injekcija')).includes('injekcija'), 'in-jekcija is n + j');
  assert.ok(!spellable(['konj'], splitLetters('injekcija')).includes('konj'));
});

test('generator is deterministic and produces a valid puzzle', () => {
  const EXT = ['planinarenjem', 'planinarke', 'ninana', 'zzzzz'];
  const g1 = generateSlagalica(5, DICT, FREQ, { minWords: 3, extended: EXT });
  const g2 = generateSlagalica(5, DICT, FREQ, { minWords: 3, extended: EXT });
  assert.deepEqual(g1, g2);
  assert.equal(g1.letters.length, 12);
  assert.ok(g1.words.length >= 3);
  assert.ok(letterCount(g1.best) >= 9);
  for (const w of g1.words) assert.ok(canSpell(w, g1.letters), w);
  assert.ok(g1.words.includes(g1.best));
  assert.ok(g1.words.includes(g1.spine));
  assert.ok(DICT.map((w) => w.toUpperCase()).includes(g1.best), 'best comes from the core list');
  assert.ok(!g1.words.includes('ZZZZZ'));
  // no letter more than twice, rare letters at most once
  const counts = {};
  for (const l of g1.letters) counts[l] = (counts[l] || 0) + 1;
  assert.ok(Object.values(counts).every((n) => n <= 2));
  const p = { ...SAMPLE_PUZZLE, slagalica: { letters: g1.letters, words: g1.words, best: g1.best } };
  assert.deepEqual(validatePuzzle(p), []);
});

/** Evaluate a printed solution ("75 × (8 + 2) − 15 + 7") with plain JS arithmetic. */
const evalExpr = (text) => Function('return (' + text.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-') + ')')();

function checkMojBroj(m, label) {
  assert.equal(m.numbers.length, 6, label);
  for (const n of m.numbers.slice(0, 4)) assert.ok(n >= 1 && n <= 9, label + ' small number ' + n);
  assert.ok(MID.includes(m.numbers[4]), label);
  assert.ok(BIG.includes(m.numbers[5]), label);
  assert.ok(m.target >= 100 && m.target <= 999, label);
  assert.equal(evalExpr(m.solution), m.target, label + ' solution must reach the target');
  const used = m.solution.match(/\d+/g).map(Number);
  assert.ok(used.length >= 3, label + ' uses at least three numbers');
  const pool = [...m.numbers];
  for (const n of used) { const i = pool.indexOf(n); assert.ok(i >= 0, label + ' uses ' + n + ' more than offered'); pool.splice(i, 1); }
  assert.equal(solve(m.numbers, m.target).diff, 0, label + ' solver confirms reachability');
}

test('moj broj generator is deterministic and always reachable', () => {
  assert.deepEqual(generateMojBroj(7), generateMojBroj(7));
  assert.notDeepEqual(generateMojBroj(7), generateMojBroj(8));
  for (let d = 0; d < 20; d++) checkMojBroj(generateMojBroj(d), 'day ' + d);
});

test('skočko generator is deterministic and uses the symbol range', () => {
  assert.deepEqual(generateSkocko(3), generateSkocko(3));
  const seen = new Set();
  for (let d = 0; d < 200; d++) {
    const { secret } = generateSkocko(d);
    assert.equal(secret.length, 4);
    for (const x of secret) { assert.ok(Number.isInteger(x) && x >= 0 && x < SYMBOLS.length); seen.add(x); }
  }
  assert.equal(seen.size, SYMBOLS.length, 'every symbol appears over many days');
});

test('ko zna zna bank is valid and the dealer mixes difficulty without repeats', () => {
  const bank = loadBank();
  assert.deepEqual(validateBank(bank), []);
  assert.equal(bank.length, 10);
  const horizon = repeatHorizon(bank);
  assert.ok(horizon >= 60, 'repeat horizon is at least 60 days, got ' + horizon);
  assert.deepEqual(generateKoZnaZna(4, bank), generateKoZnaZna(4, bank));
  const dealer = makeDealer(bank);
  const seen = new Set();
  const answerPos = [0, 0, 0];
  const diffCount = { 1: 0, 2: 0, 3: 0 };
  const days = Math.min(horizon, 120);
  for (let d = 0; d < days; d++) {
    const qs = dealer.deal(d);
    assert.equal(qs.length, 10);
    assert.equal(qs[0].cat, 'jezik'); assert.equal(qs[9].cat, 'sport');
    for (const q of qs) {
      assert.equal(q.o.length, 3);
      assert.ok(q.a >= 0 && q.a <= 2);
      assert.ok(!seen.has(q.q), 'repeated before horizon: ' + q.q);
      seen.add(q.q);
      answerPos[q.a]++;
      diffCount[q.d]++;
    }
  }
  const total = answerPos.reduce((a, b) => a + b, 0);
  for (const n of answerPos) assert.ok(n > total * 0.25, 'answers are spread over A/B/C: ' + answerPos);
  assert.ok(diffCount[3] + diffCount[2] > diffCount[1] * 2, 'most questions are medium or hard: ' + JSON.stringify(diffCount));
  // the shuffled options still contain the original correct answer
  const q0 = generateKoZnaZna(0, bank)[2];
  const src = bank[2].questions.find((s) => s.q === q0.q);
  assert.equal(q0.o[q0.a], src.o[src.a]);
  // every generated (Wikidata) question is auditable
  for (const c of bank) for (const q of c.questions) if (!q.hand) assert.match(q.src, /^Q\d+$/, c.file);
});

/** Strip diacritics the way a player typing on a plain keyboard would (Đ → DJ, Č → C…). */
const plain = (s) => s.replace(/Đ/g, 'DJ').replace(/đ/g, 'dj').replace(/[ČĆ]/g, 'C').replace(/[čć]/g, 'c').replace(/Š/g, 'S').replace(/š/g, 's').replace(/Ž/g, 'Z').replace(/ž/g, 'z');

/** Every column solution, every acc form and the final must be matched by the engine, with and without diacritics. */
function checkAsocijacije(a, label) {
  assert.equal(a.cols.length, 4, label);
  assert.deepEqual(a.cols.map((c) => c.L), ['A', 'B', 'C', 'D'], label + ' letters');
  const none = [0, 0, 0, 0];
  a.cols.forEach((c, i) => {
    assert.equal(c.f.length, 4, label);
    for (const g of [c.s, plain(c.s), c.s.toLowerCase(), ...(c.acc || []), ...(c.acc || []).map(plain)]) {
      assert.deepEqual(matchGuess(a, g, none), { kind: 'column', col: i }, `${label} column ${c.L} guess "${g}"`);
    }
    for (const f of c.f) assert.equal(matchGuess(a, f, none).kind, 'miss', `${label} clue "${f}" must not be an answer`);
  });
  for (const g of [a.final.s, plain(a.final.s), a.final.s.toLowerCase(), ...(a.final.acc || []), ...(a.final.acc || []).map(plain)]) {
    assert.deepEqual(matchGuess(a, g, none), { kind: 'final' }, `${label} final guess "${g}"`);
  }
}

test('asocijacije bank is valid and the validator catches broken puzzles', () => {
  const bank = loadAsocBank();
  assert.deepEqual(validateAsocBank(bank), []);
  assert.ok(bank.length >= 150, 'bank has at least 150 puzzles, got ' + bank.length);
  for (const p of bank) {
    for (const c of p.cols) { assert.ok(c.s.length <= MAX_SOLUTION_LENGTH); for (const f of c.f) assert.ok(f.length <= MAX_CLUE_LENGTH, f); }
  }
  // finals are unique and never leak into clues; column solutions never leak into their own clues
  assert.equal(new Set(bank.map((p) => normalize(p.final.s))).size, bank.length);
  const good = bank[0];
  const clone = () => JSON.parse(JSON.stringify(good));
  const broken = [];
  let b = clone(); b.cols[0].f[0] = b.cols[0].s; broken.push([b, /contains the column solution/]);
  b = clone(); b.cols[1].f[2] = 'x ' + b.final.s; broken.push([b, /contains the final solution/]);
  b = clone(); b.cols[2].f[3] = b.cols[2].f[0]; broken.push([b, /duplicate of/]);
  b = clone(); b.cols[3].s = 'preduga-rec-koja-ne-staje'; broken.push([b, /longer than|upper-case/]);
  b = clone(); b.cols[0].f[1] = 'malo'; broken.push([b, /must be upper-case/]);
  b = clone(); b.final.acc = [b.final.s.toLowerCase()]; broken.push([b, /same as the solution/]);
  b = clone(); b.cols.pop(); broken.push([b, /exactly 4 columns/]);
  b = clone(); b.cols[0].f.push('VIŠAK'); broken.push([b, /exactly 4 clues/]);
  b = clone(); b.cols[1].f[0] = b.cols[0].s; broken.push([b, /equals column A's solution/]);
  for (const [bad, re] of broken) {
    const errs = validateAsocBank([bad]);
    assert.ok(errs.some((e) => re.test(e)), 'expected ' + re + ', got ' + JSON.stringify(errs));
    assert.match(errs[0], /^\S+\[0\] "[^"]+": /, 'error names the puzzle');
  }
  // duplicate finals and over-reused column solutions across the bank
  assert.ok(validateAsocBank([good, clone()]).some((e) => /duplicate final solution|duplicate puzzle/.test(e)));
  const reuse = [0, 1, 2].map((i) => { const c = clone(); c.final.s = 'FINAL' + 'ABC'[i]; c.cols[1].f[0] = 'DRUGI' + i; c.cols[0].s = 'ISTO'; return c; });
  assert.ok(validateAsocBank(reuse).some((e) => /"ISTO" used 3 times/.test(e)));
});

test('asocijacije dealer is deterministic and has no repeats before the horizon', () => {
  const bank = loadAsocBank();
  const horizon = asocHorizon(bank);
  assert.equal(horizon, bank.length);
  assert.ok(horizon >= 150, 'repeat horizon is at least 150 days, got ' + horizon);
  assert.deepEqual(generateAsocijacije(9, bank), generateAsocijacije(9, bank));
  assert.notDeepEqual(generateAsocijacije(9, bank), generateAsocijacije(10, bank));
  const dealer = makeAsocDealer(bank);
  const seen = new Set();
  for (let d = 0; d < horizon; d++) {
    const a = dealer.deal(d);
    assert.ok(!seen.has(a.final.s), 'repeated before horizon: ' + a.final.s);
    seen.add(a.final.s);
    checkAsocijacije(a, 'day ' + d);
  }
  assert.equal(seen.size, horizon, 'every puzzle is dealt once per cycle');
  assert.deepEqual(dealer.deal(horizon), dealer.deal(0), 'cycles after the horizon');
  const p = { ...SAMPLE_PUZZLE, asocijacije: generateAsocijacije(3, bank) };
  assert.deepEqual(validatePuzzle(p), []);
});

test('generated day files on disk are valid and consistent', () => {
  const dir = new URL('../src/puzzles/days/', import.meta.url);
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  for (const f of files) {
    const d = JSON.parse(fs.readFileSync(new URL(f, dir), 'utf8'));
    assert.equal(String(d.day).padStart(3, '0') + '.json', f);
    const p = mergeWithSample(d, d.day);
    assert.deepEqual(validatePuzzle(p), [], f);
    const sl = p.slagalica;
    assert.ok(sl.words.includes(sl.best), f + ' best not in words');
    for (const w of sl.words) assert.ok(canSpell(w, sl.letters), f + ' ' + w);
    assert.ok(letterCount(sl.best) >= 9, f + ' best is too short');
    for (const l of sl.letters) assert.ok(/^(LJ|NJ|DŽ|[A-ZČĆŠŽĐ])$/.test(l), f + ' bad tile ' + l);
    assert.equal(sl.letters.length, 12, f);
    if (d.mojBroj) checkMojBroj(d.mojBroj, f);
    if (d.koZnaZna) {
      assert.equal(d.koZnaZna.length, 10, f);
      assert.equal(new Set(d.koZnaZna.map((q) => q.q)).size, 10, f + ' has a duplicate question');
    }
    if (d.asocijacije) checkAsocijacije(d.asocijacije, f);
  }
});
