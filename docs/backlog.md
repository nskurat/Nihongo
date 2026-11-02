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
  Every vocab level now carries `pos` (127 rows blank), so producers can pick question types
  by word class: for example, a prefix (再, 超) gets "再 + 開発 → ?" rather than a standalone
  meaning card.
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

- **Rewrite N4 and N3 grammar in our own words (top content item)**: a spot check of
  *Minna no Nihongo* Book II's grammar notes (Lessons 27 and 35) found 11 example sentences
  copied word for word into N4 grammar (lessons 2 and 10), explanations closely reworded
  from the book's English, and the book's さくら大学 (`n4-grammar-3-4`). 104 of the 166 N4
  rows share that shape, across all 25 lessons. N3 hasn't been checked yet. Do each level like
  N5 (`docs/content/n5-restructure.md`): our own lesson order, regrouped vocab, every point
  rewritten, a Japanese-teacher review before merge, then add the level to
  `textbookGuard.test.ts`. The N4 AI prompts still say "Minna no Nihongo Lessons 26–50"
  (`prompts.ts`, `promptBuilder.ts`); that goes with the N4 rewrite.
- **N5 vocab glosses in the book's word-list style**: about 270 core N5 rows keep glosses like
  "climb [a mountain]" and "live [in Osaka]". Single glosses are low risk, but rephrase them
  in a pass of their own (a script over `n5/vocab.json`, no uid changes).

- **Owner's local runs** (`docs/local-data-refresh.md`; need downloads the sandbox can't reach):
  - **§A JMdict refresh**: `pos` comes from the April 2021 JMdict. The plan is to refresh from
    a current jmdict-simplified release and re-label the rows that came from JMdict
    (`--relabel`), never the 571 hand-labelled N5/N4 rows.
  - **§B Vocab examples, N5–N3 only** (the owner decided N2/N1 get none): 2,329 rows have no
    `exampleJp` (N5 528, N4 492, N3 1,309). Tatoeba (CC BY 2.0 FR), no paid AI, and a
    teacher's spot-check before writing. The data must ship together with the per-sentence
    "Tatoeba" link (§7).
- **`pos` gaps**: 127 rows are blank on purpose. They are auxiliaries (はず), ～ずる verbs, names,
  textbook phrases JMdict doesn't list, and 5 homographs (ああ, あの, かく/かける/きく with a [〜]
  note). `scripts/fill-vocab-pos.ts` lists them. Debatable label: 無事 "safely" is `noun`
  (な-adjective would teach 無事に better).
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

## 7. UI

- **Sources & licences dialog**: the app credits none of its CC BY / CC BY-SA sources
  (Waller's lists, EDRDG KANJIDIC/JMdict, kanjium). The PM decision is a footer link that opens
  a `Modal` listing each source, licence and link, with an axe case. It can ship now; spec in
  `docs/local-data-refresh.md` §B "Attribution". The per-sentence "Tatoeba" link on vocab rows
  ships with the example data.
- **Part of speech is never shown**: every vocab row has `pos` now, but the app only uses it
  for search word classes and the AI usage-note prompt. A small label on vocab rows
  (`utils/pos.ts` `posLabel`: "Verb (Group I, godan)", "な-adjective", "Prefix") would help
  learners with conjugation. This needs a UX call on where it goes and whether it follows the
  translation toggle.

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
- A content change that shifts positional uids (dedupe, moves) ships an AI-cache renumbering
  in `store/aiCacheMigration.ts` (`renumberVocabArtifacts`, bump the store version): paid
  results follow their word; a removed row's note goes to its kept twin. Never drop them silently.
- Vitest has two projects: `node` for `*.test.ts`, `jsdom` for `*.test.tsx`. Tests never reach
  the network (`src/test/setup.node.ts`); AI is mocked with `src/test/mockAi.ts`.

## Content validation warnings

_Auto-generated by `npm run validate:data` — do not edit this section by hand._

<!-- validate-content:start -->
_None._
<!-- validate-content:end -->
