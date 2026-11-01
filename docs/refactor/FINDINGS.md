# Findings

Out-of-scope observations noticed while running a phase. One line each: what, where,
why it matters. Do not fix these in-phase — that is what this file is for.

Content warnings emitted by `npm run validate:data` are appended here automatically.

## Open

### Content (need real data, not code changes)

- `src/data/n4/kanji.json`, `src/data/n5/kanji.json` — levels don't match Waller's lists
  (the N5 file holds 122 N4-list kanji, the N4 file 169 N3-list and 85 N2/N1-list kanji).
  Kept as-is on purpose: moving items would renumber lessons people have studied.
- `src/data/n3/kanji.json` — 77 kanji kept from the textbook lessons are N2/N1 on
  Waller's lists (printed by `scripts/review-n3-kanji-vocab.ts`); kept for lesson context.
- `grammar-app/index.html` — Google Fonts is loaded from a CDN, which breaks the
  offline-capable premise of the app. Consider self-hosting Inter.
- `src/data/n4/kanji.json` — 150 `compounds[]` entries have a literal `null` for
  `reading` and/or `meaning` instead of a string (found by Phase 1's content
  validator). No runtime risk today — `KanjiSection.tsx` never renders
  `compound.reading`, and `compound.meaning` renders as nothing when `null` — but
  needs real content to fill in. Full list in the auto-generated section below.

- `scripts/fill-n5-n4-gaps.ts` — counts an N5/N4-list word as taught if *any* of N5–N3
  teaches it, so ~75 core N5 words (今日, 山, 魚, 甘い, 言う, 夜…) and ~79 N4 words taught
  only in a higher level's textbook lessons are missing from N5/N4. Since the 2026-10-31
  dedupe this includes 8 N5 words whose only row is now an N4 ます row (晴れる, 死ぬ, 答える,
  曇る, 呼ぶ, 困る, 頼む, 咲く). Fix: coverage = current level and below; first make
  coverage link rare kanji spellings to kana ます rows (掛かる↔かかります, 居る↔います,
  する↔します) or the fix re-creates duplicates.

### Search (found building the global search index, `docs/search/04-data.md` §7)

- `src/data/{n5,n3}/vocab.json` — 206 rows carry brackets inside `reading` (`[お]はなみ`,
  `きれい[な]`, `かける [迷惑を〜]`) while others store a clean reading (`迷う [道に〜]` →
  `まよう`). The index builder strips both, so search is unaffected; a later script could
  make `reading` mirror the word's annotations consistently.
- `src/data/{n5,n4}/vocab.json` — `pos` exists only on N5/N4 (559 rows) in 30+ spellings
  (`verb` ×83 with no group). ます → dictionary-form lemmas are inferred at build time
  instead; the derived table (240 rows) is written to
  `src/generated/search/search-index-report.tsv` for teacher review before a v2 migration
  adds a closed `pos` enum + `lemma`.
- `src/data/n5/grammar.json` — one title uses ASCII `~さん` among 423 `〜` titles.
  Harmless for search (normalised); an optional `~`→`〜` migration would tidy display.
- `src/data/n5/kanji.json` — some N5 kun readings are still bare prefix/counter forms
  (日 か, 一 ひと, 小 お, 真 ま, 千 ち). Real readings, kept on purpose by
  `scripts/fix-search-data.ts`; a fuller KANJIDIC refresh could add `ひと・つ` etc.
- Kana-only queries for verbs reach every homophone in the data (かえって → 帰る, 変える,
  替える, 換える, 代える, 反る, 返る), so a literal prefix hit such as かえって来ます can
  sit behind "Show all". Without reliable `pos` the godan/ichidan te-form difference
  cannot be used to prune; the v2 `pos` migration would allow it.

- Search fix round 2, deferred (P1-only ship):
  - First search unthrottled desktop is ~0.94 s p75 (budget 0.5 s); Fast 4G + CPU×4 is 1.20 s (ものの) / 1.67 s (食べる) p75. Remaining cost is cold worker indexing; a precomputed key format or lazy per-level indexing would cut it.
  - Teacher review F13 (radical filter), F16 content gaps (日本語, N5 greetings), F12 respelling 斯う/然る — not started.
  - QA BUG-13 "Did you mean kan'i?" (`didYouMean`) and `CategoryChip.description` — not added.
  - QA BUG-12 JMdict POS markers `(n) (a)` inside N1/N2 vocab meanings — content cleanup.
  - `が`/`けど` in the "although" chip list are ranked by curated core keys in `aliases.ts`; the core table needs teacher sign-off.
- Search UI, deferred (P1-only ship):
  - QA BUG-10: warm keystroke → results p95 ~160–200 ms at CPU×4 (target 100 ms); remaining cost is layout/paint of the result list and the page re-render per URL change.
  - QA BUG-17: lemma hits read "わかります → わかる · polite" rather than "→ 分かる (dictionary form)" — depends on the engine's `deinflection`/`via` payload.
  - Mobile: the filter chip row is visually first but later in tab order.
  - Teacher F14: duplicate rows such as 行く/ゆく are not collapsed into one result.
  - Category view shows no description (needs `CategoryChip.description` in the contract).
  - `sannen` (and similar n+vowel romaji) returns nothing when the word isn't in the data; no "did you mean" fallback.
- Not yet re-run after the fix round: QA's full browser regression (T-01…T-47, a11y, perf at Fast 4G/Slow 4G) and the teacher's full battery — only the P1 cases and the 65 golden queries were re-checked (2026-10-31).

### Code (assigned to Phase 2b — see `phase-2b-content-fixes.md`)

Found reviewing the merged Phase 0–2 work, 2026-08-25.

- `features/{grammar,vocab,kanji}/use*.ts` + `features/reading/useReadingData.ts` — the
  `listLessons` / `Promise.all` calls have no `.catch`. A failed chunk leaves the sidebar
  permanently empty and logs an unhandled rejection, while the main area *does* show an
  error via `useContentQuery`. Half-visible failure.
- Same four files — `lessons` / `data` state is not reset when `activeLevel` changes, so
  a first (uncached) level switch briefly renders the previous level's lesson list and a
  wrong range in the header, e.g. `N4 Lessons (1–25)`. `useContentQuery` already solves
  this with key-comparison; the pattern was not applied to the sibling effects.
- `types/japanese.ts` — `KanjiCompound.reading` / `.meaning` are typed `string`, but 150
  entries are `null` at runtime and the zod schema in `validate-content.ts` already models
  them as nullable. No crash today (React renders `null` as nothing) but it is one
  `.toLowerCase()` away from one — and `StaticContentSource.search()` already lowercases
  string values.
- `services/content/StaticContentSource.ts` — `getContentSource()` is exported and never
  called. `contentRepository.search()` is called only from its own test; it should be kept
  for Phase 6 (decks are queries over `ContentSource`) but needs a comment saying so.
- `services/content/ContentSource.ts` — doc comment claims `getItem` never rejects; it
  awaits `loadChunk`, which rejects on a missing or failed chunk.
- `AGENTS.md` — layout map has no `services/content/` entry, and the adapter convention
  still points only at `services/ai/readingStorage.ts`.

## Resolved

- Search data quality (`docs/search/04-data.md` §7 #1, #3, #8) — fixed by
  `scripts/fix-search-data.ts` (tables in `scripts/lib/searchDataFixes.ts`; idempotent,
  uids unchanged): 言う `n3-vocab-23-124` reading ゆう → いう; slash pairs
  `本社（ほんしゃ）／支店`【してん】 and `細い（ほそい）／太い`【ふとい】 → `本社／支店`
  【ほんしゃ／してん】, `細い／太い`【ほそい／ふとい】; 13 N5 kanji with bare kun stems get
  their okurigana back (分 わ → わ・かる, わ・ける; 行 い/おこな → い・く, おこな・う;
  来 く/きた → く・る, きた・る; 学, 会, 休, 去, 自, 転, 動, 後, 生, 半).

- N5/N4 gaps vs Waller's lists — 21 missing N4 kanji and 494 N5 / 461 N4 words
  appended by `scripts/fill-n5-n4-gaps.ts`.

- `src/data/n3/kanji.json` strokes 0 / empty radical / example sentence in `meaning` —
  fixed from KANJIDIC by `scripts/review-n3-kanji-vocab.ts`.

- `grammar-app/src/utils/levels.ts` — N5's LESSON_RANGES capped at lesson 15 while the
  data ran through lesson 25 (confirmed consistent across grammar/vocab/kanji). Fixed in
  Phase 1 rather than deferred further: Task 3's validator checks every item's lesson
  against these ranges as a hard error, so the mismatch would have failed validation on
  25 lessons' worth of legitimate N5 content. `LESSON_RANGES` is now also exported as
  the validator's single source of truth instead of a second hardcoded copy.

## Content Validation Warnings

_Auto-generated by `npm run validate:data` — do not edit this section by hand._

<!-- validate-content:start -->
- grammar-app/src/data/n5/vocab.json#17[9]: meaning is identical to exampleEn
- grammar-app/src/data/n4/kanji.json#1[0]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#2[7]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#2[8]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#2[9]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#2[10]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#2[11]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#2[12]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#3[10]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#3[11]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#4[6]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#4[7]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#4[8]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#4[9]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#5[8]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#5[9]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#5[10]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#6[9]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#6[12]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#6[13]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#7[7]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#7[8]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#7[9]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#7[10]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#7[11]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#7[12]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#7[13]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#8[6]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#8[7]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#8[8]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#8[9]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#8[10]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#9[7]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#9[8]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#9[9]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#10[0]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#10[1]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#10[2]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#10[3]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#10[5]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#10[6]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#10[7]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#10[8]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#10[9]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#11[2]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#11[3]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#11[5]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#11[6]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#11[7]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#11[8]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#11[9]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#11[10]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#11[11]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#11[12]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#11[13]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#11[14]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#12[0]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#12[1]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#12[2]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#12[4]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#12[5]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#13[0]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#13[2]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#13[3]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#13[4]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#13[5]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#13[7]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#13[8]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#13[10]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#13[11]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#14[1]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#14[3]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#14[4]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#14[5]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#14[7]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#14[8]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#15[1]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#15[2]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#15[3]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#15[4]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#15[5]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#15[6]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#15[9]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#15[10]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#15[12]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#15[13]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#16[0]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#16[2]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#16[3]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#16[5]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#16[10]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#16[11]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#17[0]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#17[6]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#17[7]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#17[8]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#17[9]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#18[1]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#18[2]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#18[3]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#18[4]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#18[5]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#18[6]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#18[7]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#18[8]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#18[9]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#19[0]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#19[1]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#19[2]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#19[3]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#19[5]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#19[6]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#19[7]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#19[8]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#19[9]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#20[0]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#20[1]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#20[3]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#20[5]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#20[6]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#21[0]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#21[1]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#21[2]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#21[3]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#21[5]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#21[6]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#21[7]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#22[0]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#22[2]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#22[5]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#22[6]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#22[7]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#23[2]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#23[4]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#23[5]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#23[6]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#23[7]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#23[8]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#24[3]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#24[4]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#24[5]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#24[6]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#24[7]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#24[8]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#24[9]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#25[3]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#25[7]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#25[8]: compounds[0] has a null reading and/or meaning
- grammar-app/src/data/n4/kanji.json#25[9]: compounds[0] has a null reading and/or meaning
<!-- validate-content:end -->
