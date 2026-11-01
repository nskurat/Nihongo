# Phase 4 — UI consolidation

Grammar, Vocab and Kanji each carry a copy of the same shell — lesson sidebar, banner,
per-lesson filter, count badge, loading / error / empty panels — differing only in icon,
nouns and an accent colour spelled out in literal Tailwind classes. `ReadingSection.tsx`
is 1,227 lines with ~20 `useState` hooks and renders its question list twice (studio and
modal) with duplicated "show English" state. Three modals each hand-roll Escape handling.

**Branch:** session branch · **Prereq:** Phase 3 merged (done)

The Phase 3 characterization tests (`features/__tests__/sections.test.tsx`,
`features/reading/__tests__/ReadingSection.test.tsx`) must stay green after every commit
**without edits**, except where a task below changes behaviour on purpose — those edits
are listed in the task and nowhere else.

## Decisions (settled — do not revisit)

- **Theme:** `sectionTheme` is a typed record of complete Tailwind class strings per
  section (`grammar` indigo, `vocab` emerald, `kanji` rose). Complete literals, never
  `bg-${colour}-600`: Tailwind v4 only generates classes it finds verbatim in source.
- **Modal:** wraps a native `<dialog>` opened with `showModal()`. The browser provides
  focus containment, Escape (`cancel` event), an inert background and `aria-modal`
  semantics. jsdom lacks `showModal`; `src/test/setup.dom.ts` polyfills it.
- **Routes:** no URL changes in this phase. Studio tabs and the open story stay where they
  are (query string / component state); promoting them to routes belongs with Phase 6.
- **No speculative primitives.** A primitive is extracted only when it has two or more
  callers in this phase. That rules in `Modal`, the section shell and its state panels;
  it rules out generic `Card` / `Badge` / `Button` for now.

## Task 1 — `Modal` primitive

`components/common/Modal.tsx`: `{ open, onClose, labelledBy, className, children }`.
Native `<dialog>`; `showModal()` / `close()` driven by `open`; `cancel` (Escape) and a
backdrop click call `onClose`. Migrate `AiSettingsModal`, `GrammarDetailModal` and the
Story Library reader to it and delete their hand-rolled Escape effects.

Tests (jsdom): opens as a modal dialog with an accessible name; Escape calls `onClose`;
a click on the backdrop closes, a click inside does not.

## Task 2 — `SectionLayout` and the state panels

- `components/layout/sectionTheme.ts` — the theme record.
- `components/layout/SectionLayout.tsx` — sidebar (lesson list, counts, active lesson,
  optional footer slot), banner (level badge, subtitle, lesson heading, optional notice
  slot), per-lesson filter and count badge, then `LoadingState` / `ErrorState` /
  `EmptyState`, then `children` (the cards). Props carry the section's data from its
  `use*` hook; the layout owns no data fetching.
- Grammar, Vocab and Kanji render through it; each keeps only its card markup.
- **Behaviour change (from FINDINGS):** while the lesson list is loading or failed, the
  sidebar header reads `N4 Lessons` with no range instead of the `(1–1)` fallback.
  Add a test; no existing test changes.

## Task 3 — Split `ReadingSection`

Into `features/reading/`: `useReadingStudio.ts` (state + handlers), `GeneratorPanel`,
`PassageReader`, `QuestionList`, `StoryLibrary`, `StoryModal`; `ReadingSection.tsx`
becomes the composition. `QuestionList` is shared by studio and modal and owns its
"show English" toggles, so the two duplicated `showExplanationEn` maps go away; a
`resetKey` prop (bumped by Start over / a new passage) clears them as today.

**Behaviour change (from FINDINGS):** `useReadingData`'s `error` is rendered in the
generator panel (a chunk failure no longer looks like a level with no lessons). Add a test.

## Task 4 — Data-driven header sections

`Header`'s section tabs come from one registry (`utils/sections.ts`: id, label, icon), so
a new section is one entry. Availability still comes from `isSectionAvailable`.

## Do not touch

`services/ai/**` (Phase 5) · URLs and query params · content data · copy text other than
the two behaviour changes above.

## Acceptance

- [ ] typecheck, lint, `npm test`, `validate:data`, build — all clean.
- [ ] Phase 3 characterization tests pass unedited.
- [ ] No component file over 400 lines; `ReadingSection.tsx` under 150.
- [ ] `grep -rn "e.key === 'Escape'" grammar-app/src/components grammar-app/src/features`
      finds no modal Escape handler outside `Modal.tsx`.
- [ ] Browser check (Playwright, dev server): each modal traps Tab and closes on Escape;
      grammar/vocab/kanji/reading pages look unchanged (screenshots before/after).

## Commits

1. `docs: write the Phase 4 spec`
2. `refactor: Modal primitive on native dialog`
3. `refactor: shared SectionLayout for grammar, vocab and kanji`
4. `refactor: split ReadingSection`
5. `refactor: data-driven header sections`
