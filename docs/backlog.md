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

- **Colour contrast** (the axe gate can't measure it in jsdom). From the Tailwind palette:
  `text-slate-400` helper text on white (≈2.6:1; AA needs 4.5:1) in `GeneratorPanel.tsx` and
  the `SectionLayout.tsx` banner subtitle; `text-indigo-200` header copy and idle section tabs
  on `bg-indigo-600` (4.32:1 measured in Chromium, 2026-11-01). A palette change across sections — a design decision.
- **Manual pass not yet run** — the checklist in `docs/a11y.md` (screen reader, 200% zoom,
  320 px, reduced motion) has not been walked end to end.

## 3. Search

The 2026-11-01 browser regression (`docs/search/07-regression.md`) is implemented, leftovers
included. Nice to have:

- **Radical filter** for kanji search (teacher F13).
- **Respellings** 斯う/然る (teacher F12): old kanji spellings of こう/そう that a learner may
  paste from older texts.

## 4. Content data

Rows in `src/data/*.json` are generated: fixes go through `scripts/`, never by hand.

- **Vocab examples** — list-derived vocab rows (~5,000 across N5–N1) have no `exampleJp`.
  Writing them by hand is not realistic and generating them would mean paid AI calls from a
  script (not allowed); the owner chose to fill them later. Options: generate in-app on demand
  (the AI usage note already does this per word, at the learner's cost), or an approved,
  reviewed batch run.
- **`pos` / `lemma` on N3–N1** — the closed `pos` set and stored ます lemmas cover N5/N4 (the
  rows that had `pos`). N3–N1 rows are dictionary forms with no `pos`; filling it needs JMdict
  part-of-speech data, which is not vendored (`scripts/sources/`).
- **Kept on purpose (no action unless the policy changes)** — `n5/kanji.json` holds 122
  N4-list kanji and `n4/kanji.json` 169 N3-list and 85 N2/N1-list kanji vs Waller's lists;
  `n3/kanji.json` keeps 77 N2/N1 kanji from the textbook lessons
  (`scripts/review-n3-kanji-vocab.ts` prints them). Moving them would renumber lessons people
  have studied. Bare prefix kun readings (一 ひと, 小 お) stay: no level uses KANJIDIC's
  hyphen markers.

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
_None._
<!-- validate-content:end -->
