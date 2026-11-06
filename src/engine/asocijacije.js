// Asocijacije: four columns of four clues, each column has a solution, and the four
// column solutions point to the final answer.
import { normalize } from './text.js';

// TV rule: a solved column is worth 3 + 1 per unopened field in it; the final answer is
// worth 7 + the value of every column not yet solved. Maximum 34 (final after one field).
export const COLUMN_BASE = 3;
export const FINAL_BASE = 7;
export const MAX_POINTS = 34;

/** 3 points + 1 for every clue in the column still closed. */
export function columnValue(open) {
  return COLUMN_BASE + open.filter((x) => !x).length;
}

/** Final answer is worth 7 + the value of every column not yet solved by the player. */
export function finalWorth(openRows, solved) {
  let w = FINAL_BASE;
  for (let c = 0; c < 4; c++) if (!solved[c]) w += columnValue(openRows[c]);
  return w;
}

function accepts(entry, guess) {
  const list = [entry.s, ...(entry.acc || [])].map(normalize);
  return list.includes(guess);
}

/**
 * Classify a guess against the puzzle. Returns
 *   {kind:'final'} | {kind:'column', col} | {kind:'miss'} | {kind:'empty'}
 * Already solved columns are not matched again.
 */
export function matchGuess(puzzle, rawGuess, solved) {
  const g = normalize(rawGuess);
  if (!g) return { kind: 'empty' };
  if (accepts(puzzle.final, g)) return { kind: 'final' };
  const col = puzzle.cols.findIndex((C, i) => !solved[i] && accepts(C, g));
  if (col >= 0) return { kind: 'column', col };
  return { kind: 'miss' };
}
