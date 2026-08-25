# Phase 7 — CI and accessibility gates

> **Not ready to offload.** Outline only. Spec after Phase 4, since most of the
> accessibility work lands in the primitives that phase creates.

## Intent

Keep the refactor from decaying. Phases 0–6 are only durable if the checks run
automatically.

## Scope sketch

- CI on pull requests: typecheck, lint, both test projects, `validate:data`.
- A bundle-size budget enforced in CI so the single-file regression cannot return quietly.
  Baseline is the number Phase 2 records in its PR description.
- An error boundary at the app root with a recoverable fallback — there is none today,
  so any render error blanks the page.
- A keyboard and screen-reader pass over modals, tab lists and the lesson sidebar,
  building on the primitives from Phase 4.

## Open decisions for the spec author

- Does CI run against a preview deploy, or is a local build enough?
- Is the a11y check automated (axe in the jsdom project) or a manual checklist?
