# Refactor: phases and protocol

This directory holds the executable plan. Only phases that still have work keep a spec —
finished phases are summarised below and live on in git history and their PRs.

## Protocol for an agent running a phase

1. Read `/AGENTS.md` and **this file**, then **only your phase's spec**. Do not read
   other phase specs — they are out of scope and cost context.
2. Work on a branch: `refactor/phase-N-slug`. Commit in the increments the spec lists.
3. A phase is done when every box in its **Acceptance** section is verified by running
   the command given, not by reading the code.
4. If the spec is wrong or ambiguous, say so in the PR rather than improvising silently.
   Every open design decision is a bug in the spec; record any deviation you had to make
   under a **Deviations** heading in the spec itself.
5. Scope discipline: touch only the files the spec names. Anything else you spot goes in
   `FINDINGS.md` as a one-line note. Do not fix it.

## Remaining phases

Dependency-ordered. Do not start one before its predecessor has landed.

| # | Phase | Spec | Effort | Ready to offload |
|---|---|---|---|---|
| 5 | AI layer unification | `phase-5-ai-layer.md` | ½–1 d | Next — write the full spec first |
| 6 | Flashcards + quizzes | `phase-6-features.md` | 2–3 d | Design first |
| 7 | CI + accessibility gates | `phase-7-gates.md` | ½–1 d | Spec it (4 has landed) |

Phase 3's characterization tests (`features/__tests__/sections.test.tsx`,
`features/reading/__tests__/ReadingSection.test.tsx`) are the safety net for every later
phase: a failure after a refactor means behaviour changed.

## Done

| # | Phase | PR | What it settled |
|---|---|---|---|
| 0 | Triage | [#1](https://github.com/nskurat/Nihongo/pull/1) | Base path + router basename, legacy-URL redirect, Reading Studio data, AI cache namespacing, markdown styling + sanitization, working lint, CI gates |
| 1 | Item identity | [#2](https://github.com/nskurat/Nihongo/pull/2) | `uid` on all 3,403 items, `StudyItem` base type, `validate:data` zod gate in CI, N5 lesson range fixed (1–25) |
| 2 | Content layer | [#3](https://github.com/nskurat/Nihongo/pull/3) | `ContentSource` repository + lazy per-level chunks, single-file bundle dropped, legacy `id` removed, ~133 KB initial transfer |
| 2b | Content-layer fixes | [#24](https://github.com/nskurat/Nihongo/pull/24) | `useLessonList` (no stale level, errors reach the panel), nullable `KanjiCompound`, dead API trimmed, CI on PRs. Deviations: built on the session branch, not `refactor/phase-2b-…`; one-line `services/ai/studyItems.ts` fix (the nullable type exposed a live crash); acceptance tests run as pure-logic node tests (no jsdom before Phase 3); browser retry limit logged in FINDINGS |
| 3 | Test harness | [#25](https://github.com/nskurat/Nihongo/pull/25) | Vitest `node` + `jsdom` projects, fetch guard on every test, `renderWithRouter` / fixtures / `mockAi()` in `src/test/`, 19 characterization tests; `ReadingSection.tsx` 83.6% line coverage, suite ~9 s. Deviations: projects split by file type (`*.test.ts` node, `*.test.tsx` jsdom), not folder; `mockAi()` spies on each provider's `executePrompt`, one level under `executeAiPrompt`, whose in-module callers `vi.mock` can't intercept; the spec's header example (N3 24 → N4) was wrong — 24 is in range and kept, an out-of-range lesson resets to the default, now both tested |
| 4 | UI consolidation | branch `claude/cool-heisenberg-l4bgrr` | `Modal` (native `<dialog>`), `SectionLayout` + `sectionTheme` (complete Tailwind literals), `ReadingSection` 1,228 → 93 lines over `useReadingStudio` + 5 components with one shared `QuestionList`, header tabs from `utils/sections.ts`. Phase 3 tests passed unedited after every commit; pages screenshot-identical apart from anti-aliasing. Intended changes: backdrop click closes every modal, the story reader gained Escape, sidebar heading drops the fake `(1–1)`, Reading shows a lesson-load failure, the reader's options use the studio's badge/icons. Deviations: no generic `Card`/`Badge`/`Button` (fewer than two callers each); `SearchPage.tsx` (428 lines, out of scope) left over the 400-line bar and logged |

Their specs were deleted once merged. `git log --diff-filter=D -- docs/refactor/` finds
them if the detail is ever needed; the PR descriptions carry the verified results.

## Decisions already made

These are settled. An agent must not revisit them.

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
  swap function. Same shape for progress in Phase 6.
- Dialogs use `components/common/Modal.tsx` (native `<dialog>`); study sections render
  through `components/layout/SectionLayout.tsx`, coloured by `sectionTheme` (complete
  Tailwind class literals, never interpolated).
- Markdown styling uses the existing `.markdown-prose` rules in `index.css`.
  No `@tailwindcss/typography` dependency.
- Sanitizer is `dompurify` v3.
- Vitest has two projects: `node` for `*.test.ts`, `jsdom` for `*.test.tsx`. Tests never reach
  the network (`src/test/setup.node.ts`); AI is mocked with `src/test/mockAi.ts`.
