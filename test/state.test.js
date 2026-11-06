import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reducer, initialState, progressOf } from '../src/state.js';
import { SAMPLE_PUZZLE } from '../src/puzzles/sample.js';

const boot = () => reducer(initialState(), { type: 'INIT', day: 5, puzzle: SAMPLE_PUZZLE, progress: null, history: {} });
const run = (s, ...actions) => actions.reduce((st, a) => reducer(st, typeof a === 'string' ? { type: a } : a), s);
const commitPending = (s) => reducer(s, { type: 'COMMIT', seq: s.pending.seq });
const fireLater = (s) => reducer(s, { type: 'LATER_FIRE', seq: s.later.seq });
const L = SAMPLE_PUZZLE.slagalica.letters;
const idx = (word) => { const used = []; return word.split('').map((ch) => { const i = L.findIndex((l, x) => l === ch && !used.includes(x)); used.push(i); return i; }); };

test('full day: five games, reveal, results', () => {
  let s = boot();
  assert.equal(s.screen, 'home');
  s = run(s, 'PRIMARY');
  assert.equal(s.screen, 'game'); assert.equal(s.gi, 0); assert.equal(s.t, 60);

  // Slagalica: KRAVA = 5 (1 per letter, no bonus)
  for (const i of idx('KRAVA')) s = run(s, { type: 'SL_ADD', i });
  assert.equal(s.game.sl.pick.length, 5);
  s = run(s, 'SL_SUBMIT');
  assert.ok(s.locked && s.pending && s.pending.pts === 5);
  s = commitPending(s);
  assert.equal(s.screen, 'between'); assert.equal(s.scores[0], 5);

  // Moj broj: 75 × (8 + 2) − 15 + 7 = 742
  s = run(s, 'NEXT'); assert.equal(s.gi, 1);
  const tk = [{ n: 5 }, { o: '×' }, { o: '(' }, { n: 1 }, { o: '+' }, { n: 2 }, { o: ')' }, { o: '−' }, { n: 4 }, { o: '+' }, { n: 3 }];
  for (const tok of tk) s = run(s, { type: 'MB_PUSH', tok });
  s = run(s, 'MB_SUBMIT'); assert.equal(s.pending.pts, 10); s = commitPending(s);
  assert.equal(s.reveals[1].val, 742);

  // Skočko: wrong twice then right on the 3rd
  s = run(s, 'NEXT'); assert.equal(s.gi, 2);
  for (const i of [1, 1, 1, 1]) s = run(s, { type: 'SK_ADD', i });
  s = run(s, 'SK_SUBMIT'); assert.equal(s.game.sk.rows.length, 1); assert.equal(s.game.sk.rows[0].ex, 1);
  s = run(s, 'SK_SUBMIT'); assert.equal(s.game.sk.shake, 1, 'needs four symbols');
  for (const i of [0, 4, 1, 3]) s = run(s, { type: 'SK_ADD', i });
  s = run(s, 'SK_SUBMIT'); assert.equal(s.pending.pts, 20); s = commitPending(s);

  // Ko zna zna (10 questions): right, wrong, skip, timeout, right, then 5 right = 10 - 5 + 0 + 0 + 10 + 50 = 65
  s = run(s, 'NEXT'); assert.equal(s.gi, 3); assert.equal(s.t, 10);
  s = run(s, { type: 'KZ_ANSWER', i: 1 }); assert.ok(s.later); s = fireLater(s); assert.equal(s.game.kz.q, 1);
  s = run(s, { type: 'KZ_ANSWER', i: 0 }); s = fireLater(s);
  s = run(s, { type: 'KZ_ANSWER', i: -1 }); s = fireLater(s);
  s = run(s, { type: 'TICK', dt: 11 }); assert.equal(s.game.kz.pick, -1); assert.equal(s.game.kz.to, true); s = fireLater(s);
  assert.equal(s.game.kz.q, 4);
  s = run(s, { type: 'KZ_ANSWER', i: 0 }); s = fireLater(s);
  for (let q = 5; q < 10; q++) { assert.equal(s.game.kz.q, q); s = run(s, { type: 'KZ_ANSWER', i: SAMPLE_PUZZLE.koZnaZna[q].a }); s = fireLater(s); }
  assert.equal(s.pending.pts, 65); s = commitPending(s);

  // Asocijacije: open A1, solve column A (worth 3+3=6), open B1,B2, then final
  s = run(s, 'NEXT'); assert.equal(s.gi, 4); assert.equal(s.t, 120);
  s = run(s, { type: 'A_EDIT', kind: 'col', c: 0 });
  assert.equal(s.game.a.shake, 1, 'must open a field first'); assert.equal(s.game.a.target, null);
  s = run(s, { type: 'A_OPEN', c: 0, k: 0 }, { type: 'A_EDIT', kind: 'col', c: 0 }, { type: 'A_INPUT', value: 'noć' }, 'A_GUESS');
  assert.equal(s.game.a.sol[0], 1); assert.equal(s.game.a.earn, 6);
  s = run(s, { type: 'A_OPEN', c: 1, k: 0 }, { type: 'A_OPEN', c: 1, k: 1 });
  s = run(s, { type: 'A_EDIT', kind: 'final' }, { type: 'A_INPUT', value: 'zvezda' }, 'A_GUESS');
  // final = 7 + B(3+2) + C(7) + D(7) = 26, plus 6 earned = 32
  assert.equal(s.pending.pts, 32); s = commitPending(s);

  s = run(s, 'NEXT');
  assert.equal(s.screen, 'results'); assert.equal(s.done, true);
  assert.deepEqual(s.scores, [5, 10, 20, 65, 32]);
  assert.equal(progressOf(s).inGame, null);
});

test('timeouts: slagalica empty, moj broj incomplete, skocko, asocijacije', () => {
  let s = run(boot(), 'PRIMARY', { type: 'TICK', dt: 61 });
  assert.equal(s.pending.pts, 0); assert.equal(s.pending.reveal.timeout, true);
  s = commitPending(s);
  s = run(s, 'NEXT', { type: 'MB_PUSH', tok: { n: 0 } }, { type: 'MB_PUSH', tok: { o: '+' } }, { type: 'TICK', dt: 60 });
  assert.equal(s.pending.pts, 0); assert.equal(s.pending.reveal.val, 3, 'trailing operator dropped'); s = commitPending(s);
  s = run(s, 'NEXT', { type: 'TICK', dt: 60 });
  assert.equal(s.pending.reveal.won, false); s = commitPending(s);
  s = run(s, 'NEXT'); for (let i = 0; i < 10; i++) { s = run(s, { type: 'TICK', dt: 10 }); s = fireLater(s); }
  assert.equal(s.pending.pts, 0); s = commitPending(s);
  s = run(s, 'NEXT', { type: 'A_OPEN', c: 2, k: 3 }, { type: 'A_EDIT', kind: 'col', c: 2 }, { type: 'A_INPUT', value: 'more' }, 'A_GUESS', { type: 'TICK', dt: 120 });
  assert.equal(s.pending.pts, 6, 'keeps column points on timeout'); assert.equal(s.pending.reveal.fin, 2);
});

/** Time out the first four games to land in Asocijacije. */
function toAsocijacije() {
  let s = run(boot(), 'PRIMARY', { type: 'TICK', dt: 61 }); s = commitPending(s);
  s = run(s, 'NEXT', { type: 'TICK', dt: 60 }); s = commitPending(s);
  s = run(s, 'NEXT', { type: 'TICK', dt: 60 }); s = commitPending(s);
  s = run(s, 'NEXT'); for (let i = 0; i < 10; i++) { s = run(s, { type: 'TICK', dt: 10 }); s = fireLater(s); }
  s = commitPending(s);
  s = run(s, 'NEXT'); assert.equal(s.gi, 4);
  return s;
}

test('asocijacije: only the typed field is checked, a miss locks until a new field opens', () => {
  let s = toAsocijacije();
  s = run(s, { type: 'A_OPEN', c: 0, k: 0 });
  // the final answer typed into column A is a miss, and it costs the turn
  s = run(s, { type: 'A_EDIT', kind: 'col', c: 0 });
  assert.deepEqual(s.game.a.target, { kind: 'col', c: 0 });
  s = run(s, { type: 'A_INPUT', value: 'zvezda' }, 'A_GUESS');
  assert.equal(s.game.a.fin, 0); assert.equal(s.game.a.sol[0], 0);
  assert.equal(s.game.a.tried, true); assert.equal(s.game.a.target, null); assert.equal(s.game.a.input, '');
  // locked: no new attempt until another field opens
  s = run(s, { type: 'A_EDIT', kind: 'col', c: 0 });
  assert.equal(s.game.a.target, null); assert.match(s.game.a.msg, /novo polje/);
  s = run(s, { type: 'A_EDIT', kind: 'final' });
  assert.equal(s.game.a.target, null);
  s = run(s, { type: 'A_OPEN', c: 0, k: 1 });
  assert.equal(s.game.a.tried, false);
  // column A solved: 3 + 2 unopened = 5; a correct answer keeps the turn
  s = run(s, { type: 'A_EDIT', kind: 'col', c: 0 }, { type: 'A_INPUT', value: 'noć' }, 'A_GUESS');
  assert.equal(s.game.a.sol[0], 1); assert.equal(s.game.a.earn, 5); assert.equal(s.game.a.tried, false);
  assert.equal(s.game.a.target, null);
  // a column answer typed into the final is a miss
  s = run(s, { type: 'A_EDIT', kind: 'final' }, { type: 'A_INPUT', value: 'film' }, 'A_GUESS');
  assert.equal(s.game.a.fin, 0); assert.equal(s.game.a.sol[1], 0); assert.equal(s.game.a.tried, true);
  // Escape cancels an edit without using the attempt
  s = run(s, { type: 'A_OPEN', c: 1, k: 0 }, { type: 'A_EDIT', kind: 'final' }, { type: 'A_INPUT', value: 'x' }, 'A_CANCEL');
  assert.equal(s.game.a.target, null); assert.equal(s.game.a.tried, false);
  // once every field is open, attempts are no longer rationed
  for (let c = 1; c < 4; c++) for (let k = 0; k < 4; k++) s = run(s, { type: 'A_OPEN', c, k });
  s = run(s, { type: 'A_EDIT', kind: 'final' }, { type: 'A_INPUT', value: 'pogrešno' }, 'A_GUESS');
  assert.equal(s.game.a.tried, true); assert.match(s.game.a.msg, /pokušaj ponovo/);
  s = run(s, { type: 'A_EDIT', kind: 'final' });
  assert.deepEqual(s.game.a.target, { kind: 'final' }, 'all fields open: may try again');
  s = run(s, { type: 'A_INPUT', value: 'zvezda' }, 'A_GUESS');
  // final = 7 + B(3) + C(3) + D(3) = 16, plus 5 earned = 21
  assert.equal(s.pending.pts, 21);
});

test('pause and resume through home, persisted snapshot restores paused', () => {
  let s = run(boot(), 'PRIMARY', { type: 'SL_ADD', i: 2 }, { type: 'TICK', dt: 20 }, 'HOME');
  assert.equal(s.screen, 'home'); assert.equal(s.paused, true); assert.equal(s.running, false);
  const p = progressOf(s);
  assert.equal(p.inGame.gi, 0); assert.equal(p.inGame.t, 40);
  let r = reducer(initialState(), { type: 'INIT', day: 5, puzzle: SAMPLE_PUZZLE, progress: p, history: {} });
  assert.equal(r.paused, true); assert.equal(r.game.sl.pick[0], 2);
  r = run(r, 'PRIMARY');
  assert.equal(r.screen, 'game'); assert.equal(r.running, true); assert.equal(r.t, 40);
  // stale progress from another day is ignored by storage, but a finished day restores as done
  const d = reducer(initialState(), { type: 'INIT', day: 5, puzzle: SAMPLE_PUZZLE, progress: { day: 5, scores: [1, 1, 1, 1, 1], reveals: [], done: true }, history: {} });
  assert.equal(run(d, 'PRIMARY').screen, 'results');
});

test('practice mode does not touch the real day', () => {
  let s = run(boot(), 'PRIMARY', { type: 'SL_ADD', i: 0 }, { type: 'SL_ADD', i: 1 }, { type: 'SL_ADD', i: 8 }, 'SL_SUBMIT'); // SAT
  s = commitPending(s);
  s = run(s, 'HOME', { type: 'PRACTICE', day: 3 });
  assert.equal(s.practice, true); assert.equal(s.scores[0], null);
  s = run(s, 'HOME');
  assert.equal(s.practice, false); assert.equal(s.scores[0], 3);
});

test('stale COMMIT and LATER events are ignored', () => {
  let s = run(boot(), 'PRIMARY', { type: 'SL_ADD', i: 0 }, { type: 'SL_ADD', i: 1 }, { type: 'SL_ADD', i: 8 }, 'SL_SUBMIT');
  const stale = reducer(s, { type: 'COMMIT', seq: -1 });
  assert.equal(stale.screen, 'game');
  assert.equal(reducer(s, { type: 'LATER_FIRE', seq: 99 }), s);
});

test('keyboard typing picks the first unused matching tile', () => {
  let s = run(boot(), 'PRIMARY', { type: 'SL_TYPE', letter: 'A' }, { type: 'SL_TYPE', letter: 'A' }, { type: 'SL_TYPE', letter: 'Q' });
  assert.deepEqual(s.game.sl.pick, [1, 7]);
});
