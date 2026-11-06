// Ko zna zna: ten quick questions with three options each.

export const QUESTIONS = 10;
export const SECONDS_PER_QUESTION = 10;
export const CORRECT = 10;
export const WRONG = -5;

/** 1 correct, -1 wrong, 0 skipped / timed out. */
export function resultFor(question, pick) {
  if (pick == null || pick < 0) return 0;
  return pick === question.a ? 1 : -1;
}

export function pointsFor(result) {
  return result === 1 ? CORRECT : result === -1 ? WRONG : 0;
}

export function scoreOf(results) {
  return results.reduce((a, r) => a + pointsFor(r), 0);
}
