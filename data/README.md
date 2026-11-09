# Word data

The Slagalica dictionary has two levels:

- **Set word** (the computer's word, and the spine a day's tiles are built from): TV rules, dictionary
  head-words only (nouns in nominative singular or plural, verbs in infinitive, adjectives in masculine
  singular nominative positive, indefinite or definite, passive verbal adjectives like blokiran, plus
  adverbs, pronouns, numerals and other invariable words).
- **Accepted answers**: more lenient than TV, by decision of 2026-11-09. Every attested form of a real
  Serbian word counts (blokirane, kućama, pisao, najbolji), so the game never rejects a legitimate word.

Never accepted: proper names, abbreviations, ijekavian or Croatian-only words.
Built by `node tools/build-dict.mjs` (`npm run dict`).

## Sources (`data/raw/`, not committed)

| File | Source | Licence | Role |
|---|---|---|---|
| `srLex_v1.3.gz` | [srLex 1.3](https://www.clarin.si/repository/xmlui/handle/11356/1233) (CLARIN.SI): Serbian inflectional lexicon, ~6.9M rows of form / lemma / MSD tag / srWaC frequency | CC BY-SA 4.0 | the dictionary |
| `hrLex_v1.3.gz` | [hrLex 1.3](https://www.clarin.si/repository/xmlui/handle/11356/1232) (CLARIN.SI): the Croatian counterpart | CC BY-SA 4.0 | filter only (see below) |

Download:

```
curl -L -o data/raw/srLex_v1.3.gz "https://www.clarin.si/repository/xmlui/bitstream/handle/11356/1233/srLex_v1.3.gz?sequence=3&isAllowed=y"
curl -L -o data/raw/hrLex_v1.3.gz "https://www.clarin.si/repository/xmlui/bitstream/handle/11356/1232/hrLex_v1.3.gz?sequence=1&isAllowed=y"
```

## How a word is selected

1. The row's form must equal its lemma (so `kuća` passes, `kuće` does not; `lijep` has lemma `lep`
   and is dropped, as are `ljudi`, `napisan`, `najlepši`).
2. The MSD tag must be one Slagalica accepts: `Nc.sn` (common noun, nom. sg.) or `Nc.pn` when the
   lemma itself is plural (makaze, vrata, naočare), `V.n` (infinitive), `A[gs]pmsn` (adjective,
   positive, masc. sg. nom.), `R` (adverb), `P M S C Q I` (pronoun, numeral, preposition,
   conjunction, particle, interjection). Proper nouns (`Np`), abbreviations (`Y`) and residuals are out.
   The nominative plural (`Nc.pn`) of every accepted common noun is added too (rukav → rukavi,
   čovek → ljudi), tiered by its own corpus count, and so are masculine singular nominative forms
   srLex files under another lemma: definite adjectives (`Agpmsny`: veliki, lokalni) and passive
   verbal adjectives (`Appmsn`: blokiran, blokirani).
   Every other form of a lexical word (any tag but `Np`, `Y`, `X`) seen at least once in srWaC goes
   to `forms.txt` (3-letter forms need 50 occurrences, 4-letter 10).
3. Only a–z č ć š ž đ (no q w x y), 3–12 letters, no Roman numerals.
4. Croatian filter: srWaC contains Croatian text, so srLex lists `tjedan`, `obitelj`, `također`...
   as Serbian lemmas. A word is dropped when its per-token frequency in hrWaC is at least
   `MAX_HR_RATIO` (16) times its frequency in srWaC. Genuinely shared words (kuhinja, otok, kat,
   kolovoz) sit far below that; Croatian-only words sit at 30–400. Both sides use the form's total
   count over all its readings (obzir is mostly tagged accusative, so its nominative row alone made
   it look Croatian).
5. Ijekavian filter: srLex maps most ijekavian forms to an ekavian lemma, but some are their own
   lemma (ljetopisac, savjesno, cvijet). A word is dropped when turning one "ije"/"je" (not at the
   start of the word) into "e" gives another head-word (letopisac, savesno, cvet). An inflected form
   is dropped when all its lemmas are such ijekavian head-words (cvijeta), or when its "e" twin is a
   form of the same lemma(s) (lijepe → lepe; njega stays because it is also a form of on).
   Comparatives in -ije (lošije, toplije) are exempt. `node tools/build-dict.mjs --dropped` writes
   every dropped form to `data/raw/dropped-forms.txt` for review.
6. `data/dict/block.txt` removes what the filters miss (tko, točka, pisač, djed) plus junk
   interjections and abbreviations; `data/dict/allow.txt` always adds its words to core: head-words
   srLex files under another lemma but Rečnik Matice srpske lists separately (ljudi, deca), common
   words srLex lacks (injekcija, odžak) and Serbian words the ijekavian rule would wrongly drop
   (hijena, premijera, odeljenje, ptičje). Both are hand-kept, one word per line, `#` for comments.
7. Length is counted in alphabet letters: LJ, NJ and DŽ are one letter (`src/engine/letters.js`), so a
   word may have up to 15 characters but at most 12 letters. `letter-freq.json` counts them as letters too.

## Built dictionary (`data/dict/`, committed)

- `core.txt`: head-words and plurals seen at least 3 times in srWaC (3-letter words need 50, 4-letter
  10, since short rare "lemmas" are mostly noise). ~69k words. The generator picks each day's spine
  word and the "best" answer from here, and every core word is accepted.
- `extended.txt`: head-words seen once or twice. ~12k words. Accepted as answers but never used as
  spine/best. Words with zero corpus occurrences (rule-generated possessives like `krletkin`) are dropped.
- `forms.txt`: every other attested form. ~320k words. Accepted as answers, never spine/best.
- `letter-freq.json`: letter frequency over core, used to top up tile sets.

The browser never loads these files. Each day's puzzle JSON (`src/puzzles/days/NNN.json`) carries only
the words spellable from that day's 12 tiles (typically 500–2500 words). After changing the dictionary
run `node tools/gen-days.mjs 1 366 --rewords --only=slagalica`: it keeps every day's tiles and only
refreshes the accepted words and the set word. `--force --only=slagalica` regenerates the tiles too,
which changes every day's puzzle (needed only when a day's set word becomes too short; the tests catch it).

Attribution: srLex and hrLex by Nikola Ljubešić et al., CLARIN.SI, CC BY-SA 4.0.
