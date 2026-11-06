// Slagalica: build the longest word from 12 letters.
// TV scoring: 1 point per letter, plus a bonus against the set word (the computer's
// longest word): +5 for the set word itself, +10 for a different word of the same
// length, +15 for a longer word.

export const POINTS_PER_LETTER = 1;
export const BONUS_SAME_WORD = 5;
export const BONUS_SAME_LENGTH = 10;
export const BONUS_LONGER = 15;

/** True when `word` can be spelled with the multiset of `letters`. */
export function canSpell(word, letters) {
  const pool = [...letters];
  for (const ch of word) {
    const i = pool.indexOf(ch);
    if (i < 0) return false;
    pool.splice(i, 1);
  }
  return word.length > 0;
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
  return (puzzle.words || []).reduce((a, w) => (w.length > a.length ? w : a), '');
}

/** Bonus points for `word` measured against the set word `best`. */
export function bonusFor(word, best) {
  if (!word || !best) return 0;
  if (word === best) return BONUS_SAME_WORD;
  if (word.length === best.length) return BONUS_SAME_LENGTH;
  if (word.length > best.length) return BONUS_LONGER;
  return 0;
}

/** Base points (letters only). */
export function basePoints(word) {
  return word.length * POINTS_PER_LETTER;
}

/** Total points for a valid word against the day's set word. */
export function scoreWord(word, best) {
  return basePoints(word) + bonusFor(word, best);
}

/** Outcome of submitting; `timeout` marks a forced submission when the clock runs out. */
export function evaluate(puzzle, pickedLetters, isValid, timeout = false) {
  const word = pickedLetters.join('');
  if (!word) return { ok: false, word: '', points: 0, bonus: 0, reason: 'empty', timeout };
  if (!isValid(word)) return { ok: false, word, points: 0, bonus: 0, reason: 'unknown', timeout };
  const best = bestWord(puzzle);
  const bonus = bonusFor(word, best);
  return { ok: true, word, points: basePoints(word) + bonus, bonus, reason: null, timeout };
}
