# Vendored JLPT reference data

Regenerate with `npx tsx scripts/fetch-jlpt-sources.ts` and `npx tsx scripts/fetch-jmdict-pos.ts`
(both need network). Content scripts read only these files, so they run offline and reproducibly.

| File | Contents |
|---|---|
| `jlpt-kanji.json` | Every kanji on the N5–N1 lists: level, strokes, radical, on/kun readings, meanings |
| `jlpt-vocab.json` | Every word on the N5–N1 lists: level, JMdict id, kanji form, kana, gloss |
| `kangxi-radicals.json` | Kangxi radical → English name (Unicode character names) |
| `jmdict-pos.json` | The 9,610 JMdict entries our vocab can match (every JLPT-list id, plus every entry spelled like a vocab row's head word or its する/な stem): seq, spellings, readings, per-sense part-of-speech codes and English glosses |

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
- **Vocab part of speech** — JMdict (© EDRDG, [CC BY-SA 4.0](https://www.edrdg.org/edrdg/licence.html))
  via the JMdict build in [jamdict-data](https://pypi.org/project/jamdict-data/) 1.5
  ([neocl/jamdict](https://github.com/neocl/jamdict), MIT; JMdict of April 2021), pinned by
  SHA-256 in `fetch-jmdict-pos.ts`. The archive is cached in the OS temp dir; `--db` reads a
  local `jamdict.db` instead. Tags are stored as JMdict entity codes (`v5k`, `adj-na`), so a
  newer JMdict (EDRDG's `JMdict_e`, or jmdict-simplified) can replace the source without
  changing the format. Re-run after a pipeline step adds words, or new rows go unmatched.
