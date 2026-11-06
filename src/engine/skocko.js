// Skočko: break a four-symbol code in six attempts. Mastermind-style feedback.

export const SYMBOLS = [
  { id: 'skocko', name: 'Skočko' },
  { id: 'tref', name: 'Tref', glyph: '♣︎' },
  { id: 'pik', name: 'Pik', glyph: '♠︎' },
  { id: 'srce', name: 'Srce', glyph: '♥︎' },
  { id: 'karo', name: 'Karo', glyph: '♦︎' },
  { id: 'zvezda', name: 'Zvezda', glyph: '★' },
];

export const CODE_LENGTH = 4;
export const MAX_ATTEMPTS = 6;

/** {exact, near}: symbols on the right spot, and right symbols on a wrong spot. */
export function feedback(guess, secret) {
  let exact = 0;
  const a = [], b = [];
  guess.forEach((g, i) => {
    if (g === secret[i]) exact++;
    else { a.push(g); b.push(secret[i]); }
  });
  let near = 0;
  for (const g of a) {
    const j = b.indexOf(g);
    if (j >= 0) { near++; b.splice(j, 1); }
  }
  return { exact, near };
}

/** TV rule — points by the attempt the code was broken on: 1–2 → 20, 3–4 → 15, 5–6 → 10. */
export function pointsFor(attempt) {
  return attempt <= 2 ? 20 : attempt <= 4 ? 15 : 10;
}
