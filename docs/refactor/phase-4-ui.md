# Phase 4 — UI consolidation

> **Not ready to offload.** Outline only. Write the full spec after Phase 3 lands, when
> the characterization tests define what "unchanged behaviour" means concretely.

**Prereq:** Phase 3 merged — do not start this without the safety net.

## Intent

Three sections duplicate the lesson sidebar, search banner, count badge and empty state,
differing only by icon and an accent colour spelled out in literal Tailwind classes.
`ReadingSection.tsx` is 1,061 lines with 15 `useState` hooks and renders its question list
twice — inline and in the modal — with duplicated answer state.

## Scope sketch

- `components/layout/SectionLayout.tsx` owning the shared shell, parameterised by a
  `sectionTheme` record instead of inline colour literals.
- Primitives: `Card`, `Badge`, `Button`, `Modal` (focus trap, Escape, `aria-modal`),
  `SearchInput`, `LoadingState`, `EmptyState`. The accessibility gap — zero `aria-*` or
  `role` attributes repo-wide — closes here, in one place.
- Split reading into `GeneratorPanel`, `PassageReader`, `QuestionList`, `StoryLibrary`,
  `StoryModal` plus a `useReadingStudio` hook. `QuestionList` is shared by studio and
  modal, which deletes the duplicated answer state.
- Make the section list in `Header` data-driven so a new section is a registry entry.

## Open decisions for the spec author

- Does `sectionTheme` carry Tailwind class strings or CSS custom properties?
- Does `Modal` wrap a native `<dialog>` or a portal? (Affects the focus-trap work.)
- Are studio tabs and the open story promoted to routes now, or in Phase 6?
