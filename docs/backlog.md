# Backlog

The one tracker for open work: what is left to build, known issues, deferred ideas. When
something is done, delete it here; the PR carries the record. Finished refactor phases
(0–5, 7) and their specs live in git history (`git log -- docs/refactor/`).

Anything out of scope that you notice while working goes here as a short entry: what, where,
why it matters. Items parked for the far future are in `docs/backlog-later.md`, which regular
work doesn't need to read.

## 1. Flashcards and quizzes (next feature, formerly Phase 6)

**Design first, not an execution spec.** Write the spec (tasks, acceptance, deviations)
before building. Every earlier phase exists to make this cheap: `uid` gives review state
something to hang on, the content repository gives decks a query surface, the test harness
makes a scheduler safe to change, `Modal`/`SectionLayout` give a quiz somewhere to render.

Shape being aimed at:

- `services/progress/` — same adapter shape as `readingStorage`: `recordReview(uid, grade)`,
  `getDue(scope)`, `getStats()`. localStorage now, database later, no caller changes.
- `srs.ts` — scheduling as a pure, unit-tested module with no React and no storage.
- A deck is a *query* over `ContentSource` (one lesson, a level, a tag facet, everything
  due), so flashcards need no new content. (`StaticContentSource.search` is kept for this.)
- One `Question` type with several producers — vocab meaning, kanji reading, grammar
  cloze, and the existing AI reading comprehension as one producer among them. A shared
  `QuizRunner` renders all of them.
- Routes `/:level/flashcards/:deck` and `/:level/quiz/:mode`, so sessions are linkable
  and resumable, with `React.lazy` per section route.
- New pages and dialogs get cases in `src/__tests__/a11y.test.tsx`; the bundle budget
  (`scripts/lib/bundleBudget.ts`) still has to pass.

Decisions to make before writing the spec:

- Scheduling algorithm: SM-2 or FSRS-lite. Affects the progress record shape, so decide
  before `services/progress/` is written.
- Does a quiz session persist mid-run, or is it lost on refresh?
- Do flashcards and quizzes share one progress record per uid, or separate streams?
- Is any of this AI-generated on the fly, or all derived from existing content? (Cost and
  offline behaviour both hinge on this.)

## 2. Accessibility

- **Search results listbox** — `features/search/ResultGroup.tsx` puts each group's `<h2>`
  inside `#search-results` (`role="listbox"`); ARIA allows only `group`/`option` there, so axe
  reports `aria-required-children` (critical). The layout is the one `docs/search/03-ux.md`
  §3.2 specifies, so the fix is a search-UX decision (heading out of the listbox, or
  `role="presentation"` on it and the group named by `aria-label`). `src/__tests__/a11y.test.tsx`
  exempts that one rule on the search page; remove the exemption with the fix. The browser run
  found the same in the tag view (`<h3>` level subheadings); see Search R12.
- **Colour contrast** (the axe gate can't measure it in jsdom). From the Tailwind palette:
  `text-slate-400` helper text on white (≈2.6:1; AA needs 4.5:1) in `GeneratorPanel.tsx` and
  the `SectionLayout.tsx` banner subtitle; `text-indigo-200` header copy and idle section tabs
  on `bg-indigo-600` (4.32:1 measured in Chromium, 2026-11-01). A palette change across sections — a design decision.
- **Manual pass not yet run** — the checklist in `docs/a11y.md` (screen reader, 200% zoom,
  320 px, reduced motion) has not been walked end to end.

## 3. Search

Browser regression by QA and the teacher, 2026-11-01: `docs/search/07-regression.md` (evidence,
proposed fixes, IDs). Awaiting the owner's review, then implementation.

- **Decisions first**:
  - D1: must core N4/N5 words make the visible top 8 (T-37 `lost`)?
  - D2: should Grammar lead when the query equals a grammar key (`みたい`, `ます`)?
  - D3: are rare exact hits ranked by level (分 → Edo coin)?
  - D4: where do new N5 rows go (日本語, greetings)?
  - D5: sign-off of the `が`/`けど` core keys.
- **Must**:
  - R1: category-chip members outrank direct meaning hits (`as soon as`, `according to`, `even`).
  - R2: the group order lets kanji or a contained grammar key lead over the exact word
    (`たべる`, `いくら`, `だれ`).
  - R3: kana readings of kanji grammar titles aren't searchable (`うえで`, `しだい`, `ぎみ`).
  - R4: plain-form look-ups miss ます/です grammar (`たほうがいい`, `かもしれない`).
  - R5: `いく` → いい "adverbial" is a wrong lemma; `ii` reads as English.
  - R6: homophones ignore level (`いる` → 炒る above います).
  - R7: 行く N5 L4 is stored with the reading ゆく (content).
  - R8: 日本語 and the N5 greetings are missing (content).
- **Should**:
  - R9: "kanji in <phrase>" noise.
  - R10: short-kana substring noise (`すき`, `さい`, `だけ`).
  - R11: the lemma reason line should show the dictionary-form word.
  - R12: axe label mismatch on level filters, and headings in the listbox.
  - R13: an exact grammar key loses to vocab.
  - R14: English matches inside other words (`want` → "Word(s) ですか").
- **Nice**:
  - R15: grammar gaps (〜わりに, 〜なんか／〜なんて, なきゃ).
  - R16: 8 vocab meanings with JMdict part-of-speech markers.
  - R17: rare exact hits lead (分 → 分(ぶ)).
  - Radical filter (teacher F13).
  - Respelling 斯う/然る (teacher F12).
- **Spec housekeeping**: amend T-02, T-03, T-27, T-28 and T-41 in `02-requirements.md` §5 (the
  content cleanups changed them; list in the report).

## 4. Content data

Rows in `src/data/*.json` are generated: fixes go through `scripts/`, never by hand.

- **N4 kanji compounds** — `n4/kanji.json` has `compounds[]` entries with a literal `null`
  `reading` and/or `meaning` (full list in the last section). Code is safe (typed nullable, card
  shows `—`, mnemonic prompt skips them) but the rows need real content.
- **Vocab examples** — list-derived vocab rows (~5,000 across N5–N1) have no `exampleJp`;
  the owner chose to fill example sentences later.
- **Vocab `pos` + lemma (v2 migration)** — `pos` exists only on N5/N4 (559 rows) in 30+
  spellings (`verb` ×83 with no group). ます → dictionary-form lemmas are inferred at build
  time; the derived table (240 rows) is in `src/generated/search/search-index-report.tsv`
  for teacher review before a migration adds a closed `pos` enum + `lemma`.
- **Readings with brackets** — 206 rows in `{n5,n3}/vocab.json` carry brackets inside
  `reading` (`[お]はなみ`, `きれい[な]`, `かける [迷惑を〜]`) while others store a clean reading.
  Search strips both; a script could make `reading` mirror the word's annotations.
- **Vocab near-repeats** — textbook pairs with differently worded glosses: チャンス (N5/N3),
  幸せ (N4/N3), めったに ×2 and しっかり ×2 (N3); ~25 N1 kanji spellings of lower kana words
  whose glosses don't overlap (ふさわしい, よほど, みじめ…); 是非, 大した, 夕べ, 無くす appended in
  kanji beside a kana textbook row. Needs a hand list (JMdict "usually kana" data is not
  reachable from the sandbox).
- **Bare N5 kun readings** — 日 か, 一 ひと, 小 お, 真 ま, 千 ち are real but bare prefix/counter
  forms, kept on purpose by `scripts/fix-search-data.ts`; a fuller KANJIDIC refresh could
  add `ひと・つ` etc.
- **Kept on purpose (no action unless the policy changes)** — `n5/kanji.json` holds 122
  N4-list kanji and `n4/kanji.json` 169 N3-list and 85 N2/N1-list kanji vs Waller's lists;
  `n3/kanji.json` keeps 77 N2/N1 kanji from the textbook lessons
  (`scripts/review-n3-kanji-vocab.ts` prints them). Moving them would renumber lessons people
  have studied.

## 5. AI

- **Models** — live "Refresh models" in AI settings (PM P2 in `docs/ai-model-listing.md`;
  the catalog only changes via `npm run update:models`); optionally a weekly GitHub Action
  that runs it and opens a PR. OpenAI reasoning models still get a `system` message and
  `response_format: json_object` (believed fine, unverified).
- **Prompts** (`docs/ai-prompts-review.md`, `docs/reading-prompt-review.md`) — level ceilings
  are instructions only; checking generated kanji against the N5/N4 lists in code would catch
  slips. Kanji mnemonics would improve with component data for rarer N2/N1 kanji. AI example
  sentences show no furigana (needs `FuriganaText` + bracket notation).

## 6. Reading Practice

From `docs/reading-library-nav-ux.md`: a "your N3 passage is ready" notice when a
generation finishes on another level; per-level history switcher; story id in the URL;
per-level furigana/English toggles; library filter by in-progress.

## 7. Code housekeeping

- `scripts/lib/searchDataFixes.ts` — the `n3-vocab-23-124` 言う reading fix is obsolete (the
  row now names 行き), so `fix-search-data.ts` prints a harmless "skipped" line each run. Drop
  the entry and its test fixture next time the table is touched.

## Settled decisions

These hold for all remaining work. Do not revisit them without the owner.

- Base path comes from `VITE_BASE_PATH`, defaulting to `/Nihongo/`. Router basename is
  `import.meta.env.BASE_URL`. Never a literal. (Phase 2 removed the
  `vite-plugin-singlefile` workaround that once made this necessary.)
- Item key is `uid`, formatted `{level}-{section}-{lesson}-{n}`, lowercase — e.g.
  `n5-grammar-1-1`. Globally unique, usable as a database primary key. The legacy `id`
  field is gone.
- Content is reached **only** through `contentRepository`. No component or hook imports
  `src/data/**` directly. The one exception is `utils/tags.ts` → `tag-taxonomy.json`: a
  facet taxonomy, not per-lesson `StudyItem` content, deliberately outside the abstraction.
- Content stays in per-level, per-section JSON files. No merge into one file.
- Storage abstractions follow `services/ai/readingStorage.ts` and
  `services/content/ContentSource.ts`: an abstract base class, an async facade, and a
  swap function. Same shape for progress (section 1).
- AI results live in one artifact cache (`services/ai/artifactCache.ts`, store
  `useAiArtifactStore`); a feature adds an `ArtifactKind` and uses `useAiArtifacts(kind)`.
  AI failures are `AiError`s; show them with `aiErrorMessage`.
- Dialogs use `components/common/Modal.tsx` (native `<dialog>`); study sections render
  through `components/layout/SectionLayout.tsx`, coloured by `sectionTheme` (complete
  Tailwind class literals, never interpolated).
- Markdown styling uses the existing `.markdown-prose` rules in `index.css`.
  No `@tailwindcss/typography` dependency.
- Sanitizer is `dompurify` v3.
- Accessibility: axe-core in the jsdom project (`src/test/axe.ts`) gates every page and dialog;
  contrast and screen readers are a manual checklist (`docs/a11y.md`). Bundle budget is
  `scripts/lib/bundleBudget.ts`, checked against a local build — no preview deploy.
- Vitest has two projects: `node` for `*.test.ts`, `jsdom` for `*.test.tsx`. Tests never reach
  the network (`src/test/setup.node.ts`); AI is mocked with `src/test/mockAi.ts`.

## Content validation warnings

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
