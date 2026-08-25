# Phase 1 — Item identity and content schema

Give every study item a globally unique, stable key, and stop bad content shipping
silently. This is the prerequisite for progress tracking, decks, and any database.

**Branch:** `refactor/phase-1-identity` · **Prereq:** Phase 0 merged

## Task 1 — The shared item type

New file `grammar-app/src/types/content.ts`:

```ts
export type Level = 'N5' | 'N4' | 'N3';
export type ContentSection = 'grammar' | 'vocab' | 'kanji';

/** Globally unique, stable, safe as a database primary key. */
export type Uid = string; // `${lowercase level}-${section}-${lesson}-${n}`

export interface StudyItem {
  uid: Uid;
  level: Level;
  section: ContentSection;
  lesson: number;
}
```

In `types/japanese.ts`, make `GrammarItem`, `VocabItem` and `KanjiItem` extend
`StudyItem`. Keep the legacy `id` field declared and optional — Phase 2 removes it.
Re-export `LevelType` as an alias of `Level` so nothing else has to change yet.

`SectionType` stays in `japanese.ts` and keeps `'reading'`; `ContentSection` is the
subset that has lesson-keyed JSON behind it. They are not the same type — do not merge them.

## Task 2 — Uid migration script

New `scripts/add-uids.ts`, run once via `npx tsx scripts/add-uids.ts`:

- For each of the nine `src/data/{n5,n4,n3}/{grammar,vocab,kanji}.json` files, add `uid`,
  `level`, `section` and `lesson` to every row, in that order, as the first fields.
- `n` is the item's 1-based index within its lesson array. Uid example: `n5-grammar-1-1`.
- Leave the existing `id` values untouched.
- Idempotent: re-running produces no diff. Preserve key order and 2-space formatting so
  the diff stays reviewable.
- Commit the script and the rewritten JSON together.

## Task 3 — Content validation

New `scripts/validate-content.ts` using `zod`, wired to `npm run validate:data` and run
in CI before build.

**Errors (exit 1):** schema violation; missing or malformed `uid`; duplicate `uid`
anywhere across all nine files; `lesson` outside the level's range from `utils/levels.ts`;
`level`/`section`/`lesson` disagreeing with the uid.

**Warnings (exit 0, printed, written to `docs/refactor/FINDINGS.md`):** `strokes: 0`;
empty `radical`; a `meaning` identical to that row's `exampleEn`; empty `examples` on a
grammar item.

The warning list is deliberate. Known bad rows exist — N3 kanji 迷 has
`"meaning": "I lost my way."` copied from its example sentence, and `strokes: 0` runs
through the whole N3 kanji file. **Do not fix content in this phase.** Fixing it needs
Japanese source material, not code; the validator's job is to surface it.

## Task 4 — Switch the code to uid

Mechanical, and the reason the uid work is worth doing now rather than later.

- `features/{grammar,vocab,kanji}/use*.ts`: drop the ad-hoc key building added in Phase 0
  task 4; pass `item.uid` straight through to the AI store.
- The same three `Section.tsx` files and `GrammarDetailModal.tsx`: React `key={item.uid}`.
- `useGrammar`'s `stampItems` helper is now redundant — level and lesson live in the data.
  Delete it, and give vocab and kanji the same fields they were previously missing.
- Bump `useAiCacheStore` to `version: 3` with a discarding `migrate` only if the key
  format actually changed from Phase 0. If it did not, leave the version alone.

## Do not touch

Content *values* in `src/data/**` (structure only, via the script) ·
`services/ai/**` · any component markup beyond the `key` prop

## Acceptance

- [x] `npm run typecheck` clean; `npm run lint` exits 0; `npm test` passes.
- [x] `npm run validate:data` exits 0 and prints the warning list.
- [x] `npx tsx scripts/add-uids.ts && git diff --exit-code` — second run is a no-op.
- [x] `grep -c '"uid"' src/data/*/*.json` — every file non-zero, and the total equals the
      row count reported by the validator.
- [x] No duplicate uid: the validator proves this; it must fail if you deliberately
      duplicate one, so test that once before finishing.
- [x] App still renders all three sections at all three levels, N4 lessons 26–50 included.
- [x] AI generation on an N5 item and its N3 ID-twin produce independent results.

## Commits

1. `feat: add StudyItem type with uid`
2. `feat: add uid migration script` (+ regenerated JSON)
3. `feat: validate content at build time`
4. `refactor: key items by uid`
