# Phase 6 — Flashcards and quizzes

> **Design first, not an execution spec.** This is the point of the refactor. It needs a
> design pass of its own once phases 0–5 have landed and the primitives exist.

## Why it comes last

Every earlier phase exists to make this cheap: uid gives review state something to hang
on, the content repository gives decks a query surface, the test harness makes a
scheduler safe to change, the UI primitives give a quiz somewhere to render.

## Shape being aimed at

- `services/progress/` — same adapter shape as `readingStorage`: `recordReview(uid, grade)`,
  `getDue(scope)`, `getStats()`. LocalStorage now, database later, no caller changes.
- `srs.ts` — scheduling as a pure, unit-tested module with no React and no storage.
- A deck is a *query* over `ContentSource` (one lesson, a level, a tag facet, everything
  due), so flashcards need no new content.
- One `Question` type with several producers — vocab meaning, kanji reading, grammar
  cloze, and the existing AI reading comprehension as one producer among them, not a
  special case. A shared `QuizRunner` renders all of them.
- Routes `/:level/flashcards/:deck` and `/:level/quiz/:mode`, so sessions are linkable
  and resumable, with `React.lazy` per section route.

## Decisions to make before writing the spec

- Scheduling algorithm: SM-2 or FSRS-lite. Affects the progress record shape, so decide
  before `services/progress/` is written, not after.
- Does a quiz session persist mid-run, or is it lost on refresh?
- Do flashcards and quizzes share one progress record per uid, or separate streams?
- Is any of this AI-generated on the fly, or all derived from existing content? (Cost and
  offline behaviour both hinge on this.)
