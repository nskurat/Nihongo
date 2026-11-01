# Phase 7 — CI and accessibility gates

## Intent

Keep the refactor from decaying. Phases 0–6 are only durable if the checks run
automatically: a bundle that quietly grows back into one file, a render error that blanks
the page, or a dialog a keyboard user can't leave should each fail CI or be recoverable,
not be found by a user.

## Decisions (the outline's open questions)

- **Local build, no preview deploy.** The budget measures `dist/` after `npm run build` in
  the same CI job. A preview deploy would add a Pages environment per PR and measure the
  same files.
- **Automated axe in the jsdom project, plus a short manual checklist.** axe-core runs in
  `npm test`, so it gates every PR with no new job. jsdom can't do layout, so colour
  contrast, focus visibility and real screen-reader output are a manual checklist
  (`docs/a11y.md`), not a gate.
- **Budget = gzipped bytes, two numbers**: the initial load (entry script + everything
  `index.html` preloads + CSS) and the largest lazy JS chunk. Each is ~25% above today's
  build. The per-chunk ceiling is what catches the single-file build returning.

## Tasks

1. **Bundle budget** — `scripts/lib/bundleBudget.ts` (pure: parse `index.html`, sum the
   initial assets, check every lazy chunk) with tests in
   `src/__tests__/scripts/bundleBudget.test.ts`; `scripts/check-bundle-size.ts` reads
   `dist/`, gzips, prints the report, exits 1 when over. `npm run check:bundle`; a step
   after "Build site" in `ci.yml` and `deploy.yml`.
2. **Error boundary** — `components/common/ErrorBoundary.tsx`: a `role="alert"` panel with
   Try again / Reload page / Go to start page, error message under "Technical details",
   console only (no telemetry). Two placements: around `<Routes>` in `App.tsx` with
   `resetKey={pathname}` (header stays usable, navigating clears it) and around the router in
   `main.tsx` as the last resort.
3. **axe gate** — `axe-core` dev dependency; `src/test/axe.ts` (`axeViolations(root, {exempt})`,
   colour-contrast disabled); `src/__tests__/a11y.test.tsx` covers grammar, vocab, kanji, a
   failed lesson, Reading Studio, Story Library (empty and with a story), search results,
   and the AI settings, grammar detail and story dialogs. Fix what it finds.
4. **Keyboard / screen-reader pass** over modals, tab lists and the lesson sidebar:
   - Skip link to `#main-content` as the first tab stop.
   - Global `:focus-visible` ring in `index.css` (white inside the header).
   - Header level switcher: `role="group"` "JLPT level", `aria-pressed`.
   - Lesson sidebar inside `<nav aria-label="N5 lessons">`.
   - Reading Studio / Story Library switcher: WAI-ARIA tabs (`tablist`/`tab`/`tabpanel`,
     roving `tabIndex`, ←/→/Home/End via the pure `utils/rovingFocus.ts`).
   - Story Library card opened only by a mouse `onClick` on a `<div>`: the title is now a
     button. Icon-only buttons get names.
5. **Docs** — `docs/a11y.md` (gate + manual checklist), AGENTS.md commands/convention.

## Acceptance

Verified by running each command:

- [x] `npm run typecheck`, `npm run lint`, `npm run validate:data` clean.
- [x] `npm test` — 47 files, 653 tests pass, including `a11y.test.tsx` (15),
      `ErrorBoundary.test.tsx` (4), `bundleBudget.test.ts` (6), `rovingFocus.test.ts` (3).
- [x] `npm run build && npm run check:bundle` — initial 160.7 KB / 200 KB, largest lazy
      chunk 159.7 KB / 200 KB, exit 0.
- [x] Simulated regression (vocab + grammar chunks appended to the entry script):
      `check:bundle` reports 762.8 KB initial and exits 1.
- [x] Chromium against `vite preview` (Playwright): first Tab focuses "Skip to content",
      Enter moves focus to `#main-content`; the lesson button's ring is indigo
      (`rgb(79, 70, 229)`), a header button's is white; ArrowRight on the Practice Studio
      tab selects and focuses Story Library and sets `?view=library`; no page errors.
- [x] Phase 3 characterization tests pass; one edited (below).

## Deviations

- **Order.** README lists Phase 6 before 7 and Phase 6 has not landed. Nothing here
  depends on it (the outline only required Phase 4), and the owner asked for Phase 7 next.
  Phase 6's new pages will need their own cases in `a11y.test.tsx`.
- **Branch.** Built on the session branch `claude/eloquent-cray-n5xsc7`, not
  `refactor/phase-7-gates`, as Phase 2b and 5 were.
- **Characterization test edited.** `ReadingSection.test.tsx` clicked "Story Library" as a
  `button`; it is a `tab` now. Intended semantic change, nothing else in the test moved.
- **Heading levels.** axe's `heading-order` moved `SectionLayout`'s loading/error/empty
  headings and the Story Library card titles from `h4` to `h3` (under the page's `h2`), and
  the AI settings "Select Active AI Provider" caption from a `<label>` pointing at nothing
  to an `h4` labelling the provider group. Same styling.
- **Files outside a strict reading of the outline**, each to fix an axe or keyboard
  finding: `GeneratorPanel.tsx`, `AiSettingsModal.tsx`, `GrammarDetailModal.tsx`
  (labels/names), `StoryLibrary.tsx` (keyboard-openable cards).
- **Not fixed, logged in FINDINGS** — the search results listbox's group `<h2>`s
  (`aria-required-children`; a search-UX decision; exempted on that one test), and the
  colour-contrast shortfalls the gate can't measure.
- **No generic `Tabs` component**: one caller (the header's section nav is navigation, not
  tabs). The keyboard logic is the shared, tested piece.
