# Word data

Two sources, combined into a two-tier dictionary by `node tools/build-dict.mjs`.

## Sources (`data/raw/`, not committed)

| File | Source | Licence | Role |
|---|---|---|---|
| `sr-Latn.dic` | [grakic/hunspell-sr](https://github.com/grakic/hunspell-sr) (dict-sr, Serbian Latin spellchecker; flat list of ~264k word forms) | LGPL 2.1+ / MPL 1.1+ / GPL 2+, or CC BY-SA 3.0 | **core** tier |
| `serbian-words-latin.txt` | [turanjanin/spisak-srpskih-reci](https://github.com/turanjanin/spisak-srpskih-reci) (~2.79M forms merged from many lists) | CC0-1.0 | **extended** tier |

Download:

```
curl -L -o data/raw/sr-Latn.dic https://raw.githubusercontent.com/grakic/hunspell-sr/master/sr-Latn.dic
curl -L -o data/raw/serbian-words-latin.txt https://raw.githubusercontent.com/turanjanin/spisak-srpskih-reci/master/serbian-words-latin.txt
```

## Built dictionary (`data/dict/`, committed)

- `core.txt` — Hunspell forms, lowercase, 3–12 letters, only a–z č ć š ž đ (names and marked forms dropped). ~244k words.
  The generator picks each day's spine word and the "best" answer from here, and every core word is accepted.
- `extended.txt` — CC0-only forms of 5+ letters not in core. ~1.2M words. Accepted as answers so players are not
  punished for legitimate rare inflections, but never used as spine/best (the list has noise). 3–4 letter CC0-only
  entries are almost all junk (abbreviations, onomatopoeia) and are dropped.
- `letter-freq.json` — letter frequency over core, used to top up tile sets.

The browser never loads these files. Each day's puzzle JSON (`src/puzzles/days/NNN.json`) carries only the words
spellable from that day's 12 tiles. Attribution for the Hunspell-derived words: dict-sr by Goran Rakić and
contributors, CC BY-SA 3.0.
