# Phase 2 — Content repository and lazy loading

Put an async repository between components and content, then stop shipping 1.6 MB of
HTML on first paint. This phase is what makes a database swap a one-file change.

**Branch:** `refactor/phase-2-content-layer` · **Prereq:** Phase 1 merged

## Task 1 — The interface, written first

New `grammar-app/src/services/content/ContentSource.ts`. Deliberately mirrors
`services/ai/readingStorage.ts` — abstract base, async facade, swap function.

```ts
export interface LessonSummary { lesson: number; count: number; }

export abstract class BaseContentSource {
  abstract listLessons(level: Level, section: ContentSection): Promise<LessonSummary[]>;
  abstract getItems<T extends StudyItem>(
    level: Level, section: ContentSection, lesson: number
  ): Promise<T[]>;
  abstract getItem<T extends StudyItem>(uid: Uid): Promise<T | null>;
  abstract search<T extends StudyItem>(
    query: string, scope: { level: Level; section: ContentSection }
  ): Promise<T[]>;
}
```

Decisions that are settled — do not redesign them:

- Every method is async and returns plain data. No React, no store access in here.
- Errors reject with a `ContentError` carrying `{ kind: 'not-found' | 'load-failed', detail }`.
  Callers surface `kind`; they never parse messages.
- `search` is scoped to one level+section, matching today's behaviour. Cross-level search
  is out of scope for this phase — a lazily-loaded source cannot do it without fetching
  everything, and that trade needs its own decision.
- `getItem(uid)` derives level/section/lesson by parsing the uid, then loads that one chunk.

## Task 2 — Static implementation

`services/content/StaticContentSource.ts`:

- `import.meta.glob('../../data/*/*.json')` for lazy per-file dynamic imports.
- Cache resolved modules in a `Map` keyed `level:section`; concurrent callers for the same
  key share one in-flight promise (no duplicate fetches).
- Export the singleton facade `contentRepository` plus `setContentSource(source)`, exactly
  like `readingRepository` / `setReadingStorageAdapter`.
- Unit tests: lesson listing per level (N4 must report 26–50), item lookup by uid,
  unknown uid → `not-found`, search hit and miss, and the in-flight-dedupe behaviour.

## Task 3 — Drop the single-file build

- Remove `vite-plugin-singlefile` from `vite.config.js` and `package.json`.
- `build.outDir` becomes `../dist` (not `../dist/grammar`); the app is served at the base
  root. Absolute `base` from Phase 0 keeps asset URLs correct.
- `build` script reduces to:
  `vite build && cp dist/index.html dist/404.html && cp serve.json dist/`.
- Add `build.rollupOptions.output.manualChunks` splitting vendor (react, router, zustand,
  lucide, marked) from app code. Content JSON already splits per file via the glob.
- Delete the now-dead `dist/grammar` handling and the stale `dist/*` directories.

## Task 4 — One hook replaces three data maps

`features/useContentQuery.ts`:

```ts
function useContentQuery<T extends StudyItem>(
  level: Level, section: ContentSection, lesson: number
): { items: T[]; loading: boolean; error: ContentError | null };
```

- `useGrammar`, `useVocab` and `useKanji` drop their module-scope `Record<LevelType, …>`
  maps and static imports, and keep only their feature-specific logic (search filtering,
  AI handlers, selected item).
- Lesson lists come from `listLessons`, not `Object.keys` on an imported object.
- Each `Section.tsx` renders a skeleton while `loading` and an inline retry on `error`.
  Use the existing empty-state markup as the visual basis; do not design new components —
  that is Phase 4.
- Cancel on unmount: ignore a resolved promise whose level/section/lesson no longer match.

## Task 5 — Retire the dead store slices

`store/useAppStore.ts` holds `activeLevel`, `activeSection` and `activeLesson` that
nothing reads — the router owns them. Delete all three plus their setters; keep
`showTranslations` and its persistence. Bump the persist name only if the shape breaks.

Also drop the legacy `id` field from `types/japanese.ts` and from the nine JSON files
(extend `scripts/add-uids.ts` with a `--drop-legacy-id` step). Nothing should reference
`item.id` after Phase 1; confirm with `grep -rn "\.id\b" grammar-app/src`.

## Do not touch

Component markup beyond loading and error states · `services/ai/**` · content values

## Deviations from this spec

- **`features/reading/useReadingData.ts` was migrated too**, though Task 4 only names
  `useGrammar`/`useVocab`/`useKanji`. It still had static per-level JSON imports, and
  `App.tsx`'s `ContentWrapper` called it unconditionally on every route — that alone
  broke both the budget and the `data/*.json` grep in Acceptance regardless of what Task
  4 touched. Fixed by moving the hook call from `App.tsx` into `ReadingSection.tsx`
  itself (so it only fetches once Reading Studio mounts) and rewriting it to use
  `contentRepository`. See the Task 5 commit for the full reasoning.
- **VocabSection.tsx gained a small example-sentence block** it never had (data always
  carried `exampleJp`/`exampleEn`; the UI just never rendered them) — a pre-existing gap
  unrelated to this migration, spotted mid-review and fixed on request rather than
  deferred to Phase 4.

## Acceptance

- [x] `npm run typecheck`, `npm run lint`, `npm test`, `npm run validate:data` all clean.
- [x] `npm run build && npm run preview` — deep link, refresh and back button all still
      work under `/Nihongo/` (Phase 0's guarantee must survive this phase).
- [x] **Budget:** initial transfer (HTML + JS + CSS, gzipped) ≤ 300 KB, and no content
      JSON is requested before user interaction. Verify in the Network panel or with
      `find dist/assets -name '*.js' -exec gzip -c {} + | wc -c`. Record the real numbers
      in the PR description. **Actual: ~133 KB** (index 62.5 KB + vendor 63.7 KB + css
      10.0 KB, gzipped) — confirmed via Network panel that no grammar/vocab/kanji chunk
      loads until a route needs it.
- [x] Switching level or lesson fetches exactly one new chunk; switching back fetches none.
- [x] `grep -rn "from '.*data/.*json'" grammar-app/src` returns nothing outside
      `services/content/`, **with one deliberate exception**: `utils/tags.ts` statically
      imports `data/tag-taxonomy.json`. That file is a small facet/tag taxonomy, not
      per-lesson `StudyItem` content — it doesn't fit the `ContentSource` abstraction and
      was never in scope for it.
- [x] Swap test: a throwaway `InMemoryContentSource` passed to `setContentSource` renders
      the whole app from fixtures with **zero component changes**. Keep it as a test
      fixture — it is the proof the database migration is now a one-file job. Implemented
      at the repository level (`contentSourceSwap.test.ts`), not a full DOM render — this
      repo has no component-rendering test infra (jsdom/@testing-library/react) yet, and
      adding it wasn't authorized by this spec.

## Commits

1. `feat: define ContentSource interface`
2. `feat: add StaticContentSource with lazy chunks`
3. `build: drop single-file bundle, split vendor chunks`
4. `refactor: load content through useContentQuery`
5. `chore: remove dead store slices and legacy ids`
