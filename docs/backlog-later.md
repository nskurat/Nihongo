# Parked: far-future, low priority

Ideas deliberately set aside. **Not part of regular work** — don't read this file when
planning or building; `docs/backlog.md` is the working tracker. Revisit only if the audience
grows or the owner pulls an item back.

## Search

- **Performance** (parked 2026-11-01: the audience is small, current speed is acceptable).
  First search, unthrottled desktop, ~0.94 s p75 against a 0.5 s budget; Fast 4G + CPU×4
  1.20 s (ものの) / 1.67 s (食べる) p75. The cost is cold worker indexing; a precomputed key
  format or lazy per-level indexing would cut it. Warm keystroke → results p95 ~160–200 ms
  at CPU×4 against a 100 ms target (QA BUG-10): layout/paint of the result list and the page
  re-render per URL change. Measurements: `docs/search/05-qa.md` §5.
- **"Did you mean…?"** (QA BUG-13, UX F4) — suggest the nearest reading when a query finds
  nothing or only a weaker reading, e.g. `kani` → "Did you mean kan'i (簡易)?". Includes
  n+vowel romaji such as `sannen`, which returns nothing when the word isn't in the data.
  Needs a `didYouMean` field in the search response contract (`services/search/types.ts`).
