# Kanji & vocabulary content: sources, pipeline, decisions

How `grammar-app/src/data/*/{kanji,vocab}.json` were built and the rules to keep when
changing them. Grammar is authored separately (`scripts/add-grammar-items.ts`).

## Sources

There is no official JLPT list since 2010. We use Jonathan Waller's lists (tanos.co.uk,
CC BY) — the de-facto reference jisho.org also uses — with KANJIDIC/KRADFILE for kanji
details and JMdict for glosses. Vendored, trimmed copies live in `scripts/sources/`
(provenance and licences in its README), so every content script runs offline.

## Pipeline (run in this order; each step is deterministic and idempotent)

```
npx tsx scripts/fetch-jlpt-sources.ts              # only to refresh scripts/sources/ (network)
npx tsx scripts/fill-n5-n4-gaps.ts                  # append missing N5/N4-list kanji + words
npx tsx scripts/review-n3-kanji-vocab.ts            # repair N3 kanji, append missing N3 items
npx tsx scripts/build-upper-kanji-vocab.ts --level N2   # regenerate N2 kanji + vocab
npx tsx scripts/build-upper-kanji-vocab.ts --level N1   # regenerate N1 kanji + vocab
npm run validate:data
```

Order matters: each level skips list items already taught at a lower level, so a lower
level change can move items out of N2/N1 (whose uids are positional and regenerated).
All take `--dry-run`.

## Rules and decisions

- **Cumulative coverage.** A list item already taught anywhere at a lower level is not
  repeated. A word counts as taught if its written form matches (bracketed usage notes like
  `迷う [道に〜]` stripped), or its kana form matches a kana-written word. Matching on form
  only, not form + reading, is deliberate: ~50 N1 words that share only a spelling with a
  lower-level word (上手 うわて, 社 やしろ) are skipped rather than pulling in rare readings.
- **N5–N3 existing items are never moved or renumbered**; new items are appended, so
  uids (AI-cache keys) stay stable. Exception: the N3 review reused 24 kanji slots that held
  repeats; `store/aiCacheMigration.ts` drops cached mnemonics for exactly those uids.
- **N5/N4 kanji files don't match Waller's levels** (the N5 file holds 122 N4-list kanji, the
  N4 file 169 N3-list and 85 N2/N1-list kanji). Kept on purpose — moving them would reshuffle
  lessons people have studied.
- **N3 keeps 77 textbook kanji that are N2/N1 on the lists** (the lesson vocab uses them);
  N2/N1 therefore skip them.
- **Placement:** N5–N3 additions go to the first lesson whose vocab uses the kanji (else the
  emptiest lesson); words go to the lesson that teaches their earliest kanji at that level
  (else the emptiest lesson). N2/N1 kanji are split evenly by frequency; words follow their
  kanji, the rest fill the emptiest lessons — so late N1 lessons are mostly words not tied to
  that lesson's kanji.
- **Kanji fields:** meaning = first 3–4 KANJIDIC meanings; radical as `辶 (walk)` (Kangxi
  names); prefix/suffix kunyomi (`-び`, `こ-`) dropped; `compounds` are real list words only
  (own level first, then easier, then harder). 437 N1 kanji have no list word, so no compounds.
- **No invented example sentences.** Appended words have word/reading/meaning only; filling
  examples is a planned follow-up.
- **Glosses:** JMdict gloss where the word matches, else Waller's definition; 13 rows with
  neither use a hand-written JMdict gloss table in `fetch-jlpt-sources.ts`.

## Result (2026-10)

| Level | Kanji | Words | Notes |
|---|---|---|---|
| N5 | 220 | 753 | +494 list words |
| N4 | 299 | 761 | +21 kanji, +461 words |
| N3 | 261 | 3,189 | all 367 N3-list kanji now covered across N5–N3 (was 203); +1,311 words |
| N2 | 260 | 1,618 | new; 107 N2-list kanji already taught lower |
| N1 | 1,174 | 3,116 | new; 58 N1-list kanji already taught lower |

Known gaps: 150 N4 kanji compounds still have null reading/meaning (they are phrases like
`絵をかきます`, not list words); vocab example sentences for appended words.
