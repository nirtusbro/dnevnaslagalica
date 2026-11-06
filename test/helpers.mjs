// Node cannot evaluate `import.meta.glob` from src/puzzles/index.js, so tests use this
// copy of the merge rule. Keep it in sync with mergeWithSample in src/puzzles/index.js.
import { SAMPLE_PUZZLE } from '../src/puzzles/sample.js';

export function mergeWithSample(partial, day) {
  return { ...SAMPLE_PUZZLE, ...(partial || {}), day };
}
