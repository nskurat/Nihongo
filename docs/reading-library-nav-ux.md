# Reading Practice: Story Library vs header level, and answers per story

UX spec, root cause and PM acceptance criteria. Builds on `docs/reading-level-switch-ux.md`
(PR #16: one current passage per level). Status: MVP implemented on `claude/reading-library-nav`.

## 1. Problem

**Report (app owner, deployed `main`):** "The story library levels and the header levels are
confusing each other. When I'm on N3, I can see N5 stories in the story library, but when I
navigate to it, I still land on my recent N3 story."

**Repro (no AI call).** Seed `localStorage` with a library of two N3 and two N5 stories, an N3
current passage (Q1 answered) and an N5 current passage. Build, `npx vite preview --port 4230`,
Playwright at 1280 and 390 px:

1. `/n3/reading/1` → **Story Library**. The filter is **N3** (PR #16 already defaults it to the
   header level), so only N3 stories show. N5 stories appear once **ALL** is picked, and ALL then
   **sticks for as long as you stay on N3**: switching to Studio and back keeps ALL. There is no
   hint that the list no longer matches the header.
2. On ALL, **"Practice in Studio"** on an N5 card (or card → quick reader → **"Open in Studio"**).
   The address bar changes to `/n5/reading` **immediately**, but the screen first commits a frame
   with the header still on **N3**, "Configure… (N3)", the chip **"N3 PASSAGE"** and **the N3
   current story** (`N3駅の話`). Only afterwards does it re-render as N5 with the N5 story.
   Measured with a `MutationObserver`: about 100 ms on desktop and about 180 ms with 6× CPU
   throttling (a mid-range phone). The page is smooth-scrolling to the top while this happens,
   so on a phone the first thing you see after the tap is your recent N3 story.
3. **Back** returns to `/n3/reading/1` in **Studio**, not to the library you came from, and the
   ALL filter is gone.
4. Separately: answers were kept **per level**. Re-opening a story from the library always
   started it fresh, and the quick reader kept one flat answer map **shared by every story**:
   answer Q1 in story A, open story B, and B's Q1 already shows as answered.

Screenshots (session scratchpad `shots/`): `reading-nav-before-{1-n3-library,2-n3-library-all,
3-after-practice,3-after-card,2b-modal}-{desktop,mobile}.png`. The intermediate frame is too
short to capture in a still. It is recorded as a frame log (see §8, QA).

**Root cause.** Opening a story from another level is **two updates that React commits
separately**:

| Update | How it was applied | Lane |
|---|---|---|
| Passage slot (`setActiveReadings`), tab (`setActiveTab('studio')`) | Plain `setState` in the click handler | **Urgent** |
| Level, which lives in the URL (`navigate('/n5/reading')`) | React Router 7's `BrowserRouter` wraps every location update in `React.startTransition` | **Transition** |

React renders the urgent update first. `activeLevel` (from the route) is still N3, so the Studio
shows `activeReadings.N3`, the recent N3 story, while `history.pushState` has already put
`/n5/reading` in the address bar. The transition commits the N5 render later. Nothing was lost
or overwritten in storage. The level-change effect suspected in the brief does not exist (PR #16
replaced it with a render-time adjustment), and the persist effect wrote the correct N5 slot. The
bug is purely the **ordering of commits**: the header level and the passage disagreed for a
visible moment, in exactly the direction the owner described. Points 1 and 3 made it worse. ALL
stuck without explanation, the button did not say it would change level, and Back did not undo
the jump.

## 2. Decision

1. **Atomic cross-level open.** The passage, the view and the route change in **one**
   `startTransition`, so no frame ever shows one level's passage under another level. The pure
   `planOpenStory(readings, entry, headerLevel)` returns `{ readings, path }`, and the handler
   applies both together.
2. **The library view lives in the URL.** `?view=library`, plus `&filter=all|n5…` **only when
   the filter differs from the header level**. The filter therefore defaults to and follows the
   header level, survives refresh, and **Back after "Open in N5 →" returns to the N3 library with
   ALL still selected**. Tab and filter changes use `replace`, so they add no history entries.
   Only the level jump pushes one. Switching level in the header while in the library keeps the
   library open and drops the filter, so it follows the new level.
3. **Say where a story will take you.** Cards on the header level say **"Practice in Studio"**.
   Cards from another level say **"Open in N5 →"** (the quick reader's button says the same).
   When the filter is not the header level, a one-line notice reads: "Showing all levels while you
   are on N3. Opening a story from another level switches to that level. **Show N3 only**".
4. **Answers per story** (approved by the owner). `ReadingProgress = { [storyId]: answers }` is
   shared by Studio and the quick reader. Each level's current passage carries its `storyId` (its
   library entry id). A freshly generated passage gets an id up front and is saved to the library
   under that same id. **Start over** (shown only while the story has answers) clears that story's
   answers, which resets the score. Library cards show "Current N3" and "2/5 answered" or "Done
   4/5".

Rejected alternatives:
- *Put the story id in the URL (`?story=…`) and derive the passage from it.* It is also atomic,
  but ids exist in only one browser, so a shared link would open nothing. It would also add a
  second source of truth beside the per-level current passage.
- *Hide other levels' stories completely (no ALL).* That loses a useful overview. Labelling them
  costs less.
- *Open cross-level stories in place without switching level.* That is the PR #16 mislabelling
  bug again.
- *A confirm dialog on Start over.* It clears at most 5 taps of work. The button is explicit and
  only appears when there is something to clear.

## 3. Flows

- **Library on N3:** the filter is N3 and the URL is `/n3/reading/1?view=library`. Pick ALL to get
  `…&filter=all`, the notice and the "Open in N5 →" labels.
- **Open in N5 →:** one commit takes you to `/n5/reading`. The header is N5, the chip reads "N5
  PASSAGE", the story is the one you clicked, and its own saved answers are restored. **Back**
  takes you to `/n3/reading/1?view=library&filter=all`.
- **Practice in Studio (same level):** the Studio opens on the same route with that story and its
  answers. Re-opening the current story changes nothing.
- **Generate:** a new story id is created, the story becomes the level's current passage with no
  answers, and it is saved to the library under that id. Every other PR #16 rule still applies:
  the result goes to the level it was started on, and errors stay on their level.
- **Start over:** the story's answers are removed, so the score, the explanations and the
  completion banner disappear. Other stories are untouched.
- **Delete / Clear library:** the answers of stories that are no longer in the library *and* are
  not any level's current passage are pruned.
- **Refresh / deep link:** `/n3/reading/1?view=library&filter=all` opens exactly that view.
- **Upgrade from PR #16 storage:** each slot's `answers` moves to
  `nihongo_reading_progress[storyId]`. The `storyId` is the library entry with the same level and
  title, otherwise the same title on any level, otherwise a stable `local_{level}_{title}`. The
  active map is rewritten without `answers`. A bare passage from before PR #16 is still mapped by
  title.

## 4. Layout and states

```
Desktop 1280 — Library, filter ALL while on N3
┌ [search…………]  [ALL|N5|N4|N3|N2|N1]                 4 Stories Saved  🗑 Clear ┐
└──────────────────────────────────────────────────────────────────────────────┘
 Showing all levels while you are on N3. Opening a story from another level
 switches to that level.  Show N3 only
┌ JLPT N5  Lesson 3        🗑 ┐ ┌ JLPT N3  General         🗑 ┐
│ N5ねこ                      │ │ N3駅の話                     │
│ …snippet…                   │ │ …snippet…                    │
│ 🕒 10/30/2026  [Open in N5 →]│ │ 🕒 10/29/2026 [Practice in   │
│ Current N5 · 1/5 answered    │ │ Current N3 · 2/5 answered    │
└─────────────────────────────┘ └─────────────────────────────┘

Studio quiz header (story has answers)          Mobile 390: same, the buttons wrap below
┌ 📖 5-Question Comprehension Test   [Score: 1/5 (20%)] [⟲ Start over] ┐
```

| State | Shows |
|---|---|
| Library, filter = header level | No notice. All action labels read "Practice in Studio". |
| Library, filter ≠ header level | Notice with "Show N3 only". Cross-level cards read "Open in Nx →". |
| Library, filter with zero matches | The existing empty card. |
| Card for a level's current story | "Current N3" in indigo under the date. |
| Card with answers | "k/5 answered", or "Done c/5" when all are answered. |
| Studio or quick reader, no answers | No score and no Start over. |
| Studio or quick reader, with answers | Score pill plus **Start over**. |
| Hide English | Unchanged. The new strings are English UI chrome, as elsewhere. |

## 5. Visual spec (reuse only)

- Start over: the white secondary button (`bg-white hover:bg-slate-100 border-slate-300
  text-slate-700 text-xs font-bold rounded-xl`) with the `RotateCcw` icon, and `min-h-10` on
  mobile for the tap target.
- Card action: the existing indigo-50 secondary style plus `min-h-10 sm:min-h-0`. The label comes
  from `openStoryLabel`.
- Notice: `text-xs text-slate-500`, with an inline `text-indigo-700 underline` button.
- Card status: `text-[11px] text-slate-500`, with "Current" in `font-bold text-indigo-700`.

## 6. Accessibility

- The level filter buttons expose `aria-pressed`.
- Every action is a real `<button>` with visible text. The cross-level button's `title` explains
  the switch. No focus is moved.
- The existing `role="status"` live region still announces "N5 passage ready" after a
  cross-level open.
- Contrast: slate-500 and indigo-700 on white both pass AA.

## 7. Hand-off (as implemented)

- `types/ai.ts`: `ActiveReading` gains `storyId` and loses `answers`. New `StoryAnswers` and
  `ReadingProgress`. `SaveHistoryParams.id?`.
- `services/ai/readingSession.ts` (pure, tested): `planOpenStory`, `openStoryLabel`,
  `parseReadingView`, `readingViewSearch`, `withStoryAnswer`, `withoutStoryAnswers`,
  `pruneProgress`, `scoreStory`, `normalizeProgress`, `migrateLegacyAnswers`, `resolveStoryId`,
  `readingFromEntry`, plus the updated `normalizeActiveReadings` and `withReading`.
- `services/ai/readingStorage.ts`: the adapter gains `getProgress` and `setProgress` under the
  key `nihongo_reading_progress`, which migrates legacy answers on read. `createStoryId()`.
  `saveToHistory` accepts `id`.
- `features/reading/ReadingSection.tsx`: view and filter come from `useSearchParams`, the
  cross-level open is atomic, progress is per story (Studio and the quick reader), plus Start
  over, the card labels and status, and the notice.
- `components/common/Header.tsx`: a level switch keeps `?view=library` while in Reading.
- State owners: level, view and filter are in the URL. Passages and progress live in the reading
  storage adapter (via component state). No zustand changes.

## 8. PM: scope and acceptance

**MVP (done):** atomic cross-level open, view and filter in the URL (Back works), explicit
cross-level labels and notice, answers per story with migration, Start over, card status.

**Later:**
- *Should:* a "Your N3 passage is ready" toast for a generation that finishes on another level
  (carried over from PR #16).
- *Could:* sort or filter the library by "in progress" or "not started". Reset the furigana and
  English toggles per story.
- *Won't (now):* a story id in the URL. Ids are local to the browser, so a shared link would be
  meaningless.

**Acceptance criteria (Given / When / Then)**

1. Given I am on `/n3/reading`, when I open the Story Library, then the URL is
   `/n3/reading/1?view=library`, the N3 filter is pressed, and only N3 stories are listed.
2. Given the library filter is ALL while I am on N3, then a notice says I am on N3, N5 cards read
   "Open in N5 →", and N3 cards read "Practice in Studio".
3. Given (2), when I click "Open in N5 →" on `N5ねこ`, then **no frame** shows an N3 passage under
   `/n5/…`, and the page settles on `/n5/reading` with the header on N5, the chip reading "N5
   PASSAGE" and the title `N5ねこ`. The same holds from the quick reader.
4. Given (3), when I press Back, then I am on `/n3/reading/1?view=library&filter=all` with ALL
   pressed.
5. Given I answered Q1 of `N5ねこ`, when I open another story and later reopen `N5ねこ` (Studio,
   quick reader, or after a reload), then Q1's answer, explanation and score are restored, and
   the other story shows only its own answers.
6. Given a story has answers, when I press **Start over**, then its answers and score clear and
   the button disappears. Other stories keep their answers.
7. Given a story has no answers, then no Start over button is shown.
8. Given PR #16 storage (an N3 slot with `answers: {1:0, 2:1}` and no `storyId`), when I open
   Reading, then N3 shows "Score: 1 / 5", the answers are stored under that story's library id in
   `nihongo_reading_progress`, and the active map no longer holds `answers`.
9. Given I am in the library on N3 with ALL selected, when I click N5 in the header, then I stay
   in the library at `/n5/reading/1?view=library` with the N5 filter.
10. No step calls an AI provider. QA seeds `nihongo_reading_history`, `nihongo_reading_active` and
    `nihongo_reading_progress`.

**QA (done):** all ten checks pass at 1280 and 390 in a Playwright script run against
`vite preview`. The frame log for (3) shows `/n5/reading :: …(N3) | N3駅の話` before the fix and
only `/n5/reading :: …(N5) | N5ねこ` after it, both without throttling and with 6× CPU
throttling. Unit tests cover the pure logic in `services/ai/__tests__/readingSession.test.ts`
and `readingStorage.test.ts`.

**Risks:** the atomicity relies on React batching urgent work into the same transition as React
Router's own `startTransition`. If the router stops using transitions this still works, because
the updates are then all synchronous in one handler. Answers for a story evicted from the 30-item
library are pruned on the next delete or clear, unless it is still a level's current passage.
