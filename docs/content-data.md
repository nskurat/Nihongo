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
npx tsx scripts/fix-search-data.ts                  # reading fixes that matter for search
npx tsx scripts/dedupe-vocab.ts                     # drop the same word taught twice (食べる beside 食べます)
npm run validate:data
```

Order matters: each level skips list items already taught at a lower level, so a lower
level change can move items out of N2/N1 (whose uids are positional and regenerated).
All take `--dry-run`.

## Rules and decisions

- **Cumulative coverage.** A list item already taught anywhere at a lower level (N5–N3 for
  N5–N2; N5–N2 for N1) is not repeated. One rule for all levels (`isWordCovered` in
  `scripts/lib/jlptContent.ts`): a word counts as taught if its written form matches
  (bracketed usage notes like `迷う [道に〜]` stripped, `／` pairs split), or a textbook
  `-ます` form of it does (書く ↔ 書きます), or it is a kanji spelling of a word we write in
  kana *and* the glosses share a content word (其れ = それ "that", but 肺 ≠ はい "yes").
  Matching on form only, not form + reading, is deliberate: ~80 N1 words that share only a
  spelling with a lower-level word (上手 うわて, 天皇 すめらぎ) are skipped rather than
  pulling in rare readings.
- **Spelling.** Waller writes many usually-kana words with rare kanji (何時も, 其れ,
  お目出度う, 御辞儀). `PREFERRED_SPELLING` in `fetch-jlpt-sources.ts` maps them to the form
  learners meet (いつも, それ, おめでとう, お辞儀); the original stays in `listKanji`.
  Previously appended N5–N3 rows (rows without an example sentence) follow the list's
  current spelling and gloss on the next run, uid unchanged.
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
  (own level first, then easier, then harder). 438 N1 kanji have no list word, so no compounds.
- **No invented example sentences.** Appended words have word/reading/meaning only; filling
  examples is a planned follow-up.
- **Glosses:** JMdict gloss where the word matches, else Waller's definition; 14 rows with
  neither use a hand-written JMdict gloss table in `fetch-jlpt-sources.ts`, and 5 homograph
  readings where the deck copied another reading's gloss (後 うしろ, 上 かみ, 下 げ/しも,
  中 ちゅう) use `GLOSS_OVERRIDES`. Empty comma parts are tidied away.
- **Kanji readings:** kunyomi okurigana marked with `・` (also normalised in the older N5/N4
  rows), prefix/suffix forms and KANJIDIC's katakana unit readings (粉 デシメートル) dropped;
  suffix-only onyomi (応 -ノウ) dropped; radical-name meanings ("branch radical (no. 65)")
  dropped.

## Result (2026-10)

| Level | Kanji | Words | Notes |
|---|---|---|---|
| N5 | 220 | 759 | +500 list words |
| N4 | 299 | 763 | +21 kanji, +463 words |
| N3 | 261 | 3,202 | all 367 N3-list kanji now covered across N5–N3 (was 203); +1,324 words |
| N2 | 260 | 1,588 | new; 107 N2-list kanji, 222 list words already taught lower |
| N1 | 1,174 | 2,859 | new; 58 N1-list kanji, 568 list words already taught lower (N5–N2) |

Known gaps: 148 N4 kanji compounds still have null reading/meaning (they are phrases like
`絵をかきます`, not list words); vocab example sentences for appended words.

## Review (2026-10)

Scripted audit of all five levels (readings format, meanings, strokes/radicals, compound
validity, stroke-order links, empty/garbled glosses, kana readings, duplicates within and
across levels, list coverage, lesson placement) plus a teacher's spot-check of 30 random
items per level. Fixed through the pipeline (no hand edits):

- N1 repeated ~240 basic words in rare kanji spellings (其れ, 此れ, 美味しい, 面白い,
  有難う, 今日は) because the N2/N1 builder ignored kana-written lower rows; N1 also
  re-taught 29 N2 words. Both now skipped (N2 −30 words, N1 −257).
- Kana-only matching had hidden real gaps at N5–N4–N3 (家, 服, 聞く, 席, 幕, 元, 効く…
  were skipped because an unrelated kana word shared the reading); now appended.
- Wrong glosses: `いえ` "TODO same as いいえ?", 後 うしろ "afterwards", 上 かみ / 下 げ /
  下 しも / 中 ちゅう copied from another reading; stray leading/trailing commas.
- Rare spellings as headwords (何時も, お目出度う, 或, 御辞儀, 為る…) → common forms.
- Kanji: `.`-style and affix kunyomi in N5/N4, katakana unit kunyomi, suffix onyomi,
  radical-name meanings in N3, 彗 radical shown as `(?)`.

Residual known issues (judgment calls, left as is):

- N3 appended rows いつも and なる (n3-vocab-12-49, n3-vocab-3-112) duplicate N5 words now
  that their rare spellings are gone; deleting them breaks "append-only". ある
  (n3-vocab-12-38) is the different word "a certain".
- ~25 N1 words are kanji spellings of lower kana words whose glosses don't overlap
  (ふさわしい, よほど, みじめ, おかげ, ございます-style honorifics); and 是非, 大した, 夕べ,
  無くす (N5–N3) were appended in kanji beside an existing kana textbook row.
- Pre-existing textbook duplicates: 8 inside N3 (ちょうど, 取引先, ゼミ, 型…), 3 inside N5,
  and 9 exact word+reading repeats across N5/N4/N3 (必要, 幸せ, チャンス…).
- Waller's N1 list keeps some rare readings that don't collide with a lower form (側 かわ,
  館 たち, 乾 ほし); glosses for 直 なお ("mischief") are odd but sourced.
- 148 N4 compounds are textbook phrases with null reading/meaning (see validator warnings).

## Redundant vocab (2026-10-31)

`scripts/dedupe-vocab.ts` removed 111 rows that taught a word already taught elsewhere
(rules in `scripts/lib/vocabDedupe.ts`): mostly list-derived dictionary forms beside the
textbook ます row (食べる / 食べます — the ます row keeps the example sentence, and search
finds it by its dictionary form), plus exact textbook repeats with the same meaning (必要,
ちょうど, 取引先). Kept on purpose: different usages (先 vs 〜先, 取る [写真を〜] vs
[時間を〜]), homographs with different meanings (かけます "call" / "put on"), and three
reviewed distinct senses (N3 ある "a certain", N5 やる "to do", N3 吹く "play"). Later uids in
the 50 affected lessons were renumbered; `store/aiCacheMigration.ts` (v6) drops cached vocab
notes under shifted uids only.

