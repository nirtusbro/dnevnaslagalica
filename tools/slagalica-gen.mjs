// Deterministic Slagalica puzzle generator.
//
// A day's letters are built from a "spine": one random dictionary word of 9–11
// letters (so every day has a satisfying long answer), topped up to 12 letters
// with frequency-weighted random letters, keeping the vowel count sane. The
// accepted-word list is every dictionary word spellable from those tiles. The
// day number seeds the RNG, so the same day always yields the same puzzle.

import { splitLetters, letterCount } from '../src/engine/letters.js';

export const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
export const TILE_COUNT = 12;
export const SPINE_LENGTHS = [9, 9, 9, 10, 10, 11];
export const MIN_VOWELS = 4, MAX_VOWELS = 6;
export const MIN_WORDS = 150;
/** Letters that may appear at most once on the board; everything else at most twice. */
export const RARE = new Set(['ć', 'đ', 'ž', 'š', 'č', 'f', 'h', 'c', 'lj', 'nj', 'dž']);
export const MAX_REPEAT = 2;

/** Board quality: no letter more than twice, rare letters at most once. */
export function repeatsOk(letters) {
  const c = new Map();
  for (const ch of letters) {
    const n = (c.get(ch) || 0) + 1;
    if (n > (RARE.has(ch) ? 1 : MAX_REPEAT)) return false;
    c.set(ch, n);
  }
  return true;
}

/** mulberry32: small, fast, deterministic. */
export function rng(seed) {
  let a = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

function weightedLetter(r, freq) {
  const entries = Object.entries(freq);
  const total = entries.reduce((a, [, v]) => a + v, 0);
  let x = r() * total;
  for (const [ch, v] of entries) { x -= v; if (x <= 0) return ch; }
  return entries[entries.length - 1][0];
}

function shuffle(r, arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Letter counts of a tile set; used for the fast spellability check. */
function counts(letters) {
  const c = new Map();
  for (const ch of letters) c.set(ch, (c.get(ch) || 0) + 1);
  return c;
}

/** All dictionary words spellable from the tile `letters` (lowercase in, lowercase out). */
export function spellable(words, letters) {
  const base = counts(letters);
  const out = [];
  for (const w of words) {
    const parts = splitLetters(w);
    if (parts.length > letters.length) continue;
    const c = new Map();
    let ok = true;
    for (const ch of parts) {
      const n = (c.get(ch) || 0) + 1;
      if (n > (base.get(ch) || 0)) { ok = false; break; }
      c.set(ch, n);
    }
    if (ok) out.push(w);
  }
  return out;
}

/**
 * @param day   challenge number (seed)
 * @param words lowercase core dictionary (curated): spines and the best word come from here
 * @param freq  {letter: relativeFrequency}
 * @param opts  {extended?: string[]} extra accepted words (never used for spine/best), {minWords?, byLen?}
 * @returns {{letters: string[], words: string[], best: string, spine: string}} upper-cased for the game
 */
export function generateSlagalica(day, words, freq, opts = {}) {
  const r = rng(day * 7919 + 17);
  const byLen = opts.byLen || groupByLength(words);
  const minWords = opts.minWords ?? MIN_WORDS;
  const extended = opts.extended || [];
  for (let attempt = 0; attempt < 50; attempt++) {
    const spine = pick(r, byLen[pick(r, SPINE_LENGTHS)] || []);
    if (!spine || /ije|^ne/.test(spine) || !repeatsOk(splitLetters(spine))) continue; // prefer ekavian, non-negated, varied spines
    let letters = splitLetters(spine);
    let guard = 0;
    while (letters.length < TILE_COUNT && guard++ < 200) {
      const v = letters.filter((ch) => VOWELS.has(ch)).length;
      const left = TILE_COUNT - letters.length;
      let ch = weightedLetter(r, freq);
      if (VOWELS.has(ch) && v >= MAX_VOWELS) continue;
      if (!VOWELS.has(ch) && v + left <= MIN_VOWELS) ch = pick(r, [...VOWELS]);
      if (!repeatsOk([...letters, ch])) continue;
      letters.push(ch);
    }
    if (letters.length < TILE_COUNT) continue;
    const v = letters.filter((ch) => VOWELS.has(ch)).length;
    if (v < MIN_VOWELS || v > MAX_VOWELS) continue;
    letters = shuffle(r, letters);
    if (spellable(words, letters).length < minWords) continue;
    const { words: accepted, best } = acceptedWords(letters, words, extended, spine);
    return {
      letters: letters.map((ch) => ch.toUpperCase()),
      words: accepted,
      best,
      spine: spine.toUpperCase(),
    };
  }
  throw new Error('could not generate a Slagalica puzzle for day ' + day);
}

/**
 * The accepted-word list and the set word for a tile set (lowercase letters in, upper-case out).
 * The set word is the longest core word, `prefer` when it is one of the longest (the spine, or the
 * day's existing set word on a refresh); extended words (rare head-words, inflected forms) are
 * accepted answers only.
 */
export function acceptedWords(letters, words, extended = [], prefer = null) {
  const core = spellable(words, letters);
  const maxLen = Math.max(...core.map(letterCount));
  const longest = core.filter((w) => letterCount(w) === maxLen);
  const best = prefer && longest.includes(prefer) ? prefer : longest.sort()[0];
  const all = [...new Set(core.concat(spellable(extended, letters)))];
  all.sort((a, b) => letterCount(b) - letterCount(a) || a.localeCompare(b));
  return { words: all.map((w) => w.toUpperCase()), best: best.toUpperCase() };
}

/** Words grouped by letter count (LJ, NJ, DŽ count once). */
export function groupByLength(words) {
  const byLen = {};
  for (const w of words) (byLen[letterCount(w)] ||= []).push(w);
  return byLen;
}
