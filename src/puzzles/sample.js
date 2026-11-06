// A hand-made puzzle used for every day until the daily feed exists.
// Content follows the design prototype so the screens match the mock-ups.

const LETTERS = ['S', 'A', 'K', 'O', 'R', 'V', 'E', 'A', 'T', 'N', 'A', 'C'];

const WORDS = ('KRASTAVAC KRASTAVCE NASTAVAK NASTAVA NASTAVE RASTAVA STRANAC STRANCE STRANA STRANE KRAVATA KRAVATE ' +
  'SVETAC OSTAVA OSTAVE OKTAVA TRAKA TRAKE KRAVA KRAVE KRASTA VRANA VRANE KONAC VOSAK OTAC SAVET STAN STARAC STARCE ' +
  'KARTA KARTE KARTON NAVRAT NOVAC NOVCA VATRA VATRE VETAR CVET CRTA TRAVA TRAVE KOSA KOST ROSA NOS NOVA STOKA VRATA ' +
  'RANAC KANTA KANTE TRESKA SOVA RAK SAT TRN VRSTA VRSTE SAKO RANA REKA SNOVA ROVAC CRVENA KOSAC ' +
  'SRCE CRV VRAT SAN NAS ONA TON TOK KOV ROK ARENA AVET VEK VEST NERV NERVA').split(' ');

export const SAMPLE_PUZZLE = {
  day: 0,
  slagalica: { letters: LETTERS, words: WORDS, best: 'KRASTAVAC' },
  mojBroj: { numbers: [3, 8, 2, 7, 15, 75], target: 742, solution: '75 × (8 + 2) − 15 + 7' },
  skocko: { secret: [0, 4, 1, 3] },
  koZnaZna: [
    { q: 'Koji je glavni grad Australije?', o: ['Sidnej', 'Kanbera', 'Melburn'], a: 1 },
    { q: 'Koliko igrača jednog tima je u vodi tokom vaterpolo utakmice?', o: ['Šest', 'Sedam', 'Osam'], a: 1 },
    { q: 'Ko je napisao „Gorski vijenac“?', o: ['Petar II Petrović Njegoš', 'Vuk Stefanović Karadžić', 'Laza Kostić'], a: 0 },
    { q: 'Koji hemijski element ima simbol Fe?', o: ['Fluor', 'Gvožđe', 'Fosfor'], a: 1 },
    { q: 'U kom gradu se nalazi Petrovaradinska tvrđava?', o: ['Novi Sad', 'Niš', 'Subotica'], a: 0 },
    { q: 'Koliko strana ima šestougao?', o: ['Pet', 'Šest', 'Osam'], a: 1 },
    { q: 'Koja reka se uliva u Dunav kod Beograda?', o: ['Sava', 'Tisa', 'Morava'], a: 0 },
    { q: 'Koliko minuta traje jedno poluvreme u fudbalu?', o: ['30', '45', '60'], a: 1 },
    { q: 'Koji je najveći okean na Zemlji?', o: ['Atlantski', 'Indijski', 'Tihi'], a: 2 },
    { q: 'Koja planeta je najbliža Suncu?', o: ['Venera', 'Merkur', 'Mars'], a: 1 },
  ],
  asocijacije: {
    cols: [
      { L: 'A', f: ['MESEC', 'TAMA', 'PONOĆ', 'SAN'], s: 'NOĆ', acc: ['NOC'] },
      { L: 'B', f: ['KADAR', 'REŽISER', 'BIOSKOP', 'ULOGA'], s: 'FILM', acc: ['FILMOVI'] },
      { L: 'C', f: ['TALAS', 'PLAŽA', 'SO', 'LUKA'], s: 'MORE', acc: ['MORA'] },
      { L: 'D', f: ['DETELINA', 'POTKOVICA', 'LUTRIJA', 'DŽEKPOT'], s: 'SREĆA', acc: ['SRECA'] },
    ],
    final: { s: 'ZVEZDA', acc: ['ZVEZDE'] },
  },
};
