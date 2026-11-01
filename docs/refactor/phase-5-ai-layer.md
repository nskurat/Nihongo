# Phase 5 — AI layer unification

`useAiStore` carries four parallel cache maps (`generatedExamples`, `aiExplanations`,
`aiVocabNotes`, `aiKanjiMnemonics`), four parallel loading maps and eight copy-pasted
setters; every AI feature adds another pair. Nothing caps the persisted cache, two
clicks send two paid requests, and errors other than a missing key are only
`console.error`ed — on a grammar, vocab or kanji card a failed call just stops spinning.

**Branch:** session branch · **Prereq:** Phases 3–4 merged (done)

## Decisions (settled — do not revisit)

- **Kinds:** `ArtifactKind = 'grammar-examples' | 'grammar-nuance' | 'vocab-help' |
  'kanji-mnemonic'`, with a typed payload per kind. Phase 6 adds kinds as union members.
- **No age-based expiry.** A generated note does not go stale and regenerating costs the
  user money. The cap is by **recency**: at most 400 artifacts and ~1 MB of serialised
  JSON (the reading library shares the same ~5 MB `localStorage`); least recently *used*
  goes first. Reading an artifact on screen counts as use only when it is generated or
  regenerated — no write on render.
- **No abort on unmount.** The request is already paid for; a result that lands after the
  card unmounts is cached and shows next time. (The outline's `AbortController` idea
  would throw away what the user paid for.)
- **One hook per list, not per item:** `useAiArtifacts(kind)` returns `get(uid)`,
  `isLoading(uid)`, `errorOf(uid)` and `generate(uid, producer)`. Cards are rendered in
  `.map()`, where a per-item hook can't be called.
- **Persistence stays on zustand `persist`** (key `ai-generation-cache`, version 8, v7
  data migrated, nothing lost). A repository adapter waits for a real backend; Phase 6's
  progress store is the first to need one.
- **No runtime zod.** The hand-written parsers already check fields; the fix is that a
  bad reply becomes a typed, visible error instead of `[]` or a silent no-op.

## Task 1 — Typed AI errors and one retry

`services/ai/errors.ts`: `AiError` with `kind: 'missing-key' | 'auth' | 'rate-limit' |
'network' | 'bad-response' | 'provider'`, optional `status`, `retryable`, and
`aiErrorMessage(err)` for the UI. Providers throw it (status → kind: 401/403 auth, 429
rate-limit, 5xx provider+retryable, fetch `TypeError` network). `executeAiPrompt` retries
once after a short backoff when `retryable`. Unusable model output (reading JSON that
fails validation, grammar examples that parse to nothing) throws `bad-response`.
`'MISSING_KEY'` string checks become `isMissingKey(err)`.

Tests: status mapping; one retry on 429/5xx/network then success; no retry on 401;
`bad-response` for unusable examples. All at the provider boundary — no network.

## Task 2 — One artifact cache

- `services/ai/artifactCache.ts` (pure, unit-tested): `artifactKey(kind, uid)`,
  `putArtifact(cache, key, data, now)` with LRU eviction to the caps, and
  `migrateV7(state)` turning the four maps into artifacts.
- `store/useAiStore.ts`: `useAiArtifactStore` (persisted artifacts) replaces
  `useAiCacheStore`; `useAiUiStore` keeps only `showKeyModal` / `apiError` /
  `handleApiError`. Per-request status (loading / error) is ephemeral, not persisted.

## Task 3 — `useAiArtifacts(kind)` and the four features

`features/useAiArtifacts.ts`. `generate` de-duplicates in flight (a second click while one
is pending returns the same promise), routes `missing-key` to the key modal, and records
other errors per item. Grammar examples append (existing behaviour); the other kinds
replace. `useGrammar`, `useVocab`, `useKanji` drop their handlers and loading maps; the
cards show an inline error under the AI button (`role="alert"`) with the message from
`aiErrorMessage`.

## Do not touch

Prompts and prompt builders · provider request shapes (headers, bodies) · the reading
library storage (`readingStorage.ts`) · content data.

## Acceptance

- [ ] typecheck, lint, `npm test`, `validate:data`, build — clean; Phase 3/4 tests unedited.
- [ ] A v7 cache in `localStorage` loads with every note and example intact (test).
- [ ] Two rapid clicks send one request (test via `mockAi`).
- [ ] A provider 500 then 200 shows the result; a 401 shows an inline error; neither
      calls `fetch` (tests).
- [ ] `grep -rn "MISSING_KEY'" grammar-app/src` finds only the error class.
- [ ] No `loadingX` / `aiX` map names left in `features/`.

## Commits

1. `docs: write the Phase 5 spec`
2. `feat: typed AI errors with one retry`
3. `refactor: one artifact cache for AI results`
4. `refactor: useAiArtifacts for grammar, vocab and kanji`
