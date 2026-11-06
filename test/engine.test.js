import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sl from '../src/engine/slagalica.js';
import * as mb from '../src/engine/mojbroj.js';
import * as sk from '../src/engine/skocko.js';
import * as kz from '../src/engine/kozna.js';
import * as as from '../src/engine/asocijacije.js';
import * as stats from '../src/engine/stats.js';
import { grade, totalOf, MAX_TOTAL, maxesOf, maxTotalOf, gameMax, percent } from '../src/engine/rules.js';
import { normalize } from '../src/engine/text.js';
import { makeStorage, memoryStore } from '../src/engine/storage.js';
import { dayNumber, LAUNCH, dateOfDay, dani } from '../src/engine/day.js';
import { SAMPLE_PUZZLE } from '../src/puzzles/sample.js';
import { validatePuzzle } from '../src/puzzles/schema.js';

const P = SAMPLE_PUZZLE;

test('sample puzzle validates', () => {
  assert.deepEqual(validatePuzzle(P), []);
  assert.ok(validatePuzzle({}).length > 0);
});

test('slagalica: spelling, dictionary and scoring', () => {
  const ok = sl.makeChecker(P.slagalica);
  assert.equal(ok('KRASTAVAC'), true);
  assert.equal(ok('KRAVA'), true);
  assert.equal(ok('AAAA'), false, 'only three A tiles');
  assert.equal(ok('XYZ'), false);
  assert.equal(ok('ZZZZ'), false);
  assert.equal(sl.scoreWord('KRASTAVAC', 'KRASTAVAC'), 14, '9 letters + 5 set-word bonus');
  assert.equal(sl.scoreWord('KRASTAVCE', 'KRASTAVAC'), 19, 'same length, different word: +10');
  assert.equal(sl.scoreWord('KRAVA', 'KRASTAVAC'), 5);
  assert.equal(sl.bonusFor('ABCDEFGHIJ', 'KRASTAVAC'), 15, 'longer than the set word');
  assert.equal(sl.bestWord(P.slagalica), 'KRASTAVAC');
  const r = sl.evaluate(P.slagalica, ['K', 'R', 'A', 'V', 'A'], ok);
  assert.deepEqual([r.ok, r.points, r.bonus, r.word], [true, 5, 0, 'KRAVA']);
  const rb = sl.evaluate(P.slagalica, 'KRASTAVAC'.split(''), ok);
  assert.deepEqual([rb.points, rb.bonus], [14, 5]);
  assert.equal(sl.evaluate(P.slagalica, [], ok).reason, 'empty');
  assert.equal(sl.evaluate(P.slagalica, ['S', 'A', 'K', 'Q'], ok).reason, 'unknown');
  // every listed word must be spellable with the tiles
  for (const w of P.slagalica.words) assert.ok(sl.canSpell(w, P.slagalica.letters), w);
  const dict = new Set(['SAKO']);
  assert.equal(sl.makeChecker({ letters: P.slagalica.letters, words: [] }, dict)('SAKO'), true);
});

test('moj broj: token grammar', () => {
  let t = [];
  const N = P.mojBroj.numbers; // [3,8,2,7,15,75]
  assert.equal(mb.push(t, { o: '+' }).ok, false, 'operator first');
  assert.equal(mb.push(t, { o: ')' }).ok, false);
  t = mb.push(t, { n: 5 }).tokens;
  assert.equal(mb.push(t, { n: 0 }).ok, false, 'number after number');
  assert.equal(mb.push(t, { o: '(' }).ok, false, 'bracket after value');
  t = mb.push(t, { o: '×' }).tokens;
  assert.equal(mb.push(t, { n: 5 }).ok, false, 'reuse number');
  t = mb.push(t, { o: '(' }).tokens;
  t = mb.push(t, { n: 1 }).tokens;
  t = mb.push(t, { o: '+' }).tokens;
  t = mb.push(t, { n: 2 }).tokens;
  assert.equal(mb.openBrackets(t), 1);
  assert.equal(mb.evaluate(t, N), 750, 'auto-closed bracket');
  t = mb.push(t, { o: ')' }).tokens;
  assert.equal(mb.push(t, { o: ')' }).ok, false, 'no open bracket');
  t = mb.push(t, { o: '−' }).tokens;
  t = mb.push(t, { n: 4 }).tokens;
  t = mb.push(t, { o: '+' }).tokens;
  t = mb.push(t, { n: 3 }).tokens;
  assert.equal(mb.evaluate(t, N), 742);
  assert.equal(mb.format(t, N), '75 × (8 + 2) − 15 + 7');
  assert.equal(mb.pointsFor(742, 742), 10);
});

test('moj broj: precedence, division, trailing operators and scoring', () => {
  const N = [3, 8, 2, 7, 15, 75];
  const tk = (...xs) => xs.map((x) => (typeof x === 'number' ? { n: x } : { o: x }));
  assert.equal(mb.evaluate(tk(0, '+', 1, '×', 2), N), 19, '3 + 8 × 2');
  assert.equal(mb.evaluate(tk(5, '÷', 4), N), 5);
  assert.equal(mb.evaluate(tk(1, '÷', 0), N), 8 / 3);
  assert.equal(mb.evaluate(tk(1, '÷', '(', 0, '−', 0), N), null, 'division by zero');
  assert.equal(mb.evaluate(tk(1, '+'), N), 8, 'trailing operator dropped');
  assert.equal(mb.evaluate(tk('(', '('), N), null, 'only brackets');
  assert.equal(mb.evaluate([], N), null);
  assert.equal(mb.pointsFor(742, 740), 0, 'only the exact number scores');
  assert.equal(mb.pointsFor(742, 740, 2), 10, 'closest reachable when the target is unreachable');
  assert.equal(mb.pointsFor(742, 739, 2), 0);
  assert.equal(mb.pointsFor(742, 700), 0);
  assert.equal(mb.pointsFor(742, 742.5), 0);
  assert.equal(mb.pointsFor(742, null), 0);
});

test('moj broj: solver finds an exact expression', () => {
  const r = mb.solve([3, 8, 2, 7, 15, 75], 742);
  assert.equal(r.diff, 0);
  assert.equal(r.value, 742);
  // the printed expression must evaluate back to the target
  const expr = r.text.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
  assert.equal(Function('return (' + expr + ')')(), 742);
  const near = mb.solve([1, 1, 1, 1, 1, 1], 999);
  assert.ok(near.diff > 0 && near.value != null);
});

test('skocko: feedback and points', () => {
  const S = [0, 4, 1, 3];
  assert.deepEqual(sk.feedback([0, 4, 1, 3], S), { exact: 4, near: 0 });
  assert.deepEqual(sk.feedback([3, 1, 4, 0], S), { exact: 0, near: 4 });
  assert.deepEqual(sk.feedback([0, 0, 0, 0], S), { exact: 1, near: 0 }, 'duplicates count once');
  assert.deepEqual(sk.feedback([4, 4, 1, 5], S), { exact: 2, near: 0 });
  assert.deepEqual(sk.feedback([4, 0, 5, 1], S), { exact: 0, near: 3 });
  assert.deepEqual(sk.feedback([2, 2, 5, 5], S), { exact: 0, near: 0 });
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(sk.pointsFor), [20, 20, 15, 15, 10, 10]);
});

test('ko zna zna: results and score', () => {
  const q = P.koZnaZna[0];
  assert.equal(kz.resultFor(q, 1), 1);
  assert.equal(kz.resultFor(q, 0), -1);
  assert.equal(kz.resultFor(q, -1), 0);
  assert.equal(kz.resultFor(q, null), 0);
  assert.equal(kz.scoreOf([1, 1, -1, 0, 1]), 25);
  assert.equal(kz.scoreOf([-1, -1, -1, -1, -1]), -25);
});

test('asocijacije: matching and worth', () => {
  const A = P.asocijacije;
  const none = [0, 0, 0, 0];
  assert.deepEqual(as.matchGuess(A, 'noć', none), { kind: 'column', col: 0 });
  assert.deepEqual(as.matchGuess(A, ' NOC ', none), { kind: 'column', col: 0 });
  assert.deepEqual(as.matchGuess(A, 'filmovi', none), { kind: 'column', col: 1 });
  assert.deepEqual(as.matchGuess(A, 'sreca', none), { kind: 'column', col: 3 });
  assert.deepEqual(as.matchGuess(A, 'zvezde', none), { kind: 'final' });
  assert.deepEqual(as.matchGuess(A, 'sunce', none), { kind: 'miss' });
  assert.deepEqual(as.matchGuess(A, '', none), { kind: 'empty' });
  assert.deepEqual(as.matchGuess(A, 'noć', [1, 0, 0, 0]), { kind: 'miss' }, 'solved column is not re-matched');
  const open = [[1, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]];
  assert.equal(as.columnValue(open[0]), 6);
  assert.equal(as.columnValue(open[1]), 3);
  assert.equal(as.finalWorth(open, [0, 0, 0, 0]), 7 + 6 + 3 + 7 + 7);
  assert.equal(as.finalWorth(open, [1, 1, 0, 0]), 7 + 7 + 7);
  assert.equal(as.finalWorth(open.map((r) => r.map(() => 1)), [0, 0, 0, 0]), 7 + 4 * 3);
  assert.equal(as.finalWorth([[1, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], [0, 0, 0, 0]), 34, 'TV maximum: final after one field');
});

test('normalize', () => {
  assert.equal(normalize('Đorđe Čavić-Šić ž'), 'DJORDJE CAVICSIC Z');
  assert.equal(normalize('  more   mora '), 'MORE MORA');
});

test('grades and totals', () => {
  assert.equal(grade(0, 18, 18), 0);
  assert.equal(grade(0, 13), 1, 'fixed ceiling is 17');
  assert.equal(grade(0, 10, 18), 1);
  assert.equal(grade(0, 4, 18), 2);
  assert.equal(grade(0, 2, 18), 3);
  assert.equal(grade(3, -25), 3);
  assert.equal(grade(0, null), null);
  assert.equal(totalOf([14, 7, null, -5, 13]), 29);
  assert.equal(MAX_TOTAL, 181);
  assert.equal(maxTotalOf(P), 14 + 10 + 20 + 100 + 34);
  assert.deepEqual(maxesOf(P), [14, 10, 20, 100, 34]);
  assert.equal(gameMax(0, { slagalica: { letters: [], words: ['ABC', 'ABCDEFGHIJKL'] } }), 17);
  assert.equal(percent(19, 14), 100, 'above-max scores cap at 100%');
  assert.equal(percent(7, 14), 50);
});

test('stats: streaks, histogram, per-game averages', () => {
  const h = {
    10: { scores: [17, 10, 20, 50, 25], total: 122 },
    11: { scores: [10, 0, 0, 0, 0], total: 10 },
    13: { scores: [8, 7, 15, 35, 13], total: 78 },
    14: { scores: [8, 7, 15, 35, 13], total: 78 },
  };
  assert.equal(stats.currentStreak(h, 14), 2);
  assert.equal(stats.currentStreak(h, 15), 2, 'today not played yet keeps yesterday streak');
  assert.equal(stats.currentStreak(h, 16), 0);
  assert.equal(stats.bestStreak(h), 2);
  const s = stats.summarize(h, 14);
  assert.equal(s.played, 4);
  assert.deepEqual(s.hist, [1, 0, 2, 0, 1]);
  assert.equal(s.perGame[0], Math.round((17 + 10 + 8 + 8) / 4 / 17 * 100), 'entries without maxes use the fixed ceiling');
  const h2 = { 1: { scores: [18, 0, 0, 0, 0], total: 18, maxes: [18, 10, 20, 100, 25] } };
  assert.equal(stats.summarize(h2, 1).perGame[0], 100);
  assert.deepEqual(stats.gradesOf(h2[1])[0], 0);
  assert.equal(stats.recentDays(h, 14, 3).length, 3);
  assert.equal(stats.recentDays(h, 14, 3)[0].day, 12);
  assert.equal(stats.recentDays(h, 14, 3)[0].grades[0], null);
  const txt = stats.shareText(58, [14, 7, 15, 35, 13], 84, 7, 'https://x.y', [18, 10, 20, 100, 26]);
  assert.ok(stats.shareText(1, [20, 10, 20, 100, 25], 175, 1, 'u', [20, 10, 20, 100, 25]).includes('🟩🟩🟩🟩🟩'));
  assert.ok(txt.startsWith('Dnevna Slagalica #058'));
  assert.ok(txt.includes('🟨🟨🟨🟧🟨'), 'Ko zna zna 35/100 is the orange tier');
  assert.ok(txt.includes('7 dana'));
});

test('storage round trip', () => {
  const st = makeStorage(memoryStore());
  assert.equal(st.loadProgress(5), null);
  st.saveProgress({ day: 5, scores: [1, null, null, null, null] });
  assert.equal(st.loadProgress(5).scores[0], 1);
  assert.equal(st.loadProgress(6), null, 'different day');
  st.recordDay(5, [1, 2, 3, 4, 5], 15);
  assert.equal(st.loadHistory()[5].total, 15);
  st.clearAll();
  assert.deepEqual(st.loadHistory(), {});
});

test('day numbering', () => {
  assert.equal(dayNumber(LAUNCH), 1, 'launch day is challenge #1');
  assert.equal(dayNumber(dateOfDay(40)), 40);
  const before = new Date(LAUNCH); before.setDate(before.getDate() - 10);
  assert.equal(dayNumber(before), 1, 'before launch the app shows challenge #1');
  assert.equal(dateOfDay(1).getTime(), LAUNCH.getTime());
  assert.equal(dani(1), 'dan');
  assert.equal(dani(11), 'dana');
  assert.equal(dani(21), 'dan');
  assert.equal(dani(5), 'dana');
});
