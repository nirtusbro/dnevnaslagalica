# Dnevna Slagalica

Daily puzzle web game with five rounds: Slagalica, Moj broj, Skočko, Ko zna zna, Asocijacije.
Implemented from the Claude Design prototype "Dnevna Slagalica TV" (`design_ref/` holds the source files, not shipped).

## Run

```
npm install
npm run dev       # http://localhost:5173
npm test          # engine + reducer tests (node --test)
npm run build     # static site in dist/
```

Dev shortcuts (query string): `?game=3` opens game 3 in practice mode (does not touch the real day), `?relaxed` disables timers.

## Layout

```
src/
  engine/        pure game logic, no React — unit-tested in test/
    rules.js       game catalogue, max points, grade tiers
    slagalica.js   word validity + scoring (2 p per letter)
    mojbroj.js     expression grammar, evaluator with precedence, scoring, exact-solution solver
    skocko.js      mastermind feedback, scoring by attempt
    kozna.js       quiz scoring (+10 / −5 / 0)
    asocijacije.js column/final matching, worth calculation
    day.js         challenge numbering (LAUNCH_DATE → #1), date formatting, midnight countdown
    stats.js       streaks, histogram, per-game averages, share text
    storage.js     localStorage progress + history (guarded)
  puzzles/
    schema.js      puzzle shape + validatePuzzle()
    sample.js      the hand-made puzzle used every day for now
    index.js       loadPuzzle(day) — replace fetchPuzzle() with the real daily feed
  state.js       the entire game flow as a pure reducer (tested in test/state.test.js)
  App.jsx        side effects: timer, delayed commits, persistence, keyboard, TV stage fit
  screens/       Home, Game (+ games/*), Between (reveal), Results, Stats, Archive, How
  components/    Header, shared UI bits (buttons, panel, symbols, game art, count-up)
  theme.js       colour tokens and dynamic tile looks; styles.css holds the static chrome
```

## Daily puzzles

Everything is static: no server. Each day is a file `src/puzzles/days/NNN.json` (NNN = challenge
number; #1 is `LAUNCH_DATE` in `src/engine/day.js`, set it to the release day before shipping). Vite code-splits the folder, so the browser only
downloads the file for the day being played. A day file may define only some games; the rest is
filled from `src/puzzles/sample.js` until that game's generator exists.

```
npm run dict              # build data/dict from data/raw (see data/README.md for the sources)
npm run gen -- 1 366      # generate/update days 1..366 (deterministic per day; --force to regenerate)
```

### Slagalica (done)

`tools/slagalica-gen.mjs` builds each day from a "spine" word of 9–11 letters from the curated core
dictionary, tops up to 12 tiles with frequency-weighted letters (no letter more than twice, rare
letters once, 4–6 vowels), then lists every dictionary word spellable from the tiles (`words`) and the
longest core word (`best`). The day's maximum is `best.length × 2`, so finding the best word is always
100%. Word acceptance uses two tiers (curated Hunspell core + CC0 extended, see `data/README.md`);
a day file is ~10–25 KB.

### Moj broj (done)

`tools/mojbroj-gen.mjs` draws numbers the TV way (four digits, one of 10/15/20, one of 25/50/75/100)
and a 100–999 target, keeps a day only when the solver reaches the target exactly with at least three
numbers, and stores the solution expression.

### Skočko (done)

`tools/skocko-gen.mjs`: a seeded four-symbol code, repeats allowed.

### Ko zna zna (done, bank grows over time)

Two sources feed ten categories in TV order (jezik, književnost, istorija, geografija, nauka,
umetnost, muzika i film, priroda, opšta kultura, sport):

- **Hand-written**: `data/kozna/NN-<category>.json`, entries `{q, o:[3], a?, d?}`. `a` is the index of
  the correct option (default 0, so author with the answer first); `d` is difficulty 1–3 (default 1).
- **Wikidata-derived**: `node tools/wikidata-fetch.mjs` pulls structured facts (capitals, rivers,
  battle years, birth years by occupation, authors, painters, directors, element symbols, currencies,
  languages, founders, athletes' countries and sports, Olympic hosts, World Cup winners…) into
  `data/kozna/wikidata/`, keeping only rows with Serbian labels (Cyrillic transliterated).
  `node tools/wikidata-questions.mjs` turns them into `data/kozna/generated/<category>.json`, with
  same-type distractors (region-aware for countries), a `src` Wikidata id on every question so answers
  are auditable, and difficulty from the item's sitelink count (famous = easy, obscure = hard).

`tools/kozna-gen.mjs` merges both per category (hand questions win on duplicate text), keeps a seeded
deal order per (category, difficulty) pool, follows a daily difficulty pattern (2 easy, 4 medium,
4 hard, rotated so every category sees every level), spills into neighbouring pools when one is used
up, and shuffles option order per day. `gen-days` validates everything and prints the repeat horizon
(the smallest category). To extend: add hand questions to any file, or new SPARQL templates to the
fetcher/builder, then `npm run gen -- 1 366 --force`.

### Asocijacije (done, bank grows over time)

Hand-written puzzles in `data/asocijacije/*.json` (every file is an array, files are read in name
order). One puzzle:

```
{ "cols": [ { "f": ["MESEC", "TAMA", "PONOĆ", "SAN"], "s": "NOĆ", "acc": ["NOĆI"] }, ...x4 ],
  "final": { "s": "ZVEZDA", "acc": ["ZVEZDE"] }, "d": 2, "tags": ["priroda"] }
```

Columns are written in the order they appear (A–D), four clues each from the most oblique to the
most direct; `s` is the solution (a noun in nominative where possible), `acc` lists other forms the
player might type (plural, another case, a synonym that is clearly the same answer) — diacritics
are irrelevant because every guess and answer goes through `normalize()`. `d` (1–3) and `tags`
are optional notes for the author. Everything is upper-case Serbian Latin with diacritics.

`tools/asocijacije-gen.mjs` exports `loadBank`, `validateBank`, `makeDealer`/`generateAsocijacije`
and `repeatHorizon`. The validator (run by `gen-days`, which exits on the first problem) enforces:
4 columns × 4 clues, clues ≤ 14 and solutions ≤ 12 characters, upper-case letters/space/hyphen
only, no duplicate clue in a puzzle, no clue equal to any column solution, a column solution never
appearing inside its own clues, the final never appearing inside any clue or column solution,
unique finals and unique puzzles across the bank, a column solution reused at most twice across
the bank, and `acc` entries distinct from the solution (and each other) after normalisation.
Errors name the file, index and final (`03.json[7] "TARA": clue B2 …`).

The dealer shuffles the bank once with a fixed seed and deals it in that order from day 0, so no
puzzle repeats before the whole bank is used (the repeat horizon printed by `gen-days` is the bank
size); after that the same order cycles. To add puzzles: append to any file (or add a new one),
run `node tools/gen-days.mjs 1 366 --force` (the shuffle changes with the bank size, so regenerate
all days) and `npm test`.

## Bodovanje (TV Slagalica rules)

Scoring follows the RTS rules as currently published (official rules page + the detailed
breakdown on Serbian Wikipedia), adapted for a single player:

| Game | Rule | Max |
|---|---|---|
| Slagalica | 1 point per letter; +5 if the word is the day's set (longest) word, +10 for a different word of the same length, +15 for a longer one | set word + 5 (day-specific; longer answers can exceed it, shown as 100%) |
| Moj broj | 10 points for the exact number; if the target is unreachable, 10 for the closest reachable number. Nothing for near misses | 10 |
| Skočko | by attempt: 1st–2nd 20, 3rd–4th 15, 5th–6th 10 | 20 |
| Ko zna zna | 10 questions, +10 correct, −5 wrong, 0 skipped | 100 |
| Asocijacije | column = 3 + 1 per unopened field; final = 7 + every unsolved column's value | 34 (final right after the first field) |

Solo adaptations: Moj broj has no opponent to be "closer" than, so the exact (or best
reachable) number is the bar; Ko zna zna uses 10 s per question instead of a buzzer.

## Persistence

- `dnevna-slagalica:progress:v1` — today's scores, reveals and a snapshot of a paused game (survives refresh; the resume button on Home continues it).
- `dnevna-slagalica:history:v1` — `{[day]: {scores, total, finishedAt}}` feeding streaks, stats and the archive. Practice games are never recorded.
