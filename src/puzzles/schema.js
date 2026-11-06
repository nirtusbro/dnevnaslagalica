// Shape of one day's puzzle. The daily pipeline (to be built) produces objects of
// this shape; `validatePuzzle` is the contract it must satisfy.
//
// {
//   day?: number,                       // challenge number; optional, informational
//   slagalica: {
//     letters: string[12],              // upper-case Serbian Latin letters, in display order
//     words: string[],                  // every accepted word spelled from those letters
//     best?: string,                    // the longest accepted word (defaults to longest in `words`)
//   },
//   mojBroj: {
//     numbers: number[6],               // four small (1–9), one of 10/15/20, one of 25/50/75/100
//     target: number,                   // 100–999
//     solution?: string,                // a human-readable exact expression; computed if missing
//   },
//   skocko: { secret: number[4] },      // indices into engine/skocko SYMBOLS (0–5)
//   koZnaZna: { q: string, o: string[3], a: 0|1|2 }[10],
//   asocijacije: {
//     cols: { L: 'A'|'B'|'C'|'D', f: string[4], s: string, acc?: string[] }[4],
//     final: { s: string, acc?: string[] },
//   },
// }

export function validatePuzzle(p) {
  const errors = [];
  const need = (cond, msg) => { if (!cond) errors.push(msg); };
  need(p && typeof p === 'object', 'puzzle must be an object');
  if (!p) return errors;

  const sl = p.slagalica;
  need(sl && Array.isArray(sl.letters) && sl.letters.length === 12, 'slagalica.letters must have 12 letters');
  need(sl && Array.isArray(sl.words) && sl.words.length > 0, 'slagalica.words must be a non-empty list');

  const mb = p.mojBroj;
  need(mb && Array.isArray(mb.numbers) && mb.numbers.length === 6 && mb.numbers.every(Number.isInteger), 'mojBroj.numbers must be 6 integers');
  need(mb && Number.isInteger(mb.target), 'mojBroj.target must be an integer');

  const sk = p.skocko;
  need(sk && Array.isArray(sk.secret) && sk.secret.length === 4 && sk.secret.every((x) => Number.isInteger(x) && x >= 0 && x <= 5), 'skocko.secret must be 4 symbol indices 0–5');

  const kz = p.koZnaZna;
  need(Array.isArray(kz) && kz.length === 10, 'koZnaZna must have 10 questions');
  if (Array.isArray(kz)) kz.forEach((q, i) => need(q && typeof q.q === 'string' && Array.isArray(q.o) && q.o.length === 3 && [0, 1, 2].includes(q.a), `koZnaZna[${i}] malformed`));

  const as = p.asocijacije;
  need(as && Array.isArray(as.cols) && as.cols.length === 4, 'asocijacije.cols must have 4 columns');
  if (as && Array.isArray(as.cols)) as.cols.forEach((c, i) => need(c && Array.isArray(c.f) && c.f.length === 4 && typeof c.s === 'string', `asocijacije.cols[${i}] malformed`));
  need(as && as.final && typeof as.final.s === 'string', 'asocijacije.final.s required');

  return errors;
}
