# Vendored JLPT reference data

Regenerate with `npx tsx scripts/fetch-jlpt-sources.ts` (needs network). Content scripts
read only these files, so they run offline and reproducibly.

| File | Contents |
|---|---|
| `jlpt-kanji.json` | Every kanji on the N5–N1 lists: level, strokes, radical, on/kun readings, meanings |
| `jlpt-vocab.json` | Every word on the N5–N1 lists: level, JMdict id, kanji form, kana, gloss |
| `kangxi-radicals.json` | Kangxi radical → English name (Unicode character names) |

## Sources and attribution

- **JLPT levels** — Jonathan Waller, [JLPT Resources](http://www.tanos.co.uk/jlpt/), CC BY.
  There is no official JLPT list since 2010; Waller's lists are the de-facto reference
  (jisho.org uses them). Kanji levels taken via
  [davidluzgouveia/kanji-data](https://github.com/davidluzgouveia/kanji-data) (`jlpt_new`, MIT);
  vocab via [stephenmk/yomitan-jlpt-vocab](https://github.com/stephenmk/yomitan-jlpt-vocab),
  which keys each of Waller's words to its JMdict entry and replaces rare spellings.
- **Kanji details** — KANJIDIC / KRADFILE (© EDRDG, CC BY-SA) via
  [mifunetoshiro/kanjium](https://github.com/mifunetoshiro/kanjium) (CC BY-SA 4.0).
- **Vocab glosses** — JMdict (© EDRDG, CC BY-SA) via
  [jamsinclair/open-anki-jlpt-decks](https://github.com/jamsinclair/open-anki-jlpt-decks);
  Waller's own definition where no match.
