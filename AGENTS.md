# AGENTS.md

Operational context for coding agents working in this repo. Keep this file lean —
it is loaded into every session. Details belong in `docs/`, not here.

## What this is

A static, client-only study portal for JLPT N5–N1: grammar (all levels),
vocabulary, kanji and AI-generated reading practice (all levels). React 19 + Vite +
Tailwind v4 + zustand + react-router. No backend. Deployed to GitHub Pages at
`https://nskurat.github.io/Nihongo/` by `.github/workflows/deploy.yml` on push to `main`.

## Commands

Run from the repo root (`Nihongo/`). There is no nested `package.json`.

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server (root is `grammar-app/`) |
| `npm run build` | Builds into `dist/` |
| `npm test` | Vitest, run once: `node` project (`*.test.ts`) + `jsdom` project (`*.test.tsx`) |
| `npm run test:node` / `test:coverage` | Fast logic tests only / coverage report |
| `npm run typecheck` | `tsc --noEmit` — must stay clean |
| `npm run lint` | ESLint — must stay clean |
| `npm run validate:data` | Zod-validates every content JSON file; warnings auto-log to `docs/backlog.md` |
| `npm run check:bundle` | After `build`: fails if the initial load or any lazy chunk is over its gzipped budget |

## Layout

```
vite.config.js          Vite + vitest config (root: grammar-app)
grammar-app/
  index.html            Single entry point
  src/
    main.tsx            BrowserRouter mount
    App.tsx             Routes: /:level/:section/:lesson
    features/           grammar | vocab | kanji | reading | search — Section.tsx + use*.ts each
    components/common/  Header, Modal (native <dialog>, use for every dialog), ErrorBoundary, MarkdownViewer, FuriganaText
    components/layout/  SectionLayout + sectionTheme: the shell grammar/vocab/kanji render through
    services/ai/        Provider registry, prompts, parsers, model catalog, AiError, artifact cache
    services/content/   ContentSource + StaticContentSource, lazy per-level chunks; the only
                        way components reach src/data (via contentRepository)
    services/search/    Global search: normalise/romaji/deinflect, index builder, ranking, worker
                        (design + QA: docs/search/; index built by scripts/build-search-index.ts)
    store/              zustand: useAppStore (UI prefs), useAiStore (AI artifacts + request status)
    data/{n5..n1}/      grammar|vocab|kanji.json, keyed by lesson number. A section shows wherever
                        its data file exists (utils/levels.ts). Kanji/vocab provenance: docs/content-data.md
    types/              japanese.ts (domain), ai.ts (AI + reading)
    utils/              levels.ts (lesson ranges), sections.ts (section registry), tags.ts (taxonomy)
    test/               Test setup (fetch blocked), renderWithRouter, fixtures, mockAi(), axeViolations()
```

## Conventions

- TypeScript strict; `tsc --noEmit` must pass before any commit. No new `any`.
- Function components, named exports for hooks, default export per component file.
- Tailwind utility classes inline. Custom CSS only in `src/index.css`.
- Pure logic (parsing, prompt building, scheduling, scoring) lives in `services/` or
  `utils/` as side-effect-free modules **with unit tests**. Components stay thin.
- State that belongs in the URL stays in the URL (level, section, lesson). zustand is
  for genuine cross-cutting UI state only.
- Accessibility is gated: a new page or dialog gets an `axeViolations()` case in
  `src/__tests__/a11y.test.tsx`; contrast and screen-reader checks are manual (`docs/a11y.md`).
- New external data or storage goes behind an adapter interface — see
  `services/ai/readingStorage.ts` and `services/content/ContentSource.ts` for the pattern.

## Constraints

- **Lessons are numbered independently per level**, always from 1, with different
  maxima: N5 = 1–25, N4 = 1–25, N3 = 1–24, N2 = 1–26, N1 = 1–32. Never assume a max. Source of truth:
  `utils/levels.ts` (`LESSON_RANGES`, also the single source `scripts/validate-content.ts`
  mirrors). Text cross-references to another level's lesson name it, e.g. "N5 Lesson 23".
- **`src/data/*.json` is generated content.** Do not hand-edit rows to make code or
  tests pass. Schema changes go through `scripts/` migrations.
- **AI calls cost the user money.** Never invoke a provider from a test, a script, or
  to "verify" a change. Mock at the `executeAiPrompt` boundary.
- API keys live in the user's `localStorage` and go browser-to-provider. Do not add
  telemetry, proxies or key transmission of any kind without being asked.
- The app is served from the `/Nihongo/` sub-path. Paths must never be hardcoded —
  derive from `import.meta.env.BASE_URL`.

## Where things are recorded

- Open work, known issues, deferred ideas and settled decisions: `docs/backlog.md` (the only tracker).
- Content pipeline, sources and decisions: `docs/content-data.md`.
- Role skills for reviews: `.claude/skills/{japanese-teacher,product-manager,ux-designer}`.

## Next up

Flashcards and quizzes — design first; the shape and open decisions are section 1 of
`docs/backlog.md`. Out-of-scope things you notice go in the backlog, not fixed in passing.
