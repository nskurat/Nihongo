# Refactor: phases and protocol

Full reasoning and evidence behind this plan: the architecture review artifact
(published separately). This directory holds the executable version.

## Protocol for an agent running a phase

1. Read `/AGENTS.md` and **this file**, then **only your phase's spec**. Do not read
   other phase specs — they are out of scope and cost context.
2. Work on a branch: `refactor/phase-N-slug`. Commit in the increments the spec lists.
3. A phase is done when every box in its **Acceptance** section is verified by running
   the command given, not by reading the code.
4. If the spec is wrong or ambiguous, stop and say so. Do not improvise a design
   decision the spec left open — every open decision is a bug in the spec.
5. Scope discipline: touch only the files the spec names. Anything else you spot goes
   in `docs/refactor/FINDINGS.md` as a one-line note. Do not fix it.

## Phase order

Phases are dependency-ordered. Do not start one before its predecessor has landed.

| # | Phase | Spec | Effort | Ready to offload |
|---|---|---|---|---|
| 0 | Triage — fix what's broken in production | `phase-0-triage.md` | ½ d | Yes |
| 1 | Item identity + content schema | `phase-1-identity.md` | 1 d | Yes |
| 2 | Content repository + lazy loading | `phase-2-content-layer.md` | 1–2 d | Yes |
| 3 | Test harness + characterization tests | `phase-3-test-harness.md` | ½ d | Yes |
| 4 | UI consolidation | `phase-4-ui.md` | 1–2 d | Spec after 3 |
| 5 | AI layer unification | `phase-5-ai-layer.md` | ½–1 d | Spec after 3 |
| 6 | Flashcards + quizzes | `phase-6-features.md` | 2–3 d | Design first |
| 7 | CI + accessibility gates | `phase-7-gates.md` | ½–1 d | Spec after 4 |

Phase 3 sits before the UI work on purpose: phase 4 splits a 1,061-line component and
there is currently no way to prove behaviour survived it.

## Decisions already made

These are settled. An agent must not revisit them.

- Base path comes from `VITE_BASE_PATH`, defaulting to `/Nihongo/`. Router basename is
  `import.meta.env.BASE_URL`. Never a literal.
- Item key is `uid`, formatted `{level}-{section}-{lesson}-{n}`, lowercase — e.g.
  `n5-grammar-1-1`. Globally unique, usable as a database primary key. The legacy `id`
  field survives until Phase 2, then goes.
- Markdown styling uses the existing `.markdown-prose` rules in `index.css`.
  No `@tailwindcss/typography` dependency.
- Sanitizer is `dompurify` v3.
- Content stays in per-level, per-section JSON files. No merge into one file.
- Storage abstractions follow `services/ai/readingStorage.ts`: an abstract base class,
  an async facade, and a swap function. Same shape for content and progress.
