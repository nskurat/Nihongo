# Nihongo — Japanese Study Portal 🇯🇵

[![Live Site](https://img.shields.io/badge/Live_Site-GitHub_Pages-4f46e5?style=for-the-badge&logo=github)](https://nskurat.github.io/Nihongo/)

🔗 **Live Site**: [https://nskurat.github.io/Nihongo/](https://nskurat.github.io/Nihongo/)

An interactive Japanese study hub for **Minna no Nihongo** (JLPT N5/N4/N3), with
grammar, vocabulary and kanji reference plus AI-generated reading practice.

For the codebase layout, conventions and constraints, see [AGENTS.md](AGENTS.md) —
that's the file kept current for both contributors and coding agents. This README
covers only how to run the thing.

## Getting started

```bash
npm install
npm run dev
```

Opens the Vite dev server at `http://localhost:5173`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally, at its real sub-path |
| `npm test` | Run the test suite once |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

There is one `package.json`, at the repo root — `grammar-app/` holds the app's
source but is not a separate npm package.

## Deployment

Pushing to `main` triggers [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):
typecheck, lint and test run first, then `npm run build` produces `dist/`, which
GitHub Actions publishes to GitHub Pages at the URL above. `dist/` is git-ignored
and only ever produced by the build.

## Refactor in progress

This app is mid-refactor toward a content-repository architecture that can support
flashcards, quizzes and a real backend. See [docs/refactor/README.md](docs/refactor/README.md)
for the phased plan.
