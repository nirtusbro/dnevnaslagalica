// The Serbian Latin alphabet as Slagalica tiles. LJ, NJ and DŽ are single letters: one tile,
// one point, and an L tile next to a J tile never counts as LJ.

/** The 30 letters, in alphabet order, as shown on tiles. */
export const ALPHABET = ['A', 'B', 'C', 'Č', 'Ć', 'D', 'DŽ', 'Đ', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'LJ', 'M', 'N', 'NJ', 'O', 'P', 'R', 'S', 'Š', 'T', 'U', 'V', 'Z', 'Ž'];
export const DIGRAPHS = ['LJ', 'NJ', 'DŽ'];

/**
 * Words where a digraph-looking pair is really two letters, by lower-case prefix. The first
 * digraph pair inside the prefix is split: nad-živeti, pod-župan, in-jekcija, kon-jugacija.
 * Everything else is read greedily (poljubac → P O LJ U B A C, kanjon → K A NJ O N).
 */
export const SPLIT_PREFIXES = ['nadž', 'podžanr', 'podžup', 'predživ', 'injek', 'konjug', 'konjunk', 'tanjug', 'vanjez'];

const DIGRAPH_RE = /lj|nj|dž/;

/**
 * Splits a word into Slagalica letters, keeping the input's case:
 * splitLetters('KONJ') → ['K', 'O', 'NJ'], splitLetters('injekcija') → ['i','n','j','e','k','c','i','j','a'].
 */
export function splitLetters(word) {
  const w = word || '';
  const lower = w.toLowerCase();
  let splitAt = -1;
  for (const p of SPLIT_PREFIXES) {
    if (lower.startsWith(p)) { const m = DIGRAPH_RE.exec(p); if (m) splitAt = m.index; break; }
  }
  const out = [];
  for (let i = 0; i < w.length; i++) {
    const pair = lower.slice(i, i + 2);
    if (i !== splitAt && (pair === 'lj' || pair === 'nj' || pair === 'dž')) { out.push(w.slice(i, i + 2)); i++; }
    else out.push(w[i]);
  }
  return out;
}

/** Number of letters (tiles) in a word: 'KONJ' → 3. */
export function letterCount(word) {
  return splitLetters(word).length;
}

/** True when `s` is one tile letter (upper-case). */
export function isLetter(s) {
  return ALPHABET.includes(s);
}
