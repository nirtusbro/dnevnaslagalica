// Game catalogue: names, time limits, maximum points and the rule text shown in "Kako se igra".
// Scoring follows the TV Slagalica rules (RTS): see README.md "Bodovanje".

import { letterCount } from './letters.js';

export const GAMES = [
  { id: 'slagalica', name: 'Slagalica', desc: 'Najduža reč od 12 slova', time: 60, timeL: '60 s', max: 17,
    rule: 'Od 12 ponuđenih slova složi najdužu reč koju znaš. Priznaje se svaka srpska reč u bilo kom obliku (padeži, množina, rod, glagolski oblici), osim vlastitih imena i skraćenica. Svako slovo vredi 1 poen. Ako je tvoja reč baš ona koju je računar zadao, dobijaš još 5 poena; za drugu reč iste dužine 10, a za dužu reč 15 poena. Na računaru možeš i da kucaš.' },
  { id: 'mojBroj', name: 'Moj broj', desc: 'Dođi do traženog broja', time: 90, timeL: '90 s', max: 10,
    rule: 'Šest brojeva, četiri računske operacije i zagrade. Svaki broj se koristi najviše jednom. Tačan broj donosi 10 poena. Ako do traženog broja ne može da se dođe, 10 poena vredi najbliži mogući rezultat. Poeni i kad si blizu: razlika 1–2 donosi 8, 3–5 donosi 6, 6–10 donosi 4, a 11–20 donosi 2 poena.' },
  { id: 'skocko', name: 'Skočko', desc: 'Otkrij tajnu kombinaciju', time: 120, timeL: '120 s', max: 20,
    rule: 'Pogodi niz od četiri znaka u šest pokušaja. Crvena tačka: znak je na pravom mestu. Žuta: znak postoji, ali na drugom mestu. Iz 1. ili 2. pokušaja 20 p, iz 3. ili 4. 15 p, iz 5. ili 6. 10 p.' },
  { id: 'koZnaZna', name: 'Ko zna zna', desc: 'Deset brzih pitanja', time: 10, timeL: '10 × 10 s', max: 100,
    rule: 'Deset pitanja, po 10 sekundi i tri ponuđena odgovora. Tačno +10, netačno −5. Ako nisi siguran, izaberi „Ne znam“.' },
  { id: 'asocijacije', name: 'Asocijacije', desc: 'Četiri kolone, jedno rešenje', time: 120, timeL: '120 s', max: 34,
    rule: 'Otvaraj polja u četiri kolone i pogađaj. Rešenje upisuješ u samo polje: klikni na kolonu ili na konačno, upiši i potvrdi. Proverava se samo to polje. Posle pogrešnog pokušaja moraš otvoriti novo polje pre sledećeg (osim kad su sva polja otvorena). Kolona vredi 3 p + 1 p za svako neotvoreno polje u njoj. Konačno rešenje vredi 7 p + vrednost svih kolona koje još nisu rešene. Najviše 34 poena.' },
];

/** Theoretical ceiling over all games (Slagalica counted as a 12-letter set word). */
export const MAX_TOTAL = GAMES.reduce((a, g) => a + g.max, 0);

/** Slagalica bonus for matching the set (longest) word. */
export const SLAGALICA_SET_BONUS = 5;

/**
 * Maximum for game `gi` on a given day. Slagalica's maximum is the day's set word
 * length + the set-word bonus (a different word of the same length or a longer one
 * can score above it; the percentage is capped at 100). Other games are fixed.
 */
export function gameMax(gi, puzzle) {
  if (gi === 0 && puzzle && puzzle.slagalica) {
    const sl = puzzle.slagalica;
    const best = sl.best || (sl.words || []).reduce((a, w) => (letterCount(w) > letterCount(a) ? w : a), '');
    if (best) return letterCount(best) + SLAGALICA_SET_BONUS;
  }
  return GAMES[gi].max;
}

export function maxesOf(puzzle) {
  return GAMES.map((g, i) => gameMax(i, puzzle));
}

export function maxTotalOf(puzzle) {
  return maxesOf(puzzle).reduce((a, b) => a + b, 0);
}

/** Result tiers, best first. Index is used for colours and share emoji. */
export const GRADES = [
  { key: 'great', emoji: '🟩', label: '80%+', min: 0.8 },
  { key: 'good', emoji: '🟨', label: '50–79%', min: 0.5 },
  { key: 'fair', emoji: '🟧', label: '20–49%', min: 0.2 },
  { key: 'poor', emoji: '🟥', label: 'ispod 20%', min: 0 },
];

/** Tier index for a score in game `gi` (against `max`, default the fixed maximum); null when not played. */
export function grade(gi, score, max = GAMES[gi].max) {
  if (score == null) return null;
  const r = Math.max(0, score) / max;
  return r >= 0.8 ? 0 : r >= 0.5 ? 1 : r >= 0.2 ? 2 : 3;
}

/** Percentage of the maximum, capped at 100. */
export function percent(score, max) {
  return Math.min(100, Math.round(Math.max(0, score || 0) / max * 100));
}

export function totalOf(scores) {
  return scores.reduce((a, b) => a + (b || 0), 0);
}

export function remarkFor(total, maxTotal = MAX_TOTAL) {
  const ratio = total / maxTotal;
  return ratio >= 0.8 ? 'Briljantno veče!' : ratio >= 0.6 ? 'Odlično odigrano' : ratio >= 0.4 ? 'Solidan dan' : 'Sutra je novi dan';
}
