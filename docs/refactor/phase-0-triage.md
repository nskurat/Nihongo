# Phase 0 — Triage

Fix the five defects that are broken in the deployed app. No refactoring, no new
abstractions. Smallest change that makes each one correct.

**Branch:** `refactor/phase-0-triage` · **Prereq:** none

## Task 1 — Base path and router basename

The site is served from `/Nihongo/` but the router navigates to absolute paths like
`/n3/grammar/1`, escaping the base. Verified: loading `nskurat.github.io/Nihongo/`
rewrites the URL to `nskurat.github.io/n3/grammar/1`, which 404s on refresh.

- `vite.config.js`: replace `base: './'` with
  `base: process.env.VITE_BASE_PATH || '/Nihongo/'`.
- `grammar-app/src/main.tsx`: `<BrowserRouter basename={import.meta.env.BASE_URL}>`.
- `package.json`: add `"preview": "vite preview"` (respects `base`, unlike `serve`).
- Leave `viteSingleFile` and the `build` script's `cp` steps alone — Phase 2 removes them.

Note: absolute base also fixes the favicon on deep links, which currently resolves
relative to the fake path segment.

## Task 2 — Extract the legacy URL redirect

`App.tsx` handles old `?level=&section=&lesson=` and `#hash` URLs in a `useEffect` that
only fires when `pathname === '/'` — which never happens under a basename.

- Move the parsing to `src/utils/legacyUrl.ts`:
  `parseLegacyUrl(search: string, hash: string): { level, section, lesson } | null`.
  Pure function, no router or window access.
- `App.tsx` calls it from the `*` route element and issues one `<Navigate replace>`.
- Unit-test it: a query-string URL, a hash URL, a garbage URL, an empty URL.

## Task 3 — Wire data into Reading Studio

`App.tsx` renders `<ReadingSection activeLevel={parsedLevel} />` but the component also
declares `grammarData` and `vocabData` props defaulting to `{}`, so the lesson picker is
empty and every prompt silently falls back to generic practice.

- Pass both from the same static imports the other hooks use. A `useReadingData(level)`
  hook in `features/reading/` is fine; do not build a general abstraction — that is Phase 2.
- Verify the lesson dropdown lists the level's real lesson numbers (N4 starts at 26).

## Task 4 — Namespace the AI cache by uid

N5 and N3 grammar share IDs (`1-1`, `1-2`, …), so `useAiCacheStore` serves one level's
AI output for another level's item.

- Key every entry in `useAiCacheStore` by the Phase 1 uid format:
  `` `${level}-${section}-${lesson}-${n}` `` lowercased. Phase 0 builds this string at the
  call site in the three feature hooks; Phase 1 moves it into the data itself. Do not
  invent a second key format — this one is final.
- Bump the persist config: `version: 2` plus a `migrate` that discards the old cache
  entirely. Stale AI text is not worth a data migration.
- Same treatment for the four loading maps in `useAiUiStore`.

## Task 5 — Markdown styling and sanitization

`MarkdownViewer` uses `prose prose-slate …` classes, but `@tailwindcss/typography` is not
installed, so they do nothing. `index.css` already contains a complete `.markdown-prose`
rule set that nothing references.

- Point `MarkdownViewer` at `markdown-prose` and delete the dead `prose-*` class string.
- `npm i dompurify@^3`; sanitize `marked` output before `dangerouslySetInnerHTML`.
- Do not add `@tailwindcss/typography`.

## Task 6 — Make lint real

The flat config matches `**/*.{js,jsx}`; every source file is `.ts`/`.tsx`, so
`npm run lint` exits 2 having linted nothing.

- Add `typescript-eslint`; extend files to `**/*.{ts,tsx}`; keep the react-hooks and
  react-refresh plugins active on them.
- Fix what it reports. **Scope cap:** if it exceeds ~40 findings, fix all errors, leave
  warnings, and list the deferred rules in `FINDINGS.md`. At most 3 `eslint-disable`
  comments, each with a one-line reason. Never disable a rule repo-wide to get to green.
- The 7 existing `any`s (5 in `ReadingSection.tsx`, 1 each in `KanjiSection.tsx` and
  `AiSettingsModal.tsx`) get real types — they are all trivially inferable from
  `types/ai.ts` and `types/japanese.ts`.
- `.github/workflows/deploy.yml`: run `npm run typecheck && npm run lint && npm test`
  before `npm run build`.

## Task 7 — Sweep

Delete: `src/App.css` (never imported), `src/assets/{react.svg,vite.svg,hero.png}`,
`src/components/common/ApiKeyModal.tsx` (imported by nothing), the Font Awesome CDN
`<link>` in `grammar-app/index.html` (the app uses lucide-react), and the stale
`dist/{kanji,vocab,reading}/` directories.

Rewrite `README.md`'s architecture section: it documents per-app `package.json` files
and a portal landing page that no longer exist. Keep it short and point contributors at
`AGENTS.md`.

## Do not touch

`src/data/**` · `services/ai/prompts.ts` (wording) · `services/ai/providers/**` ·
the three `Section.tsx` components' markup · `readingStorage.ts`

## Acceptance

Each item is verified by running the command, not by reading the diff.

- [x] `npm run typecheck` clean.
- [x] `npm run lint` exits 0.
- [x] `npm test` passes; new tests cover `parseLegacyUrl`.
- [x] `npm run build && npm run preview`, then hard-refresh
      `http://localhost:4173/Nihongo/n3/grammar/5` → lesson 5 renders, URL unchanged.
- [x] In preview, `/Nihongo/` redirects to `/Nihongo/n3/grammar/1` and stays under
      `/Nihongo/`. Browser back button works.
- [x] Reading Studio's lesson dropdown lists real lessons; on N4 it starts at 26.
- [x] Generate AI text for N5 grammar `1-1`, then open N3 grammar `1-1`: no shared text.
- [x] An AI explanation renders with headings, lists and bold styled.
- [x] `grep -rn "prose prose-slate\|font-awesome\|App.css" grammar-app/src grammar-app/index.html`
      returns nothing.

## Commits

1. `fix: serve app from its base path` (tasks 1–2)
2. `fix: pass lesson data to reading studio` (task 3)
3. `fix: namespace ai cache by uid` (task 4)
4. `fix: style and sanitize rendered markdown` (task 5)
5. `chore: lint typescript and gate ci on it` (task 6)
6. `chore: remove dead code and refresh docs` (task 7)
