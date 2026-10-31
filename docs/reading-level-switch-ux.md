# Reading Practice: switching level

UX spec with PM scope for what Reading Practice shows when the user changes the header level
(N5…N1). Status: MVP implemented on `claude/reading-level-ux`, with the "later" items still open.

## 1. Problem

**Report (app owner):** in Reading Practice, picking another level in the header leaves the
same passage on screen. Only its "N3 PASSAGE" chip changes to the new level.

**Repro (no AI call).** Seed `localStorage` with an N3 passage as the active reading, plus a
library holding one N3 entry and one N4 entry. Then:

1. Open `/n3/reading/1` and answer Q1. The N3 passage shows with the chip "N3 PASSAGE".
2. Click **N4** in the header. The URL becomes `/n4/reading/1`, but the **N3 passage stays on
   screen** with the chip now reading **"N4 PASSAGE"**. The Q1 answer and score (1/5) are still
   there. The configure card reads "(N4)", so the screen looks as if N4 produced this text.
3. Story Library: the filter is still `ALL`, so N3 and N4 stories are mixed together.

Screenshots taken before the fix, from Playwright with the build served by `vite preview`:
`before-1-n3-*.png`, `before-2-n4-*.png` (the bug), `before-3-back-n3-*.png` and
`before-4-n4-library-*.png`, each in `desktop` (1280) and `mobile` (390) versions, in the
session scratchpad `shots/` folder. (In full-page shots the sticky header shows up mid-page.
This comes from the capture, not from the app.)

**Root cause (code):**

| What | Where it came from | Effect |
|---|---|---|
| Active passage | One bare `ReadingPracticeData` in `useState`, persisted as `nihongo_reading_active`, with **no level field** | Nothing ties the passage to a level |
| "N3 PASSAGE" chip | `{activeLevel} Passage`, taken from the **route** | Relabels whatever passage is loaded |
| "N3 Immersion", "Configure… (N3)", "General N3" | Route | Correct: these describe the generator |
| Component lifetime | `/:level/reading` uses the same `ContentWrapper` element, so `ReadingSection` is **not remounted** on a level change; all state survives | The passage, answers and error carry over |
| Lesson scope dropdown | Already resets to `all` on level change (render-time adjust) | OK |
| Library level filter | Local state, default `ALL`, ignores the level | Mixed levels |
| In-progress answers | One flat `userAnswers` map, in memory only | Follows the passage to the wrong level; lost on refresh |
| Library "Practice in Studio" on an N4 story while on N3 | Loads it into the single slot, labelled N3 | Same mislabel |

Reading exists only for N5–N3 (`isSectionAvailable` needs grammar plus vocab). Choosing N2 or
N1 from Reading goes to that level's Grammar.

## 2. Decision

**Passages are per level.** Each level keeps its own current passage and answers. Switching
level shows **that level's** current passage. If the level has none, it shows an empty state
offering to generate one or reopen a saved one. The app never relabels a passage. The passage
chip always comes from the passage's **own** level (plus its lesson, when it has one). The library
filter follows the header level (ALL is still one click away). Opening a library story from
another level **navigates to that level**, so URL and content agree.

Rejected alternatives:
- *Keep one passage and show a "This passage is N3" banner:* this keeps the mismatch and only
  explains it. The banner is not needed once passages are per level, so it is deferred.
- *Auto-generate an N4 passage on switch:* spends the user's tokens just because they navigated.
  This breaks the cost rule.
- *Clear the passage on switch:* the user loses work when they glance at another level.
- *Put the passage id in the URL:* a good later step for sharing, but history ids exist only
  in one browser, so it adds little now.

## 3. Flows

- **Switch level (N3 → N4):** the N4 slot is shown. With no N4 passage you get the empty state,
  plus "Open N4 library (k)" when k > 0. Switch back to N3 and the N3 passage returns with its
  answers and score.
- **Generate:** the request is tagged with the level it was started for. If the user switches
  level while it runs, the result still goes to the original level's slot. The other level shows
  the button disabled as "Generating N3 passage…". Only one generation runs at a time.
- **Error:** belongs to the level it happened on. It is shown only on that level and cleared by
  the next generate.
- **Library → Practice in Studio / Open in Studio:** the story becomes the current passage of
  **its own level**, with fresh answers. If that level is not the one on screen, the app goes to
  `/{level}/reading`.
- **Refresh / deep link / Back:** the per-level slots and their answers persist in
  `localStorage`, so a cold load of `/n4/reading` shows the N4 passage. Back goes through the
  levels the user visited, each showing its own content.
- **Upgrade:** older builds stored a bare passage. It is assigned to the level of the library
  entry with the same title (every generated passage is saved there). If no title matches, its
  level is unknowable and it is dropped rather than shown under a guessed level.

## 4. Layout and states

Studio, below the unchanged Configure card:

```
Desktop 1280                                         Mobile 390
┌─ Configure Reading Material (N4) ────────────┐     ┌ Configure (N4) ──────────┐
│ [Lesson scope ▾]        [Topic ▾]            │     │ [Lesson scope ▾]         │
│ [custom topic……………………………………]               │     │ [Topic ▾] [custom…]      │
│                 [✦ Generate N4 Reading Mat.] │     │ [✦ Generate N4 Reading ] │
└──────────────────────────────────────────────┘     └──────────────────────────┘
EMPTY (no N4 passage)                                ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐
┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐     ╎        [📖]            ╎
╎                 [📖]                          ╎     ╎  No N4 passage yet     ╎
╎          No N4 passage yet                    ╎     ╎  Use Generate N4 … (calls╎
╎ Use Generate N4 Reading Material above (calls ╎     ╎  Gemini with your key)… ╎
╎ Gemini with your API key), or reopen a saved. ╎     ╎ [⟲ Open N4 library (1)]╎
╎          [⟲ Open N4 library (1)]              ╎     └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘
└╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘
SAVED (N3 passage)
┌██ [N3 PASSAGE] • Lesson 4 ████████████████████┐
│ 駅での出来事        [Furigana ON|Hover|OFF] [English] [⧉]
└───────────────────────────────────────────────┘
```

| State | Studio shows |
|---|---|
| Loading storage (first paint) | Configure card only. No empty-state flash. |
| Empty, key set | Empty card. Library button if this level has saved stories. |
| Empty, no key | Same card. Generate opens the existing AI settings modal (`MISSING_KEY`). |
| Generating here | Spinner button "Generating 150-Word Passage…". The previous passage of this level stays until the new one arrives. |
| Generating on another level | Button disabled: "Generating N3 passage…". This level's own content stays. |
| Error | The existing rose banner, on the level it belongs to only. |
| Saved / in progress | The passage with chip `{passage.level} Passage • Lesson n`, and its answers restored. |
| Library | Filter preset to the header level. ALL and the other levels stay selectable. |
| Hide English | Unchanged. The empty-state copy is English UI chrome, as elsewhere. |

## 5. Visual spec (reuse only)

- Empty card: the library's empty-state pattern
  (`bg-white rounded-2xl border border-dashed border-slate-300`), with the icon tile
  `w-14 h-14 rounded-2xl bg-indigo-50 border-indigo-100` and the `BookOpen` icon.
- Library button: the existing "Practice in Studio" secondary style
  (`bg-indigo-50 … border-indigo-200`, hover `bg-indigo-600`) plus `min-h-10` for mobile tap size.
- Chip: the existing `bg-indigo-500/30 … text-[10px] uppercase` badge. The lesson suffix uses
  `text-[11px] text-indigo-200`, matching the modal's "• Lesson n".
- The Generate label names the level ("Generate N4 Reading Material"), so the button says
  which level the AI call is for.

## 6. Accessibility

- A visually hidden `role="status" aria-live="polite"` region announces "Generating N4
  passage" and "N4 passage ready".
- The empty state uses real buttons and the existing focus styles. No focus moves on a level
  switch (the header button keeps focus).
- Contrast: slate-500 on white for body text and indigo-700 on indigo-50 for the button both
  pass AA, as they already do in the library.

## 7. Hand-off (as implemented)

- `services/ai/readingSession.ts` (pure, tested): `normalizeActiveReadings` (legacy
  migration and validation), `withReading`, `withAnswer`, `filterLibrary`.
- `types/ai.ts`: `ActiveReading { level, lesson, topic, data, answers }` and
  `ActiveReadings = Partial<Record<LevelType, ActiveReading>>`.
- `readingStorage.ts`: the adapter contract changes from `get/setActiveReading` to
  `get/setActiveReadings`. The `localStorage` key is the same and is migrated on read.
- `ReadingSection.tsx`: per-level slot, a derived `userAnswers`, the `showExplanations` state
  removed (it always equalled "answered"), `generatingLevel` and a level-tagged error, the empty
  state, a level-following library filter, and cross-level open via `navigate`.
- State owners: level stays in the URL. Passages and answers live in the reading storage
  adapter (via component state). No zustand changes.

## 8. PM: scope and acceptance

**MVP (done):** per-level passages, chip from the passage, empty state with library shortcut,
library filter defaulting to the level, cross-level open navigates, answers per level and
persisted, generation and errors bound to their level, legacy migration.

**Later (Should/Could):**
- *Should:* "Your N3 passage is ready — view" toast when a generation finishes while the user is
  on another level.
- *Could:* keep the last N passages per level as a quick switcher. Put the history id in the URL
  (`/n3/reading?story=…`). Reset the furigana/English toggles per level. Mark library stories
  already answered.
- *Won't (now):* auto-generate on level switch.

**Acceptance criteria (Given / When / Then)**

1. Given an N3 passage in Studio, when I click N4 in the header, then that passage is not
   shown, and I see the N4 passage or "No N4 passage yet". No chip ever reads N4 over N3 text.
2. Given I answered Q1 on the N3 passage, when I go N3 → N4 → N3, then Q1's answer, explanation
   and score are restored. The same holds after a page reload.
3. Given an N4 passage exists, when I open `/n4/reading` cold, then it shows with the chip
   "N4 PASSAGE".
4. Given I am on N4, when I open the Story Library, then the filter is N4 and only N4 stories
   are listed until I pick ALL or another level.
5. Given the library is on ALL while I am on N4, when I click "Practice in Studio" on an N3
   story, then the URL becomes `/n3/reading` and the chip reads "N3 PASSAGE" with fresh answers.
6. Given a generation started on N3, when I switch to N4 before it finishes, then N4's content
   is unchanged and its button reads "Generating N3 passage…". When the result arrives it is the
   N3 passage and appears under N3.
7. Given a generation error on N3, when I switch to N4, then no error banner shows on N4.
8. Given storage from an older build (a bare passage whose title matches an N3 library entry),
   when I open Reading, then it appears under N3 only.
9. No step above calls an AI provider. QA seeds `localStorage` (`nihongo_reading_active`,
   `nihongo_reading_history`) and never clicks Generate with a real key.

**QA states to check** at 1280 and 390 px: empty with and without library entries, saved, mid-quiz
then switch and back, reload, cross-level open, legacy storage, no key (Generate opens the
modal), and Hide English on.

**Risks:** 6 and 7 cannot be tested end to end without mocking `executeAiPrompt`. They are
covered by code review and the level-tagged state. A legacy passage with no library match is
dropped, which is accepted because every generated passage is also saved to the library
(30-item cap).
