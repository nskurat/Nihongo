# Phase 5 — AI layer unification

> **Not ready to offload.** Outline only. Spec after Phase 3; can run in parallel with
> Phase 4 as it touches different files.

## Intent

`useAiStore` carries four parallel cache maps and four parallel loading maps, with four
copy-pasted setters. Every AI feature adds another quadruple. There is no request
de-duplication, no TTL and no size cap — `localStorage` holds roughly 5 MB.

## Scope sketch

- One shape: `aiArtifacts: Record<Uid, Record<ArtifactKind, { status, data, error, ts }>>`.
- One hook, `useAiArtifact(uid, kind)`, replacing the four near-identical feature handlers.
- In-flight de-duplication, TTL, LRU eviction sized against the quota, `AbortController`
  cancellation on unmount.
- Typed error taxonomy in `executeAiPrompt` (missing key, rate limit, network, bad JSON),
  one backoff retry on transient failures, and strict parsing of model JSON instead of
  stripping code fences by hand.

## Open decisions for the spec author

- The exact `ArtifactKind` union — driven by what Phase 6 needs, so sequence accordingly.
- TTL and cache-cap numbers, and whether eviction is by age or by recency.
- Whether cached artifacts move behind a repository (like content and progress) now,
  which is what a future per-user backend would want.
