// Deterministic Moj broj puzzle generator (TV number draw).
//
// Numbers: four single digits (1–9), one of 10/15/20, one of 25/50/75/100.
// Target: 100–999. A day is only accepted when the solver reaches the target exactly
// with an expression that uses at least MIN_USED numbers, so every day is solvable
// and not trivially so. The solution string is stored in the puzzle for the reveal.
import { solve } from '../src/engine/mojbroj.js';
import { rng } from './slagalica-gen.mjs';

export const MID = [10, 15, 20];
export const BIG = [25, 50, 75, 100];
export const MIN_TARGET = 100, MAX_TARGET = 999;
export const MIN_USED = 3;

const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

/** How many of the offered numbers an expression uses. */
export function numbersUsed(expr) {
  return (expr.match(/\d+/g) || []).length;
}

export function generateMojBroj(day, opts = {}) {
  const r = rng(day * 104729 + 31);
  const minUsed = opts.minUsed ?? MIN_USED;
  for (let attempt = 0; attempt < 200; attempt++) {
    const numbers = [int(r, 1, 9), int(r, 1, 9), int(r, 1, 9), int(r, 1, 9), pick(r, MID), pick(r, BIG)];
    const small = numbers.slice(0, 4);
    if (new Set(small).size < 3) continue; // avoid 1 1 1 1-style draws
    const target = int(r, MIN_TARGET, MAX_TARGET);
    const s = solve(numbers, target);
    if (s.diff !== 0 || numbersUsed(s.text) < minUsed) continue;
    return { numbers, target, solution: s.text };
  }
  throw new Error('could not generate a Moj broj puzzle for day ' + day);
}
