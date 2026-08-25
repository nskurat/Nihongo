# Phase 2b — Content-layer defect fixes

Six defects found reviewing the merged Phase 0–2 work. All are small, all are in code
Phase 2 introduced or touched, and none block a later phase — but they are real, and
Phase 4 will build on top of these files, so fix them before that.

**Branch:** `refactor/phase-2b-content-fixes` · **Prereq:** Phase 2 merged

## Task 1 — Extract `useLessonList`, fixing two bugs at once

`useGrammar`, `useVocab` and `useKanji` each hold a copy-pasted effect:

```ts
const [lessons, setLessons] = useState<LessonSummary[]>([]);
useEffect(() => {
  let cancelled = false;
  contentRepository.listLessons(activeLevel, 'grammar').then((summaries) => {
    if (!cancelled) setLessons(summaries);
  });
  return () => { cancelled = true; };
}, [activeLevel]);
```

Two defects, both from the same omission:

1. **Unhandled rejection.** No `.catch`. If the chunk fails to load, the sidebar stays
   empty forever with no error state and an unhandled rejection hits the console. The
   main content area *does* show an error (that path goes through `useContentQuery`),
   so the failure is half-visible and half-silent.
2. **Stale list across a level switch.** `lessons` is never reset when `activeLevel`
   changes, so until the new chunk resolves the sidebar renders the *previous* level's
   lessons — and its header renders the wrong range, e.g. `N4 Lessons (1–25)`. On a
   cached chunk this is invisible; on a first switch it is not.

`useContentQuery` already solves exactly this with its `key`-comparison pattern. Apply
the same discipline in a new `features/useLessonList.ts`:

```ts
function useLessonList(
  level: Level, section: ContentSection
): { lessons: LessonSummary[]; loading: boolean; error: ContentError | null };
```

- Derive `loading` by comparing the key the state was written for against the key the
  current render wants. Do not call `setState` synchronously in the effect body
  (`react-hooks/set-state-in-effect` will reject it, as it did in Phase 2).
- Return `[]` while loading so no stale level ever renders.
- The three hooks drop their effect and their `lessons`/`totalLessons`/`lessonCounts`
  bookkeeping in favour of this hook.

`useReadingData.ts` has the same missing `.catch` on its `Promise.all` and the same
stale-across-level-switch behaviour. Fix it the same way; it does not need the shared
hook, but it does need both guards.

## Task 2 — Surface the lesson-list error

The three `Section.tsx` files already render an error panel with a retry button, driven
by `useContentQuery`. A `listLessons` failure must reach the same panel rather than
leaving an empty sidebar. Simplest correct wiring: treat either error as the section's
error state; a retry re-runs both.

Do not design a new error component — that is Phase 4.

## Task 3 — `KanjiCompound` type lies about the data

`types/japanese.ts` declares:

```ts
export interface KanjiCompound { word: string; reading: string; meaning: string }
```

150 `compounds[]` entries in `n4/kanji.json` have a literal `null` for `reading` and/or
`meaning` — confirmed by `npm run validate:data`, whose zod schema already models them
as `.nullable()`. The TypeScript type and the validator disagree, and the type is the
one that is wrong.

Nothing crashes today only because `KanjiSection.tsx` renders `{ex.meaning}` directly and
React renders `null` as nothing. Any future `.toLowerCase()`, `.trim()` or `.includes()`
on those fields is an unguarded crash — and `StaticContentSource.search()` already calls
`.toLowerCase()` on string values, so it is one `search` wiring away from being live.

- Change both fields to `string | null`, matching the validator and the data.
- Fix the resulting type errors at the render sites explicitly (render an em dash or
  omit the row — pick one and apply it consistently), rather than with `!`.
- Filling in the real readings is a **content** problem, already logged in
  `FINDINGS.md`. Do not invent readings to make the type nicer.

## Task 4 — Trim dead API surface

- `getContentSource()` in `StaticContentSource.ts` is exported and never called. Delete
  it — `contentRepository` (read) and `setContentSource` (swap) are the real API.
- `contentRepository.search()` is called only from its own unit test. **Keep it**: Phase 6
  defines a deck as "a query over `ContentSource`", and cross-lesson search is its most
  likely first caller. Add a one-line comment saying so, so the next reviewer does not
  delete it as dead code.
- The section search boxes stay client-side over the loaded lesson. That is deliberate —
  it matches pre-refactor behaviour and needs no repository round-trip. Note it in the
  comment above.

## Task 5 — Correct the `ContentSource` doc comment

`ContentSource.ts` claims *"`getItem` never rejects (it resolves `null` for a uid that
parses but has no match)"*. It awaits `loadChunk`, which rejects on a missing or failed
chunk, so `getItem` rejects too. Reword to: resolves `null` for an unmatched or malformed
uid, rejects with `ContentError` if the chunk itself cannot be loaded.

## Task 6 — Refresh `AGENTS.md`

The layout map has no `services/content/` entry, and the "new external data goes behind
an adapter" convention still points only at `services/ai/readingStorage.ts`.

- Add `services/content/  ContentSource + StaticContentSource, lazy per-level chunks`.
- Point the adapter convention at both `readingStorage.ts` and `ContentSource.ts`.
- Keep it lean — it loads into every agent session.

## Do not touch

New UI components or shared layout (Phase 4) · `services/ai/**` (Phase 5) · content
values in `src/data/**` · the `useContentQuery` public shape

## Acceptance

- [ ] `npm run typecheck`, `npm run lint`, `npm test`, `npm run validate:data` all clean.
- [ ] Unit test: `useLessonList`-equivalent logic returns `[]`, not the previous level's
      lessons, for the render immediately after a level change.
- [ ] Unit test: a rejecting `listLessons` produces an `error`, and no unhandled rejection
      is logged. Assert with a `process.on('unhandledRejection')` / `vi.spyOn(console)`
      guard so a regression fails loudly.
- [ ] Force a chunk failure (throwaway source whose importer rejects) and confirm the
      section renders its error panel with a working retry — not an empty sidebar.
- [ ] `grep -rn "getContentSource" grammar-app/src` returns nothing.
- [ ] Switching N5 → N4 → N5 in the browser never shows a mismatched level/range in the
      sidebar header at any point.

## Commits

1. `fix: guard lesson list against errors and stale levels`
2. `fix: type nullable kanji compound fields`
3. `chore: trim dead content API and refresh agent docs`
