# Global search: browser regression (QA + Japanese teacher)

> **Resolved 2026-11-01.** Owner decisions: D1 core items on top, D2 grammar first for an exact
> grammar key unless a basic word matches exactly (teacher's condition), D3 exact hits by level,
> D4 a separate N5 lesson (later folded into N5 lessons 1, 3 and 7 for consistency), D5 signed off. R1–R17 are implemented, with
> engine-level tests in `golden.test.ts` ("regression 2026-11") and the axe gate covering the
> search page and tag view with no exemption. Re-checked in Chromium on the production build.
> Leftovers are in `docs/backlog.md` §3. The sections below are the report as reviewed.

2026-11-01, on `main` after Phase 7. Production build (`npm run build`, `vite preview`), driven by
Playwright in Chromium at 1280 px and 390 px (touch). Queries were **typed into the header search
field** the way a learner does, and the results were read from the screen (group order, the
visible top 8 per group, "Show all" counts, chips, reason lines, live-region text). No AI provider
was called, and the only host contacted was `localhost`. There were 0 console errors.

What ran:

- **QA**: the T-01…T-47 matrix from `02-requirements.md` (59 queries and URLs, ranking level
  N3, as in the first pass). It also re-ran every open bug from `05-qa.md` (BUG-02…17) as a
  flow, ran axe-core in the real browser (so colour contrast was measured), and checked
  mobile layout at 390 px.
- **Teacher**: 160 new learner queries not covered by any test. 90 were at N5 ranking (what a
  beginner types: plain and te-forms, greetings, romaji, English grammar words). 70 were at N3
  (functional grammar by form, kana reading and meaning).
- The engine-level suites (`golden.test.ts` with 44 cases, `teacherRegression.test.ts` with
  69) pass and were not repeated.

Search performance and "Did you mean…?" are out of scope: they are parked in
`docs/backlog-later.md`.

## Verdict

Most of the first round's problems are gone on screen. Exact words now lead for `わかります`,
`よほど` and `かえって`. Core N5 items are visible for `分`, `に` and `lost`. Chips, history,
scroll and modal shortcuts all behave. What is left falls into four groups:

1. The ranking of **function-category members against direct meaning hits** (English
   grammar look-ups).
2. **Group order** when the best hit is a kanji reading or a contained grammar key.
3. **Kana and plain-form look-ups of grammar** whose titles are written in kanji or ます/です.
4. A few **content gaps and data errors** at N5.

## Confirmed fixed (closes earlier items)

- BUG-02, BUG-06: a chip tap opens `?type=grammar&tag=…` with the full list (Degree / Extent:
  45), and the category description is shown.
- BUG-03: `わかります` shows the word first (vocab 2 rows, grammar 1). The `〜ない` and `〜ほど`
  floods are gone.
- BUG-04: `分` puts 自分 at #2, 半分 at #4 and 十分 at #7. `に` puts N5 points at #1–#8.
  `かえって` gives 却って, 帰ります, 反る, 返る, then かえって来ます at #5. 変える and its
  kin are absent, as amended for T-33.
- BUG-05: typing a new query after a chip clears the function filter.
- BUG-07: paste-speed typing then Esc×2 or Back returns to `/n3/grammar/5` (3 of 3 runs).
- BUG-08: scroll is restored by browser Back and by "Back to results" (2000 → 2000 px).
- BUG-09: `/` is ignored while a dialog is open.
- BUG-12: `n` and `x` return nothing.
- BUG-14: no search-specific contrast failures remain. Only the header's `text-indigo-200` is
  left (backlog, Accessibility).
- BUG-16: no fixture chunk in `dist/`.
- BUG-17, mostly: `document.title` follows the query, focus returns to the input after Back,
  and chips come before filters in tab order. The reason-line wording is still open (R11).
- Teacher F2 (`shinbun`/`shimbun`, `konbanwa`, `kan'i`), F5 and F6 for the forms tested
  (`てもいい`, `なければならない`, `たことがある`, `のんだ`, `よんで`, `しなかった`).
- T-43, T-44, T-45 and T-47 pass. At 390 px there is no horizontal overflow.

## Open items for review

Priority: **Must** means a common learner query gets a wrong or empty answer. **Should** means
the right answer is there but noisy or mis-ordered. **Nice** is polish or rare. Owner: **E** is
the engine (`services/search`), **C** is content (`scripts/` → `src/data`), **U** is the UI.

### Must

| ID | Owner | What | Evidence | Proposed fix |
|---|---|---|---|---|
| R1 | E | Members of a function category outrank direct English meaning hits | `as soon as` (N3): the grammar top 8 is 今-時-分です, N(time)に V, Aから Bまで… (Time / sequence members). The five points whose meaning *is* "As soon as ~" (〜次第 N2, 〜か〜ないかのうちに N2, 〜や否や, 〜なり, 〜そばから N1) are not in the top 8. `according to`: 〜によると N3 L17 is not in the grammar top 8, which starts with N は どうですか. `even`: 〜さえ #10, 〜すら #14, 〜でも #22 | Rank meaning hits (english tier) above chip-member rows in every case. Apply the level preference only within a tier |
| R2 | E | Group order puts kanji or a contained grammar key above the exact word | `たべる`, `taberu`, `のむ`, `nomu`: Kanji group first (食, 飲), the word second (also at 390 px). `いくら`, `だれ`, `いく`: Grammar first with a contains match (もし and いくら, A[の中]で…だれ…), the exact word second or third | Choose the first group by best tier, with the vocab lemma tier ("also written") counting as exact. A kanji-reading hit never leads when vocab has an exact or lemma hit |
| R3 | E | Grammar written in kanji can't be found by its kana reading | `うえで` → **0 results** (〜上で N3 L13). `しだい` → vocab only (〜次第 N2 L8 missing). `ぎみ` → **0 results**, although the title is 〜気味（ぎみ） | Index the reading of kanji in grammar titles, including readings given in brackets |
| R4 | E | Plain-form look-ups miss grammar titled in ます/です | `たほうがいい` → **0 results** (N4 L7 `…ほうがいいです`). `かもしれない` → no grammar (N4 L7 `plain form + かもしれません`) | Extend the plain-form keys (teacher F6) to these titles: です → だ/∅, ません → ない |
| R5 | E | Wrong lemma or language for `いく` and `ii` | `いく` → vocab #2 いい with "いく → いい · adverbial (く)". いく is not a form of いい, whose adverbial form is よく. `ii` → no いい at all: grammar "Verb groups (Group II)…" instead | Drop the adverbial-く rule for いい; it applies to よい only. Treat a pure-vowel romaji token as Japanese before English |
| R6 | E | Homophones ignore level for core verbs | At N5 ranking, `いる` → 炒る, 煎る (N2 "roast") above います (N5). `ある` → ある (N3 "a certain") above あります (N5 "have"). `kitte` and `きた` → 斬る "behead" (N2) in the top rows | Inside the exact-reading tier, rank by lowest level, then by lesson |
| R7 | C | 行く N5 L4 is stored with the reading **ゆく** | `go` → vocab #1 "行く ゆく N5 L4", a literary reading for a beginner. Learners typing `iku` get it only through 行きます | Fix the reading to いく in a `scripts/` fix table (as `fix-search-data.ts` does). This also settles teacher F14 (行く/ゆく) |
| R8 | C | Core N5 words missing | `nihongo` → **0 results**: 日本語 isn't in any vocab file. おはよう appears only at N2 L1 ("(abbr.)"), こんにちは at N3 L11, こんばんは at N2 L19 | Add 日本語 and the N5 greetings (teacher F16). Placement needs a decision (D4) |

### Should

| ID | Owner | What | Evidence | Proposed fix |
|---|---|---|---|---|
| R9 | E | "kanji in <phrase>" rows drawn from vocab phrases are noise | `です` → 12 kanji (緑 in 緑が多いです, 耳 in 耳が痛いです…). `きます` → 聞 in 聞きます, 絵 in 絵をかきます. `すら` → 教 in いすらむ教 | Only derive kanji-from-word rows when the query itself contains kanji |
| R10 | E | Short-kana substring noise | `すき` → grammar `V-ます ＋ きる` (match across the normalised `ます＋きる`). `さい` → 7 grammar rows via ください. `だけ` → kanji 砕 (くだ・ける). `きいた` → 北 "similar reading: ほく" | No cross-token contains on structures. Contains on kun readings only at word boundaries. No folded "similar reading" for 3+ kana inflected queries |
| R11 | E/U | The lemma reason line is technical | `わかります → わかる · polite（丁寧）`. The spec asks for `→ 分かる (dictionary form)` (BUG-17 remainder) | Show the dictionary-form *word* rather than the kana key |
| R12 | U | Two a11y findings from axe in the browser | `label-content-name-mismatch` (serious): the level filter buttons read "N5 4" but are labelled "N5, 4 results". `aria-required-children`: the listbox `<h2>` (known), and now also `<h3>` level subheadings in the tag view | Label "N5 4 results" (visible text first). Fix the listbox headings with the existing backlog item |
| R13 | E | An exact grammar key loses to vocab | `みたい` → vocab (見る "want to") above 〜みたいだ (N4). `ます` → 246 vocab rows lead, and grammar Vます comes second | When the query equals a grammar point's key, put Grammar first (D2) |
| R14 | E | Meaning hits that are only substrings of English words | `want` → grammar #1 "Word(s) ですか". `after` and `while` → 今-時-分です at #3. `give` → こと が できます | Whole-word match only for the English tier, and the stem rule only for content words |

### Nice

| ID | Owner | What | Evidence |
|---|---|---|---|
| R15 | C | Grammar the N3 lists teach but the data lacks | `わりに` → only N の 代わりに. `なんか` / `なんて` → vocab N1 only, no grammar point. `なきゃ` → 0 (colloquial なければ) |
| R16 | C | JMdict part-of-speech markers left in meanings | 8 vocab meanings still carry them, e.g. `n2-vocab-14-56` "(n) (a) joy…" and `n2-vocab-1-24` "(col) urine" |
| R17 | E | `分` leads with 分(ぶ) "Edo-era coin" (N3) as the exact hit, above 自分 | Decide whether rare exact hits are demoted (D3) |

## Decisions for you

- **D1. T-37 `lost`**: 無くなる N4 is in the group but at #14, behind "Show all". Is "in the
  group" enough, or must core N4/N5 words make the visible top 8?
- **D2. Exact grammar key** (`みたい`, `ます`): should Grammar lead whenever the query
  equals a grammar key, even if a vocab word matches too?
- **D3. Rare exact hits** (分 → Edo coin, `さけ` → サケ salmon above お酒): keep "exact first", or
  rank exact hits by level, so N5 and N4 come before N3+?
- **D4. Content additions** (R8, R15): add 日本語 and the N5 greetings as new rows at the end
  of the lesson where they are taught (uids stay stable), or under a separate "core
  expressions" lesson?
- **D5. Carry-over**: sign-off of the curated core keys for `が`/`けど` in the "although" chip
  (`aliases.ts`). Today けど and のに are the first two rows, which looks right to the teacher.

## Test-spec amendments (expectations made stale by the content cleanups)

These are not bugs. The data changed after `02-requirements.md` §5 was written:

- **T-02**: 分る N2 L8 was removed by the vocab dedupe. わかる gives 分かる and わかります.
- **T-03**: 簡易 is now N1 L26, not L28.
- **T-27, T-28**: the N5 rows 見る and 食べる were merged away. 見ます N5 L6 and 食べます N5 L6
  carry "also written 見る / 食べる".
- **T-41**: ちょうど is now N5 L22 + N4 L21 (one row, two badges). The N3 rows are gone.
- **T-37**: depends on D1.
