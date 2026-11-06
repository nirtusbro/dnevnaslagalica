// Deterministic Skočko secret generator: four symbols out of six, repeats allowed (TV rule).
import { SYMBOLS, CODE_LENGTH } from '../src/engine/skocko.js';
import { rng } from './slagalica-gen.mjs';

export function generateSkocko(day) {
  const r = rng(day * 15485863 + 7);
  const secret = Array.from({ length: CODE_LENGTH }, () => Math.floor(r() * SYMBOLS.length));
  return { secret };
}
