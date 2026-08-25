# Phase 3 — Test harness and characterization tests

There is currently no way to render a component in a test. Phase 4 splits a 1,066-line
component into five; without this phase, nothing proves behaviour survived.

**Branch:** `refactor/phase-3-test-harness` · **Prereq:** Phase 2b merged

## Task 1 — Two test projects

`vite.config.js` currently sets `test: { globals: true, environment: 'node' }`.

- Convert to Vitest projects: `node` (existing `services/**` and `utils/**` tests, stays
  fast and dependency-free) and `jsdom` (component tests under `features/**` and
  `components/**`).
- Add `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, and
  `@vitest/coverage-v8` (the Acceptance section below requires a coverage number and
  Vitest cannot produce one without a provider installed).
- Add a setup file registering jest-dom matchers and clearing `localStorage` between tests.
- `npm test` runs both; `npm run test:node` runs only the fast project;
  `npm run test:coverage` reports coverage.

## Task 2 — Test doubles, not network

- A `renderWithRouter(ui, { route })` helper — every section depends on router params.
- Mock at the `executeAiPrompt` boundary in `services/ai/registry.ts`. **No test may make
  a network call to a provider.** Add an assertion in the setup file that `fetch` is
  stubbed, so a missed mock fails loudly rather than costing money.
- Use `InMemoryContentSource` from Phase 2 with small fixtures. Do not import real
  `src/data` JSON into tests — fixtures stay under 20 rows.

## Task 3 — Characterization tests before the refactor

These describe what the app does *today*, including quirks. They are the safety net for
Phase 4, so write them against current behaviour and do not "improve" anything.

- **Section shell** (one section is enough, plus a smoke render of the other two):
  lesson list renders from `listLessons`; clicking a lesson navigates; search filters;
  empty state appears for an empty result; loading skeleton appears before data.
- **ReadingSection studio flow**: generate with a mocked provider → passage renders,
  furigana renders as `<ruby>`, answering a question reveals its explanation, score
  increments, entry lands in the library.
- **ReadingSection library flow**: filter by level, search by title, open a story in the
  modal, answer a question inside the modal, delete an entry, load one back into the studio.
- **Header**: level switch preserves the section and clamps the lesson (N3 lesson 24 →
  N4 must land in 26–50, not 24).

## Acceptance

- [ ] `npm test` runs both projects green; component tests actually assert on rendered DOM.
- [ ] Coverage of `features/reading/ReadingSection.tsx` ≥ 60% of lines — it is the file
      Phase 4 will cut apart, so it needs the most net.
- [ ] Deliberately break one behaviour (e.g. return `[]` from `listLessons`) and confirm a
      characterization test fails. A net that never catches anything is not a net.
- [ ] No test hits the network: the `fetch` guard is in place and proven by a test.
- [ ] Full run under 20 s locally.

## Commits

1. `test: add jsdom project and testing-library`
2. `test: add router and content test helpers`
3. `test: characterize section and reading behaviour`
