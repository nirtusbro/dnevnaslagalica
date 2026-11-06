// The whole game flow as a pure reducer. Side effects (timers, delays, storage,
// share) live in App.jsx and only dispatch actions defined here.
import { GAMES } from './engine/rules.js';
import * as sl from './engine/slagalica.js';
import * as mb from './engine/mojbroj.js';
import * as sk from './engine/skocko.js';
import * as kz from './engine/kozna.js';
import * as as from './engine/asocijacije.js';
import { I2, O, R, Y } from './theme.js';

export const SCREENS = ['home', 'game', 'between', 'results', 'stats', 'archive', 'how'];

export function freshGame() {
  return {
    sl: { pick: [], msg: '', msgC: I2, shake: 0 },
    mb: { tok: [], msg: '', msgC: O, shake: 0 },
    sk: { rows: [], cur: [], done: false, shake: 0, msg: '', msgC: I2 },
    kz: { q: 0, pick: null, res: [], score: 0, to: false },
    // target: the field being typed into ({kind:'col', c} | {kind:'final'} | null); tried: a guess was
    // made since the last field was opened, so no more guessing until another field opens.
    a: { open: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], sol: [0, 0, 0, 0], fin: 0, earn: 0, act: 0, target: null, tried: false, input: '', msg: '', msgC: I2, shake: 0, newKey: '' },
  };
}

export function initialState() {
  return {
    ready: false,
    day: 0, puzzle: null, history: {},
    screen: 'home', prev: 'home',
    practice: false,
    gi: 0, scores: Array(5).fill(null), reveals: Array(5).fill(null), done: false,
    paused: false, locked: false,
    t: 1, tMax: 1, running: false,
    game: freshGame(),
    pending: null,   // {pts, reveal, delay, seq}: result waiting to be committed
    later: null,     // {action, delay, seq}: a delayed dispatch
    toast: null,
    seq: 0,
  };
}

const next = (s) => s.seq + 1;

function startGame(s, gi) {
  const G = GAMES[gi];
  return { ...s, screen: 'game', gi, paused: false, locked: false, game: freshGame(), t: G.time, tMax: G.time, running: true, pending: null, later: null };
}

/** Lock the board and queue the result; COMMIT moves to the reveal screen. */
function finish(s, pts, reveal, delay = 700) {
  return { ...s, locked: true, running: false, pending: { pts, reveal, delay, seq: next(s) }, seq: next(s) };
}

function commit(s) {
  if (!s.pending) return s;
  const scores = [...s.scores]; scores[s.gi] = s.pending.pts;
  const reveals = [...s.reveals]; reveals[s.gi] = s.pending.reveal;
  return { ...s, scores, reveals, screen: 'between', locked: false, pending: null };
}

function timeUp(s) {
  if (s.locked) return s;
  const g = s.game;
  switch (s.gi) {
    case 0: return slSubmit({ ...s, running: false }, true);
    case 1: return mbSubmit({ ...s, running: false }, true);
    case 2: {
      const last = (g.sk.rows[g.sk.rows.length - 1] || {}).g || [];
      const sk2 = { ...g.sk, done: true, msg: 'Vreme je isteklo', msgC: R };
      return finish({ ...s, running: false, game: { ...g, sk: sk2 } }, 0, { won: false, last }, 1600);
    }
    case 3: return kzAnswer({ ...s, running: false }, -1, true);
    case 4: return aGiveUp({ ...s, running: false }, true);
    default: return s;
  }
}

// ---------- Slagalica ----------
function slSubmit(s, timeout = false) {
  if (s.locked && !timeout) return s;
  const P = s.puzzle.slagalica;
  const isValid = sl.makeChecker(P, s.dictionary || null);
  const picked = s.game.sl.pick.map((i) => P.letters[i]);
  const r = sl.evaluate(P, picked, isValid, timeout);
  const g = s.game;
  if (r.reason === 'empty') {
    if (timeout) return finish(s, 0, { word: '', ok: false, timeout: true }, 500);
    return s;
  }
  if (!r.ok) {
    const sl2 = { ...g.sl, msg: 'Te reči nema u rečniku', msgC: R, shake: timeout ? g.sl.shake : g.sl.shake + 1 };
    const s2 = { ...s, game: { ...g, sl: sl2 } };
    return timeout ? finish(s2, 0, { word: r.word, ok: false, timeout: true }, 900) : s2;
  }
  const sl2 = { ...g.sl, msg: 'Tačno! ' + sl.letterCount(r.word) + ' slova' + (r.bonus ? ' + bonus ' + r.bonus : '') + ' · +' + r.points, msgC: Y };
  return finish({ ...s, game: { ...g, sl: sl2 } }, r.points, { word: r.word, ok: true, bonus: r.bonus, timeout }, 900);
}

// ---------- Moj broj ----------
const bestDiffCache = new Map();
/** Distance of the closest reachable value to the target (0 when the target is reachable). */
export function mbBestDiff(P) {
  if (P.solution) return 0;
  if (Number.isInteger(P.bestDiff)) return P.bestDiff;
  const key = P.numbers.join(',') + '>' + P.target;
  if (!bestDiffCache.has(key)) bestDiffCache.set(key, mb.solve(P.numbers, P.target).diff);
  return bestDiffCache.get(key);
}

function mbSubmit(s, timeout = false) {
  if (s.locked && !timeout) return s;
  const P = s.puzzle.mojBroj;
  const g = s.game;
  const v = mb.evaluate(g.mb.tok, P.numbers);
  const txt = g.mb.tok.length ? mb.format(g.mb.tok, P.numbers) : '';
  const bad = (msg) => ({ ...s, game: { ...g, mb: { ...g.mb, shake: g.mb.shake + 1, msg, msgC: O } } });
  const fin = (st, pts, val) => finish(st, pts, { expr: txt, val, timeout }, 800);
  if (v == null) return timeout ? fin(s, 0, null) : bad('Izraz nije potpun');
  if (!Number.isInteger(v)) return timeout ? fin(s, 0, null) : bad('Rezultat mora biti ceo broj');
  const d = Math.abs(P.target - v);
  const pts = mb.pointsFor(P.target, v, mbBestDiff(P));
  const mb2 = { ...g.mb, msg: d === 0 ? 'Tačno!' : pts ? 'Najbliže moguće!' : 'Razlika ' + d, msgC: pts ? Y : I2 };
  return fin({ ...s, game: { ...g, mb: mb2 }, running: false }, pts, v);
}

// ---------- Skočko ----------
function skSubmit(s) {
  const g = s.game;
  if (s.locked || g.sk.done) return s;
  if (g.sk.cur.length < 4) return { ...s, game: { ...g, sk: { ...g.sk, shake: g.sk.shake + 1, msg: 'Izaberi četiri znaka', msgC: O } } };
  const guess = g.sk.cur;
  const { exact, near } = sk.feedback(guess, s.puzzle.skocko.secret);
  const rows = [...g.sk.rows, { g: guess, ex: exact, near }];
  if (exact === 4) {
    const n = rows.length; const pts = sk.pointsFor(n);
    return finish({ ...s, game: { ...g, sk: { ...g.sk, rows, cur: [], done: true, msg: 'Pogođeno! +' + pts, msgC: Y } } }, pts, { won: true, n, last: guess }, 1500);
  }
  if (rows.length >= sk.MAX_ATTEMPTS) {
    return finish({ ...s, game: { ...g, sk: { ...g.sk, rows, cur: [], done: true, msg: 'Nema više pokušaja', msgC: R } } }, 0, { won: false, last: guess }, 1700);
  }
  return { ...s, game: { ...g, sk: { ...g.sk, rows, cur: [], msg: '' } } };
}

// ---------- Ko zna zna ----------
function kzAnswer(s, i, timeout = false) {
  const g = s.game;
  if (s.locked || g.kz.pick != null) return s;
  const Q = s.puzzle.koZnaZna[g.kz.q];
  const r = kz.resultFor(Q, i);
  const res = [...g.kz.res, r];
  const kz2 = { ...g.kz, pick: i, to: timeout, res, score: kz.scoreOf(res) };
  return { ...s, game: { ...g, kz: kz2 }, running: false, later: { action: { type: 'KZ_NEXT' }, delay: 1400, seq: next(s) }, seq: next(s) };
}

function kzNext(s) {
  const g = s.game;
  if (s.screen !== 'game' || s.gi !== 3) return s;
  if (g.kz.q >= kz.QUESTIONS - 1) return finish(s, g.kz.score, { res: g.kz.res }, 0);
  return { ...s, game: { ...g, kz: { ...g.kz, q: g.kz.q + 1, pick: null, to: false } }, t: kz.SECONDS_PER_QUESTION, tMax: kz.SECONDS_PER_QUESTION, running: true, later: null };
}

// ---------- Asocijacije ----------
const A_OPEN_FIRST = 'Prvo otvori bar jedno polje';
const A_LOCKED = 'Otvori novo polje pre sledećeg pokušaja';

/** Can the player start a guess now? Returns an error message or null. */
function aBlocked(A) {
  if (!A.open.some((r) => r.some(Boolean))) return A_OPEN_FIRST;
  if (A.tried && !as.allOpen(A.open)) return A_LOCKED;
  return null;
}

/** Start typing into a column's solution field or the final field. */
function aEdit(s, action) {
  const g = s.game; const A = g.a;
  if (A.fin) return s;
  const t = action.kind === 'final' ? { kind: 'final' } : { kind: 'col', c: action.c };
  if (t.kind === 'col' && A.sol[t.c]) return s;
  const act = t.kind === 'col' ? t.c : A.act;
  const why = aBlocked(A);
  if (why) return { ...s, game: { ...g, a: { ...A, act, target: null, msg: why, msgC: O, shake: A.shake + 1 } } };
  return { ...s, game: { ...g, a: { ...A, act, target: t, input: '', msg: '' } } };
}

/**
 * Submit what was typed into the target field. Only that field is checked: the final answer
 * typed into a column is a miss. A miss ends guessing until a new field is opened (unless every
 * field is already open); a solved column keeps the turn, so the final can follow at once.
 */
function aGuess(s) {
  const g = s.game; const A = g.a;
  if (s.locked || A.fin || !A.target) return s;
  const P = s.puzzle.asocijacije;
  const r = as.matchTarget(P, A.target, A.input);
  if (r === 'empty') return s;
  const why = aBlocked(A);
  if (why) return { ...s, game: { ...g, a: { ...A, target: null, msg: why, msgC: O, shake: A.shake + 1 } } };
  if (r === 'miss') {
    const again = as.allOpen(A.open);
    return { ...s, game: { ...g, a: { ...A, target: null, tried: true, input: '', msg: again ? 'Netačno, pokušaj ponovo' : 'Netačno. ' + A_LOCKED, msgC: R, shake: A.shake + 1 } } };
  }
  if (A.target.kind === 'final') {
    const w = as.finalWorth(A.open, A.sol);
    const pts = A.earn + w;
    const sol = A.sol.map((x) => x || 2);
    const a2 = { ...A, fin: 1, sol, open: A.open.map((row) => row.map(() => 1)), target: null, input: '', msg: 'Konačno rešenje! +' + w, msgC: Y };
    return finish({ ...s, game: { ...g, a: a2 } }, pts, { sol, fin: 1, earn: pts }, 1800);
  }
  const c = A.target.c; const v = as.columnValue(A.open[c]);
  const sol = [...A.sol]; sol[c] = 1;
  const open = A.open.map((row) => [...row]); open[c] = [1, 1, 1, 1];
  return { ...s, game: { ...g, a: { ...A, sol, open, earn: A.earn + v, target: null, tried: false, input: '', act: c, msg: 'Kolona ' + P.cols[c].L + ' rešena · +' + v, msgC: Y } } };
}

function aGiveUp(s, timeout = false) {
  const g = s.game; const A = g.a;
  if (s.locked || A.fin) return s;
  const a2 = { ...A, fin: 2, sol: A.sol.map((x) => x || 2), open: A.open.map((r) => r.map(() => 1)), msg: timeout ? 'Vreme je isteklo' : 'Rešenje je otkriveno', msgC: O };
  return finish({ ...s, game: { ...g, a: a2 } }, A.earn, { sol: [...A.sol], fin: 2, earn: A.earn, timeout }, 1900);
}

// ---------- reducer ----------
export function reducer(s, action) {
  const g = s.game;
  const inGame = s.screen === 'game' && !s.locked;
  switch (action.type) {
    case 'INIT': {
      const { day, puzzle, progress, history, dictionary } = action;
      let st = { ...initialState(), ready: true, day, puzzle, history, dictionary: dictionary || null };
      if (progress) {
        st = { ...st, scores: progress.scores || st.scores, reveals: progress.reveals || st.reveals, done: !!progress.done };
        if (progress.inGame && !st.done) {
          const ig = progress.inGame;
          st = { ...st, gi: ig.gi, game: { ...freshGame(), ...ig.game }, t: ig.t, tMax: ig.tMax, paused: true, running: false };
        }
      }
      return st;
    }
    case 'GO': return { ...s, screen: action.screen, prev: s.screen };
    case 'BACK': return { ...s, screen: s.prev === 'results' ? 'results' : 'home', prev: s.screen };
    case 'HOME': {
      if (s.practice) return { ...initialState(), ready: true, day: s.day, puzzle: s.puzzle, history: s.history, dictionary: s.dictionary, scores: s.saved?.scores || Array(5).fill(null), reveals: s.saved?.reveals || Array(5).fill(null), done: !!s.saved?.done };
      const pausing = s.screen === 'game' && !s.locked;
      return { ...s, screen: 'home', prev: s.screen, running: false, paused: pausing || s.paused, later: pausing ? null : s.later };
    }
    case 'PRIMARY': {
      const nx = s.scores.findIndex((x) => x == null);
      if (s.done || nx < 0) return { ...s, screen: 'results', done: true };
      if (s.paused && s.gi === nx) {
        // resume a paused game; a pending Ko zna zna transition is re-armed
        const later = s.gi === 3 && g.kz.pick != null ? { action: { type: 'KZ_NEXT' }, delay: 600, seq: next(s) } : null;
        return { ...s, screen: 'game', running: !later, paused: false, later, seq: next(s) };
      }
      return startGame(s, nx);
    }
    case 'START_GAME': return startGame(s, action.gi);
    case 'NEXT': {
      if (s.gi < 4) return startGame(s, s.gi + 1);
      return { ...s, screen: 'results', done: true };
    }
    case 'PRACTICE': {
      const saved = s.practice ? s.saved : { scores: s.scores, reveals: s.reveals, done: s.done };
      return startGame({ ...s, practice: true, saved, scores: Array(5).fill(null), reveals: Array(5).fill(null), done: false, paused: false, puzzle: action.puzzle || s.puzzle, practiceDay: action.day }, 0);
    }
    case 'TICK': {
      if (s.screen !== 'game' || !s.running || s.locked || action.relaxed) return s;
      const t = Math.max(0, s.t - action.dt);
      const s2 = { ...s, t };
      return t <= 0 ? timeUp(s2) : s2;
    }
    case 'COMMIT': return action.seq === s.pending?.seq ? commit(s) : s;
    case 'LATER_FIRE': return action.seq === s.later?.seq ? reducer({ ...s, later: null }, s.later.action) : s;
    case 'HISTORY': return { ...s, history: action.history };
    case 'TOAST': return { ...s, toast: action.msg };
    case 'TOAST_CLEAR': return { ...s, toast: null };
    case 'RESET': return { ...initialState(), ready: true, day: s.day, puzzle: s.puzzle, history: {}, dictionary: s.dictionary };

    // Slagalica
    case 'SL_ADD': {
      if (!inGame) return s;
      // Tapping the most recently placed letter again takes it back out.
      if (g.sl.pick[g.sl.pick.length - 1] === action.i) return reducer(s, { type: 'SL_BACK' });
      if (g.sl.pick.includes(action.i) || g.sl.pick.length >= 12) return s;
      return { ...s, game: { ...g, sl: { ...g.sl, pick: [...g.sl.pick, action.i], msg: '' } } };
    }
    case 'SL_TYPE': {
      if (!inGame) return s;
      const L = s.puzzle.slagalica.letters;
      const i = L.findIndex((l, x) => l === action.letter && !g.sl.pick.includes(x));
      return i < 0 ? s : reducer(s, { type: 'SL_ADD', i });
    }
    case 'SL_REMOVE': return !inGame ? s : { ...s, game: { ...g, sl: { ...g.sl, pick: g.sl.pick.filter((_, x) => x !== action.k), msg: '' } } };
    case 'SL_BACK': return !inGame ? s : { ...s, game: { ...g, sl: { ...g.sl, pick: g.sl.pick.slice(0, -1), msg: '' } } };
    case 'SL_CLEAR': return !inGame ? s : { ...s, game: { ...g, sl: { ...g.sl, pick: [], msg: '' } } };
    case 'SL_SUBMIT': return !inGame ? s : slSubmit(s);

    // Moj broj
    case 'MB_PUSH': {
      if (!inGame) return s;
      const r = mb.push(g.mb.tok, action.tok);
      if (!r.ok) return { ...s, game: { ...g, mb: { ...g.mb, shake: g.mb.shake + 1, msg: r.error, msgC: O } } };
      return { ...s, game: { ...g, mb: { ...g.mb, tok: r.tokens, msg: '' } } };
    }
    case 'MB_BACK': return !inGame ? s : { ...s, game: { ...g, mb: { ...g.mb, tok: g.mb.tok.slice(0, -1), msg: '' } } };
    case 'MB_CLEAR': return !inGame ? s : { ...s, game: { ...g, mb: { ...g.mb, tok: [], msg: '' } } };
    case 'MB_SUBMIT': return !inGame ? s : mbSubmit(s);

    // Skočko
    case 'SK_ADD': {
      if (!inGame || g.sk.done || g.sk.cur.length >= 4) return s;
      return { ...s, game: { ...g, sk: { ...g.sk, cur: [...g.sk.cur, action.i], msg: '' } } };
    }
    case 'SK_DEL': return !inGame || g.sk.done ? s : { ...s, game: { ...g, sk: { ...g.sk, cur: g.sk.cur.slice(0, -1) } } };
    case 'SK_REMOVE': return !inGame || g.sk.done ? s : { ...s, game: { ...g, sk: { ...g.sk, cur: g.sk.cur.filter((_, x) => x !== action.k) } } };
    case 'SK_SUBMIT': return !inGame ? s : skSubmit(s);

    // Ko zna zna
    case 'KZ_ANSWER': return !inGame ? s : kzAnswer(s, action.i);
    case 'KZ_NEXT': return kzNext(s);

    // Asocijacije
    case 'A_OPEN': {
      if (!inGame || g.a.fin) return s;
      const { c, k } = action;
      if (g.a.sol[c] || g.a.open[c][k]) return { ...s, game: { ...g, a: { ...g.a, act: c } } };
      const open = g.a.open.map((r) => [...r]); open[c][k] = 1;
      return { ...s, game: { ...g, a: { ...g.a, open, act: c, tried: false, msg: '', newKey: c + '-' + k } } };
    }
    case 'A_ACT': return { ...s, game: { ...g, a: { ...g.a, act: action.c } } };
    case 'A_EDIT': return !inGame ? s : aEdit(s, action);
    case 'A_CANCEL': return { ...s, game: { ...g, a: { ...g.a, target: null, input: '' } } };
    case 'A_INPUT': return { ...s, game: { ...g, a: { ...g.a, input: action.value, msg: '' } } };
    case 'A_GUESS': return !inGame ? s : aGuess(s);
    case 'A_GIVEUP': return !inGame ? s : aGiveUp(s);

    default: return s;
  }
}

/** Snapshot persisted after every change (not in practice mode). */
export function progressOf(s) {
  const inGame = (s.screen === 'game' || s.paused) && !s.done && !s.pending
    ? { gi: s.gi, game: s.game, t: s.t, tMax: s.tMax }
    : null;
  return { day: s.day, scores: s.scores, reveals: s.reveals, done: s.done, inGame };
}
