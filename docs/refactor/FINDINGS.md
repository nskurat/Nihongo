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
- `src/data/n4/kanji.json` — 150 `compounds[]` entries have a literal `null` for
  `reading` and/or `meaning` instead of a string (found by Phase 1's content
  validator). Code is safe since Phase 2b (`KanjiCompound` fields typed nullable, card
  shows `—`, mnemonic prompt skips them) but the rows need real content. Full list in
  the auto-generated section below.

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

### Code (found running Phase 2b, 2026-11-01)

- `scripts/lib/searchDataFixes.ts` — the `n3-vocab-23-124` 言う reading fix is obsolete:
  the 2026-11-01 cumulative-coverage run removed that 言う row, so the uid now names 行き and
  `fix-search-data.ts` prints a harmless "skipped" line each run. Drop the entry (and its
  test fixture) next time the table is touched.

### Accessibility (found running Phase 7, 2026-11-01)

- **Search results listbox** — `features/search/ResultGroup.tsx` puts each group's `<h2>`
  inside `#search-results` (`role="listbox"`); ARIA allows only `group`/`option` there, so axe
  reports `aria-required-children` (critical). The layout is the one `docs/search/03-ux.md`
  §3.2 specifies, so the fix is a search-UX decision (e.g. heading out of the listbox, or
  `role="presentation"` on it and the group named by `aria-label`). `src/__tests__/a11y.test.tsx`
  exempts that one rule on the search page until then; remove the exemption with the fix.
- **Colour contrast is unchecked by the gate** — jsdom can't compute it. Measured from the
  Tailwind palette: `text-slate-400` helper text on white (≈2.6:1; AA needs 4.5:1) in
  `GeneratorPanel.tsx` and the `SectionLayout.tsx` banner subtitle, and `text-indigo-200`
  header copy and idle section tabs on `bg-indigo-600` (≈4.2:1). Not fixed: a palette change
  across sections is a design decision, not a gate.

### Backlog (deferred during the 2026-10-31/11-01 sessions)

- **Vocab examples** — list-derived vocab rows (~5,000 across N5–N1, no `exampleJp`) have
  word/reading/meaning only; the owner chose to fill example sentences later.
- **Vocab near-repeats left in** — textbook pairs with differently worded glosses: チャンス
  (N5/N3), 幸せ (N4/N3), めったに ×2 and しっかり ×2 (N3); ~25 N1 kanji spellings of lower
  kana words whose glosses don't overlap (ふさわしい, よほど, みじめ…); 是非, 大した, 夕べ,
  無くす appended in kanji beside a kana textbook row. Need a hand list (JMdict "usually kana"
  data is not reachable from the sandbox).
- **AI models** — live "Refresh models" in AI settings (PM P2 in `docs/ai-model-listing.md`;
  the catalog only changes via `npm run update:models`); optionally a weekly GitHub Action that
  runs it and opens a PR. OpenAI reasoning models still get a `system` message and
  `response_format: json_object` (believed fine, unverified).
- **AI prompts** (`docs/ai-prompts-review.md`, `docs/reading-prompt-review.md`) — level ceilings
  are instructions only; checking generated kanji against the N5/N4 lists in code would catch
  slips. Kanji mnemonics would improve with component data for rarer N2/N1 kanji. AI example
  sentences show no furigana (would need `FuriganaText` + bracket notation).
- **Reading Practice** (`docs/reading-library-nav-ux.md`) — "your N3 passage is ready" notice
  when a generation finishes on another level; per-level history switcher; story id in the
  URL; per-level furigana/English toggles; library filter by in-progress.

## Resolved

- Quick wins (2026-11-01):
  - Google Fonts link removed from `index.html`. Inter was downloaded but never applied
    (35 faces registered, none loaded; text renders in the system stack), so nothing
    changes on screen and the app makes no external request. Adopting Inter would be a
    design change, not a fix.
  - Retry after a failed lesson chunk reloads the page: browsers keep a failed `import()`
    in the module map, so re-importing never worked. Verified in Playwright (blocked
    `n3/kanji.json`, unblocked, Retry → same lesson loads).
  - `scripts/` is typechecked (`tsconfig.json` include); it was already clean.
  - `~さん` → `〜さん` via a general title rule in `fix-search-data.ts` (one row changed).
  - Reading's two code-reviewed criteria (result after a mid-generation level switch,
    errors staying on their level) now have tests.
  - `SearchPage.tsx` split (428 → 287 lines, panels in `SearchPanels.tsx`); no component
    is over 400 lines.
- Phase 5 (2026-11-01): AI failures other than a missing key were only logged, so a
  grammar/vocab/kanji AI button just stopped spinning; they now show inline with what to
  do. Unusable grammar-example replies (previously a silent no-op after a paid call) are a
  visible error. The persisted AI cache is capped (400 entries / ~1 MB).
- Phase 4 (2026-11-01): `Modal` on native `<dialog>` (focus trap, Escape, scroll lock,
  focus return) for all three dialogs; `SectionLayout` + `sectionTheme` for grammar, vocab
  and kanji; `ReadingSection` split (1,228 → 93 lines) with one shared `QuestionList`;
  header tabs from `utils/sections.ts`. Two items from the Phase 2b findings closed with it:
  the sidebar heading no longer shows a fake `(1–1)` while loading or failed, and Reading
  shows an alert when its lessons fail to load.
- Phase 3 (2026-11-01): test harness and characterization tests landed. Folded in from the
  tooling backlog: `npm run lint` now covers `scripts/` (rest-sibling omits allowed),
  `scripts/lib/searchDataFixes.ts` has unit tests, `docs/search/04-data.md` names
  `services/search/indexer/`.
- Phase 2b (2026-11-01): lesson lists guarded against errors and stale levels
  (`features/useLessonList.ts`, `useReadingData.ts`), list errors reach the section's
  error panel, `KanjiCompound` typed nullable — which also fixed a live crash: the kanji
  mnemonic prompt called `.replace` on a `null` compound reading for 150 N4 kanji —
  `getContentSource()` removed, `ContentSource` doc comment and `AGENTS.md` corrected.
- CI now runs typecheck, lint, tests, `validate:data` and build on every pull request
  (`.github/workflows/ci.yml`); previously only on push to `main`.

- `scripts/fill-n5-n4-gaps.ts` coverage is now cumulative (level and below); N5 +72, N4 +78
  words, incl. the 8 N5 words the 2026-10-31 dedupe had left only in N4.

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
