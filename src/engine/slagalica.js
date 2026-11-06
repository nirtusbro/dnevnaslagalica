// Slagalica: build the longest word from 12 letters.
// TV scoring: 1 point per letter, plus a bonus against the set word (the computer's
// longest word): +5 for the set word itself, +10 for a different word of the same
// length, +15 for a longer word.
// Length is counted in letters of the alphabet, not characters: LJ, NJ and DŽ are one
// letter each (see letters.js).
import { splitLetters, letterCount } from './letters.js';
export { splitLetters, letterCount } from './letters.js';

export const POINTS_PER_LETTER = 1;
export const BONUS_SAME_WORD = 5;
export const BONUS_SAME_LENGTH = 10;
export const BONUS_LONGER = 15;

/**
 * True when `word` can be spelled with the multiset of tile `letters`. The word is split into
 * alphabet letters first, so KONJ needs an NJ tile; N + J tiles do not spell it.
 */
export function canSpell(word, letters) {
  const pool = [...letters];
  const parts = splitLetters(word);
  for (const ch of parts) {
    const i = pool.indexOf(ch);
    if (i < 0) return false;
    pool.splice(i, 1);
  }
  return parts.length > 0;
}

/**
 * Builds the validity checker for a puzzle. `puzzle.words` is the list of accepted
 * words for that day's letters (upper-case Serbian Latin). An optional global
 * `dictionary` (Set) is consulted too, so a bigger word list can be plugged in later.
 */
export function makeChecker(puzzle, dictionary = null) {
  const own = new Set((puzzle.words || []).map((w) => w.toUpperCase()));
  return (word) => {
    if (!canSpell(word, puzzle.letters)) return false;
    return own.has(word) || (dictionary ? dictionary.has(word) : false);
  };
}

/** Longest accepted word for the day: explicit `best`, else the longest listed word. */
export function bestWord(puzzle) {
  if (puzzle.best) return puzzle.best;
  return (puzzle.words || []).reduce((a, w) => (letterCount(w) > letterCount(a) ? w : a), '');
}

/** Bonus points for `word` measured against the set word `best`. */
export function bonusFor(word, best) {
  if (!word || !best) return 0;
  if (word === best) return BONUS_SAME_WORD;
  const n = letterCount(word), b = letterCount(best);
  if (n === b) return BONUS_SAME_LENGTH;
  if (n > b) return BONUS_LONGER;
  return 0;
}

/** Base points (letters only). */
export function basePoints(word) {
  return letterCount(word) * POINTS_PER_LETTER;
}

/** Total points for a valid word against the day's set word. */
export function scoreWord(word, best) {
  return basePoints(word) + bonusFor(word, best);
}

/**
 * Outcome of submitting the picked tiles (an array of tile letters, e.g. ['K','O','NJ']);
 * `timeout` marks a forced submission when the clock runs out.
 */
export function evaluate(puzzle, pickedLetters, isValid, timeout = false) {
  const word = pickedLetters.join('');
  if (!word) return { ok: false, word: '', points: 0, bonus: 0, reason: 'empty', timeout };
  if (!isValid(word) || !sameTiles(pickedLetters, word)) return { ok: false, word, points: 0, bonus: 0, reason: 'unknown', timeout };
  const best = bestWord(puzzle);
  const bonus = bonusFor(word, best);
  return { ok: true, word, points: basePoints(word) + bonus, bonus, reason: null, timeout };
}

/** The picked tiles must be exactly how the word is read: L + J tiles are not the letter LJ. */
function sameTiles(tiles, word) {
  const parts = splitLetters(word);
  return parts.length === tiles.length && parts.every((p, i) => p === tiles[i]);
}
