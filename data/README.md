# Word data

The Slagalica dictionary has two levels:

- **Set word** (the computer's word, and the spine a day's tiles are built from): TV rules, dictionary
  head-words only (nouns in nominative singular or plural, verbs in infinitive, adjectives in masculine
  singular nominative positive, indefinite or definite, passive verbal adjectives like blokiran, plus
  adverbs, pronouns, numerals and other invariable words).
- **Accepted answers**: more lenient than TV, by decision of 2026-11-09. Every attested form of a real
  Serbian word counts (blokirane, kućama, pisao, najbolji), so the game never rejects a legitimate word.
  Since 2026-11-10 this also takes in the Hunspell and CC0 word lists (`extra.txt`), for words srLex
  lacks (đon) or never saw in its corpus.

Never accepted: proper names, abbreviations, ijekavian or Croatian-only words.
Built by `node tools/build-dict.mjs` (`npm run dict`).

## Sources (`data/raw/`, not committed)

| File | Source | Licence | Role |
|---|---|---|---|
| `srLex_v1.3.gz` | [srLex 1.3](https://www.clarin.si/repository/xmlui/handle/11356/1233) (CLARIN.SI): Serbian inflectional lexicon, ~6.9M rows of form / lemma / MSD tag / srWaC frequency | CC BY-SA 4.0 | the dictionary |
| `hrLex_v1.3.gz` | [hrLex 1.3](https://www.clarin.si/repository/xmlui/handle/11356/1232) (CLARIN.SI): the Croatian counterpart | CC BY-SA 4.0 | filter only (see below) |
| `sr-Latn.dic` | [grakic/hunspell-sr](https://github.com/grakic/hunspell-sr) (Serbian Latin spellchecker, ~264k forms) | LGPL 2.1+ / MPL 1.1+ / GPL 2+, or CC BY-SA 3.0 | `extra.txt` |
| `serbian-words-latin.txt` | [turanjanin/spisak-srpskih-reci](https://github.com/turanjanin/spisak-srpskih-reci) (~2.79M forms merged from many lists) | CC0-1.0 | `extra.txt` |

Download:

```
curl -L -o data/raw/srLex_v1.3.gz "https://www.clarin.si/repository/xmlui/bitstream/handle/11356/1233/srLex_v1.3.gz?sequence=3&isAllowed=y"
curl -L -o data/raw/hrLex_v1.3.gz "https://www.clarin.si/repository/xmlui/bitstream/handle/11356/1232/hrLex_v1.3.gz?sequence=1&isAllowed=y"
curl -L -o data/raw/sr-Latn.dic https://raw.githubusercontent.com/grakic/hunspell-sr/master/sr-Latn.dic
curl -L -o data/raw/serbian-words-latin.txt https://raw.githubusercontent.com/turanjanin/spisak-srpskih-reci/master/serbian-words-latin.txt
```

The build needs a bigger heap for the two lists; `npm run dict` passes `--max-old-space-size=8192`.

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
   (hijena, premijera, odeljenje, ptičje), real words the proper-noun filter would drop (vučić, novak,
   njutn), and words srLex lacks entirely (đon). Both are hand-kept, one word per line, `#` for comments.
7. Proper nouns are never accepted (since 2026-11-10). srLex tags names `Np` and writes them
   capitalised, but files some as lower-case common nouns too (srbija, ivan, vojvodina). A form srLex
   knows as a common word is dropped when srWaC has it as a proper noun at least `MAX_NAME_RATIO` (10)
   times more often; words that are both stay (nada 5612/5099, vuk, zora, sunce), and so does a case
   form of an accepted word (bugarskoj for bugarski, rimu for rima). A word srLex does not know as a
   common word is dropped when any source has it as a name (srLex or hrLex `Np`, or a capitalised entry
   in the Hunspell/CC0 lists: garibaldi, čulić). `data/dict/names.txt` lists names of peoples and
   inhabitants, which are written capitalised (nemac, srbin, beograđanin); they and all their forms
   are out. `--dropped` writes every dropped name to `data/raw/dropped-names.txt`.
8. `extra.txt` takes every remaining word of the Hunspell and CC0 lists (both mix in Croatian and
   ijekavian words: tko, tjedan, lijepo, ljeto), filtered: nothing the rules above dropped comes back,
   nor proper names or abbreviations; a form srLex knows goes through the same Croatian and ijekavian
   tests; a form srLex does not know is dropped as Croatian when hrWaC has it about 20 times or more,
   and as ijekavian when turning a non-initial "ije"/"je" into "e" gives a known word (a final "ije"
   and "je" after l/n are exempt: zelenije, zdravlje). CC0-only words of 3–4 letters (mostly
   abbreviations) are dropped.
9. Length is counted in alphabet letters: LJ, NJ and DŽ are one letter (`src/engine/letters.js`), so a
   word may have up to 15 characters but at most 12 letters. `letter-freq.json` counts them as letters too.

## Built dictionary (`data/dict/`, committed)

- `core.txt`: head-words and plurals seen at least 3 times in srWaC (3-letter words need 50, 4-letter
  10, since short rare "lemmas" are mostly noise). ~69k words. The generator picks each day's spine
  word and the "best" answer from here, and every core word is accepted.
- `extended.txt`: head-words seen once or twice. ~12k words. Accepted as answers but never used as
  spine/best. Words with zero corpus occurrences (rule-generated possessives like `krletkin`) are dropped.
- `forms.txt`: every other attested form. ~320k words. Accepted as answers, never spine/best.
- `extra.txt`: Hunspell and CC0 words not in the files above. ~1.1M words. Accepted as answers, never
  spine/best. The lists still carry some noise (rare loan forms, surnames written in lower case); that
  only makes the game more lenient, it never picks them.
- `letter-freq.json`: letter frequency over core, used to top up tile sets.

The browser never loads these files. Each day's puzzle JSON (`src/puzzles/days/NNN.json`) carries only
the words spellable from that day's 12 tiles (typically 1000–4000 words). After changing the dictionary
run `node tools/gen-days.mjs 1 366 --rewords --only=slagalica`: it keeps every day's tiles and only
refreshes the accepted words and the set word. `--force --only=slagalica` regenerates the tiles too,
which changes every day's puzzle (needed only when a day's set word becomes too short; the tests catch it).

Attribution: srLex and hrLex by Nikola Ljubešić et al., CLARIN.SI, CC BY-SA 4.0. Hunspell-derived words:
dict-sr by Goran Rakić and contributors, CC BY-SA 3.0. The CC0 list: turanjanin/spisak-srpskih-reci.
