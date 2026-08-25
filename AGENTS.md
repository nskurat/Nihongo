# AGENTS.md

Operational context for coding agents working in this repo. Keep this file lean —
it is loaded into every session. Details belong in `docs/refactor/`, not here.

## What this is

A static, client-only study portal for Minna no Nihongo (JLPT N5/N4/N3): grammar,
vocabulary and kanji reference plus AI-generated reading practice. React 19 + Vite +
Tailwind v4 + zustand + react-router. No backend. Deployed to GitHub Pages at
`https://nskurat.github.io/Nihongo/` by `.github/workflows/deploy.yml` on push to `main`.

## Commands

Run from the repo root (`Nihongo/`). There is no nested `package.json`.

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server (root is `grammar-app/`) |
| `npm run build` | Builds into `dist/` |
| `npm test` | Vitest, run once |
| `npm run typecheck` | `tsc --noEmit` — must stay clean |
| `npm run lint` | ESLint (broken until Phase 0; see below) |

## Layout

```
vite.config.js          Vite + vitest config (root: grammar-app)
grammar-app/
  index.html            Single entry point
  src/
    main.tsx            BrowserRouter mount
    App.tsx             Routes: /:level/:section/:lesson
    features/           grammar | vocab | kanji | reading — Section.tsx + use*.ts each
    components/common/  Header, modals, MarkdownViewer, FuriganaText, TagBadge
    services/ai/        Provider registry, prompts, parsers, storage adapter
    store/              zustand: useAppStore (UI prefs), useAiStore (cache + loading)
    data/{n5,n4,n3}/    grammar|vocab|kanji.json, keyed by lesson number
    types/              japanese.ts (domain), ai.ts (AI + reading)
    utils/              levels.ts (lesson ranges), tags.ts (taxonomy index)
```

## Conventions

- TypeScript strict; `tsc --noEmit` must pass before any commit. No new `any`.
- Function components, named exports for hooks, default export per component file.
- Tailwind utility classes inline. Custom CSS only in `src/index.css`.
- Pure logic (parsing, prompt building, scheduling, scoring) lives in `services/` or
  `utils/` as side-effect-free modules **with unit tests**. Components stay thin.
- State that belongs in the URL stays in the URL (level, section, lesson). zustand is
  for genuine cross-cutting UI state only.
- New external data or storage goes behind an adapter interface — see
  `services/ai/readingStorage.ts` for the pattern to copy.

## Constraints

- **Lesson ranges differ per level**: N5 = 1–15, N4 = 26–50 (Book II numbering),
  N3 = 1–24. Never assume lessons start at 1. Source of truth: `utils/levels.ts`.
- **`src/data/*.json` is generated content.** Do not hand-edit rows to make code or
  tests pass. Schema changes go through `scripts/` migrations.
- **AI calls cost the user money.** Never invoke a provider from a test, a script, or
  to "verify" a change. Mock at the `executeAiPrompt` boundary.
- API keys live in the user's `localStorage` and go browser-to-provider. Do not add
  telemetry, proxies or key transmission of any kind without being asked.
- The app is served from the `/Nihongo/` sub-path. Paths must never be hardcoded —
  derive from `import.meta.env.BASE_URL`.

## Known broken (do not treat as your bug)

Deep links 404 on refresh, Reading Studio receives no lesson data, AI cache collides
across levels, markdown renders unstyled, and `npm run lint` matches zero files.
All five are Phase 0 work. If you are not doing Phase 0, work around them.

## Refactor in progress

Phased plan and per-phase execution specs: `docs/refactor/README.md`.
Read the index plus **only your own phase spec** — the others are deliberately
out of scope and reading them wastes context.
