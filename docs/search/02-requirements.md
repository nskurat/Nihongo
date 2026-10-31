# Global search: product requirements

Status: revised after UX (`03-ux.md`) and data (`04-data.md`) designs, and re-verified against data at merge
`36e400b` (kanji/vocab review, PR #11) · Inputs: `01-teacher.md`, the app as of 2026-10-31 (`App.tsx`, `Header.tsx`, `features/*`, `types/`, `data/`, `utils/tags.ts`, `services/content/`).

The data has changed since the teacher's survey. N2 vocab and kanji have landed, and the PR #11 review replaced rare
spellings with common ones (何時も→いつも) and added or removed some N1/N2 words. The corpus is now **696 grammar points,
9,171 vocab rows (N5 759, N4 763, N3 3,202, N2 1,588, N1 2,859) and 2,214 kanji**: 12,081 items, 4.8 MB raw JSON.
Romaji exists only on N5/N4 vocab (559 rows). `pos` also exists only there, and is often just
`verb` without a group.

---

## 1. Problem, users, goals

**Problem.** Each section has a filter box today (`GrammarSection`, `VocabSection`,
`KanjiSection`), but it only filters the one lesson already on screen. A learner who meets
〜ものの in a reading, or wants "every way to say *although*", has to guess the level and
lesson, then page through up to 32 lessons. Grammar carries 66 function tags, but no screen
lets you browse by tag.

**Personas**

| Persona | Level | Types | Needs |
|---|---|---|---|
| **Beginner (no IME)** | N5–N4 | romaji, English (`taberu`, `classroom`) | Find the word and see which lesson teaches it |
| **Beginner (IME)** | N5–N4 | unconverted kana, polite forms (`わかります`, `たべます`) | Get from a form they saw to the entry |
| **Intermediate reader** | N3–N2 | pasted kanji or inflected words (`迷惑`, `待たされた`), grammar cores (`ばかり`) | Look something up while reading, then jump to the lesson |
| **Exam reviewer** | N2–N1 | functions and tags (`although`, `comparison`, `degree/extent`) | Compare all points with one function across levels |

**Goals**
- G1. One search box, reachable from every page, that searches every level and lesson across grammar, vocab and kanji.
- G2. Results are grouped by type. Each result shows a level and lesson badge, and one tap opens the lesson with that item in view.
- G3. Learners can find grammar by function (tag or English alias) and see every related point across levels.
- G4. A search state can be shared as a URL, and existing lesson navigation (`/:level/:section/:lesson`, legacy redirects) works exactly as it does today.
- G5. Search uses only static files and a build-time index. The query and index contract stays behind the existing `ContentSource.search` adapter, so a hosted database can replace it later without UI changes.

**Non-goals (explicit)**
- No AI or provider call at any point in search, including "did you mean" and query expansion. AI calls cost the user money.
- No backend, proxy, analytics or query logging. Recent searches stay on the device, if we keep them at all.
- No general dictionary. Words that are not in our data return no word match (for example `丁度`). At most, their individual kanji are shown (US-9).
- Full-text search of `explanation`, `details` or examples is out of MVP. The teacher points out that these fields name other grammar points constantly, so they add noise.
- No handwriting or radical input, and no stroke-count search.
- Reading Practice (AI-generated, stored per user) is not indexed.
- MVP does not re-tag any grammar. Generated `data/*.json` is never hand-edited (AGENTS.md).

---

## 2. User stories and acceptance criteria

IDs are referenced from §3 and §5. "Index" means the build-time search index (§4).

**US-1 Global entry point.** *As any learner, I can open search from any page.*
- Given any route, when I press `/` or `Ctrl/Cmd+K` outside a text field, or tap the header search icon, then the search input gets focus.
- Given I am on `/n3/grammar/5`, when I open search and then close it with `Esc` or back, then I return to `/n3/grammar/5` at the same scroll position.

**US-2 Query by script.** *As a learner, I can type kanji, hiragana, katakana, romaji or English.*
- Given the query `たくしー`, then タクシー matches: kana is folded both ways and NFKC is applied.
- Given `kyoushitsu`, `kyōshitsu` or `kyousitu`, then 教室 (N5 L3) matches. Romaji is converted to kana and matched against `reading`, never against the stored `romaji` field.
- Given `kan'i`, then 簡易 (N1 L28) matches. Given `kani`, then 簡易 does not match: `n` before a vowel is never read as ん.
- Given `〜ばかりか`, `~ばかりか`, `～ばかりか` or `ばかりか`, then the results are identical.
- Given an English word, then it matches whole words in `meaning`, plus `summary` for grammar, with light stemming. `lost` finds `lose [one's way]`. `even` never matches `event`.

**US-3 Inflected forms.** *As a learner who pastes what I read, I find the dictionary entry.*
- Given `わかります`, then I see わかります (N5 L9) as an exact hit and 分かる (N5 L4) as a lemma hit.
- Given `待たされた`, then 待つ (N5 L14) appears with the line "待たされた → 待つ (causative-passive, past)".
- Given an ambiguous form (`かえって`), then every candidate lemma that exists in the index is shown: 帰る and 変える. Lemmas that are not in the index are never shown.
- Deinflected hits rank below exact hits on the cleaned key, and **above** literal prefix and contains matches (`04-data.md` §3.5). Otherwise a short form like `きた` would fill the vocab group with prefix hits (汚い, 北半球, 帰宅…) and push 来る and 着る out.

**US-4 Orthographic variants and markup.** *Teaching markup does not block matching.*
- Given a stored word with brackets, slashes or 〜 (`迷う [道に〜]`, `[お]花見`, `よっぽど/よほど`, `〜つつ（も）`), when I type the bare form, then it matches. The stored display string is shown unchanged.
- Given `花見`, then `[お]花見` matches. Given `さけ`, then 酒 (exact) ranks above お酒 (お-alias).
- Kanji readings in all three separator styles (`たか.い`, `まよ・う`, `な.き-`) match both the full reading and the stem.

**US-5 Grammar by form, meaning and function.**
- Form: given `いただけませんか`, then `Vて-form + いただけませんか` matches. Placeholders such as `V`, `N`, `A`, `B`, `S1`, `-form` and `(place)` are stripped from the key.
- Meaning: given `although`, then the grammar group lists the 8 points whose `meaning` contains "although". `explanation` is not searched.
- Function: given a tag label or alias (`comparison`, `degree/extent`, `contrast`), then a **category chip** appears above the results ("Comparison · 17 points"). Tapping it applies the category filter (`cat=comparison`). Given the URL `?tag=comparison`, then exactly the 17 points with that tag are listed, ordered by level and then lesson.

**US-6 Kanji by character, reading and meaning.**
- Given one kanji (`因`), then that kanji (N3 L21) is result #1 and the kanji group is shown first.
- Given `mei` or `めい`, then every kanji with on'yomi メイ is listed, ordered by level and then lesson (明 N5 L16 first).
- Given a kanji word (`迷惑`), then the vocab hit comes first. Each character of the query that exists as a kanji row (迷, 惑) also appears in the kanji group.

**US-7 Grouped results and deep links.**
- Results are grouped as Grammar, Vocabulary and Kanji. The group order follows the query script: a single kanji puts Kanji first, kana or 〜 puts Grammar first, English puts Vocab first. Each group shows its count and up to 8 rows, with "Show all N".
- Each row shows the display form, the reading (furigana or kana), a meaning truncated to one line, and a badge such as `N3 · L12`.
- When I activate a row, the app navigates to `/:level/:section/:lesson?focus=<uid>`, and the item is scrolled into view and highlighted. The lesson renders exactly as it does when reached from the header. *(Amended, decided by the orchestrator after UX.)* Grammar does **not** auto-open the detail modal. The highlighted card's Deep Dive button gets focus, so one `Enter` opens it. Grammar therefore behaves like vocab and kanji, and the lesson context stays visible.
- Within a tier, items from my current header level rank first, then lower levels (review), then higher levels.

**US-8 Filters.**
- Level (N5–N1, multi-select), type (Grammar, Vocab, Kanji), and either one tag or one alias category. Tag and category apply to grammar only, so choosing one implies Grammar.
- Given `ばかり` with level N2, then exactly 〜ばかりか, 〜ばかりだ and 〜ばかりに appear.
- Filters are reflected in the URL and survive reload. *(Decided.)* Multi-value filters are comma lists in uppercase canonical form (`level=N2,N3`, `type=grammar,vocab`). A tag uses `tag=<tag id>`. An alias category uses a separate `cat=<category id>`. `tag` and `cat` are mutually exclusive, and setting one clears the other. Unknown values are dropped and the URL is rewritten clean (`03-ux.md` §3.4).

**US-9 Empty, short and error states.**
- An empty query shows hints ("Try 食べる, taberu, although, or a tag") plus tag chips grouped by facet. There are no results and no network request beyond loading the index.
- A query of one kana runs exact matching only: grammar whose cleaned key equals the query, and vocab words or readings that equal it. Contains-matching starts at 2 kana. A single kanji is always a full query.
- Zero results show "No results for "…"". If filters are active, it offers "Clear filters (n hidden)". It never offers AI.
- *(Decided.)* A kanji query with no word match whose characters exist as kanji rows shows the **no word match** state: "No word matches 丁度. Kanji in your query: 丁 · 度", listing those kanji results. It also suggests searching by reading.
- If the index fails to load, show the existing `ContentError` pattern with Retry. Lesson navigation must keep working.

**US-10 Keyboard, mobile, accessibility.**
- `↑`/`↓` move through results across groups, `Enter` opens one, `Esc` clears the query and then closes search. Focus order is input, chips, filters, results.
- On a phone (360 px), search opens full screen. Touch targets are at least 40 px (matching the header's `max-md:min-h-10`). The IME composition must not trigger searches mid-composition. Search runs on `compositionend` or once the input is no longer composing.

**US-11 Shareable URL.**
- Given I search for `ものの` with level N2, then the URL becomes `…/Nihongo/search?q=ものの&level=N2`, built from `import.meta.env.BASE_URL` and never a hardcoded path. Opening that URL in a fresh browser reproduces the same results.
- Typing replaces the history entry (`replace`). Opening a result pushes one, so Back returns to the results.
- `/search` must not collide with `/:level/:section` or with the legacy `?level=&section=&lesson=` redirect. `q`, `level`, `type`, `tag`, `cat`, `more` and `focus` are reserved for search.

---

## 3. Prioritisation

### MVP (ship now)

| # | Requirement | MoSCoW | Rationale |
|---|---|---|---|
| 1 | Global entry, `/search` route, grouped results, badges, deep link with scroll-to-item (US-1, 7, 11) | **Must** | This is the user's ask. A hit is useless if the learner cannot reach its lesson. |
| 2 | Normalisation: NFKC, katakana↔hiragana, 〜/~/～/- folding, cleaned keys (brackets, `／`, `（）`, placeholders, reading separators) (US-2, 4, 5) | **Must** | Without it, even exact queries fail on the raw strings (`迷う [道に〜]`). Cheap. |
| 3 | Romaji→kana (Hepburn, kunrei, IME, `n'`) matched against `reading` | **Must** | N5/N4 users cannot type kana, and 94% of vocab rows (and all kanji rows) have no romaji. |
| 4 | Verb and い-adj lemma per vocab row at build time, plus a query deinflector (masu, te/ta, nai, tai, potential, passive, causative(-passive), volitional, ba, i-adj forms; irregular table; depth ≤3) | **Must** | N5/N4 store `食べます` and N3+ store `食べる`. Today `わかります` and `分かる` never meet. |
| 5 | Grammar search on form (title, structure) and meaning (meaning, summary) | **Must** | 70% of grammar lookups are by form (teacher). |
| 6 | English whole-word search with light stemming (`-s/-ed/-ing` plus a ~50-entry irregular list) | **Must** | The second most common query type. |
| 7 | Tag filter and tag chips over the **existing 66 tags**, matched on tag id and label (`degree/extent` → `degree-extent`) | **Must** | Answers the user's "tag search" directly, with zero data change. |
| 8 | Ranking tiers, current-level-first ordering, single-kana guard | **Must** | Stops `の` from returning 4,000 rows on first impression. |
| 9 | Level and type filters, empty, zero and error states, keyboard and mobile, a11y (US-8, 9, 10) | **Must** | Baseline quality, and WCAG AA is a requirement. |
| 10 | **Function alias layer** (`search-aliases.json`): English alias → one or more existing tags, shown as category chips (teacher §4 table, mapped to current tags only) | **Should** | High value for exam reviewers. It is a static side file, not a re-tag. |
| 11 | Show the deinflection path | **Should** | The teacher says learners value the explanation as much as the hit. Deinflector output is already available. |
| 12 | Long-vowel-folded reading match (`kyoshitsu`, `tokyo`), ranked below exact | **Should** | Catches Hepburn typists who leave out macrons. Low cost, contained to its own tier. |
| 13 | Kanji-from-word decomposition (`迷惑` → 迷, 惑) and kanji `compounds` as a low tier | **Should** | Cheap, and a common study habit. |
| 14 | お/ご aliasing and a small okurigana variant list (`分る/分かる`, `終る/終わる`, `行なう/行う`) | **Could** | Rare, but a visible failure when it misses. A hand list of about 10 entries. |
| 15 | Collapse duplicate vocab into one row with several badges (ちょうど N4 L21, N3 L1, N3 L15) | **Could** | Reduces clutter. The primary link follows Q-UX3 (answered, UX §3.3). |

### v2 and later

| Requirement | MoSCoW (now) | Rationale |
|---|---|---|
| New tags *addition*, *approximation*, *range/scope*. Split *concession* from *contrast* and *topic/regarding* from *standpoint*. Merge `completion`/`creation-completion` and the duplicate `nominalizer`/`demonstrative` | **Won't (MVP)**, v2 | Correct, but it is a data migration through `scripts/` with teacher review of about 130 points. It must not block search. Meanwhile meaning search already finds "addition" points (§5 T-13). |
| Recent searches (localStorage, per device) | Won't (MVP) | Nice to have. Never sent off-device. |
| Radical filter | Won't | Useful only to advanced users (teacher). |
| Search in explanations and examples (opt-in "search full text") | Won't (MVP) | Noise risk. Revisit with a field-weighted engine. |
| Hosted search database | Won't (MVP) | Enabled by G5. Nothing in MVP may depend on a server. |

**Decision on the teacher's taxonomy proposal.** We **accept the analysis** but **descope the
re-tagging**. MVP ships the teacher's display categories as an *alias layer only*: 23 of the 26 proposed categories. Each category lists
the existing tag ids it covers and its English aliases. The three categories that need new tags
(*Addition*, *Approximation*, *Range*) do not ship as chips in MVP, because without new tags a
chip would either be empty or depend on a hand-picked uid list, which amounts to un-reviewed
re-tagging. Until v2, *Concession* and *Contrast* both map to `concession-contrast`, and the chip
is labelled "Concession / Contrast" so it does not promise a distinction the data cannot make.
Ambiguous short words (*so, but, as, for, even, about*) show several chips instead of a guessed
list, as the teacher recommends. The v2 re-tag is a generated-data change: a migration script
plus validator (`validate:data`) and teacher sign-off.

---

## 4. Non-functional requirements

**Architecture constraints.** The index is produced at build time from `src/data/*.json`
(script in `scripts/`, output emitted as hashed static assets) and loaded lazily on the
first open of search, never on app start. Lesson pages must not pay for it. Queries run in
the browser, ideally in a Web Worker. The UI talks only to `ContentSource.search` (extended
to cross-level and cross-section scope), so a hosted database can implement the same contract
later. The index format is versioned and documented as a data contract: per-item `uid`,
`level`, `section`, `lesson`, display fields, `keys[]` with tier weights, `lemma`, `tags`.

| Metric | Budget | Notes |
|---|---|---|
| Index size, all levels, gzip | **≤ 400 KB** total. Grammar and tag shard **≤ 80 KB** | A naive projection of display fields alone measures about 360 KB gzip. Keys must be compact (shared strings, no `explanation`). Sharding by type lets grammar and tag queries start early. |
| First search, cold, including index fetch and parse | **≤ 1.5 s p75** on Fast 4G, mid-range phone. **≤ 500 ms** on desktop broadband | Show a skeleton immediately. The index may also be prefetched once the input gets focus. |
| Keystroke to results update (warm) | **≤ 50 ms p95** on a mid-range phone for 12.1k items. Input debounce ≤ 100 ms | The main thread must never block for more than 50 ms (no long tasks). |
| Tag filter apply | ≤ 50 ms | |
| Initial app bundle | **+≤ 15 KB gzip** | The search UI shell only. Romaji and deinflector tables ship with the index chunk. |
| Memory | ≤ 30 MB extra heap with the index loaded | |

**Offline and static.** Search works with no network once the index is cached (HTTP cache;
same behaviour as the lesson chunks). It makes no third-party requests and has no runtime
dependency on any API. All URLs derive from `import.meta.env.BASE_URL`.

**Accessibility (WCAG 2.2 AA).** Use the combobox/listbox pattern (`role="combobox"`,
`aria-expanded`, `aria-activedescendant`), and give each group a heading. A polite live region
announces "12 results: 3 grammar, 7 vocabulary, 2 kanji", debounced and only after typing
pauses. The zero-result state is also announced. Japanese text carries `lang="ja"`, so screen
readers switch voice. Colour contrast is ≥ 4.5:1, and tag colours never carry meaning alone.
The visible focus ring meets 3:1. Everything works at 200% zoom and in 320 px reflow.

**i18n.** The UI is English. All search UI strings live in one module (no inline literals in
logic), so a later translation is mechanical. Content language is unchanged. English matching
is English-only in MVP.

**Quality.** Normalisers, the romaji converter, the deinflector, the key builder and ranking
are pure modules in `services/search/` or `utils/` with unit tests (AGENTS.md). The §5 table
becomes a vitest fixture run against the real built index. `typecheck`, `lint` and
`validate:data` stay clean. Tests never call AI.

---

## 5. Acceptance test list

Every expected item below was re-checked against `src/data/*.json` at merge `36e400b` (after the PR #11 vocab review). Badge format:
`Level Lesson` plus uid. "Top" means first in its group. "Contains" means present in the
group, at any rank, without "Show all".

| # | Query / state | Expected | Story |
|---|---|---|---|
| T-01 | `わかります` | Vocab: わかります N5 L9 (`n5-vocab-9-1`) top. 分かる N5 L4 (`n5-vocab-4-41`) as lemma hit. Grammar contains `N が あります／わかります…` N5 L9 | US-3 |
| T-02 | `わかる` | Vocab top 分かる N5 L4. Contains 分る N2 L8 (`n2-vocab-8-57`) and わかります N5 L9 | US-2/3 |
| T-03 | `kan'i` | Vocab top 簡易 かんい N1 L28 (`n1-vocab-28-28`) | US-2 |
| T-04 | `kani` | 簡易 **not** in results | US-2 |
| T-05 | `因` | Kanji group first. 因 N3 L21 (`n3-kanji-21-12`) is result #1 | US-6 |
| T-06 | `分` | Kanji group first: 分 N5 L4. Vocab contains 自分 N5 L4, 十分 N4 L7, 半分 N4 L19. Grammar contains `今 -時-分です` N5 L4 | US-6/7 |
| T-07 | `ぷん` and `pun` | Kanji contains 分 N5 L4 (on'yomi プン) | US-6 |
| T-08 | `mei` (= `めい`, `メイ`) | Kanji: 明 N5 L16, 名 N5 L18, 迷 N3 L1, 命 N3 L1, 鳴 N3 L12, 謎 N3 L14, 盟 N1 L2, 銘 N1 L12, in that order | US-6 |
| T-09 | `although` | Grammar = exactly these 8: けど／けれども N5 L8, 〜ながらも N3 L8, 〜といっても N3 L9, 〜ものの N2 L4, 〜つつ（も） N2 L4, 〜とはいえ N1 L1, 〜ものを N1 L1, 〜ところを N1 L32 | US-5 |
| T-10 | tag filter `comparison` (`?tag=comparison`) | Exactly 17 grammar points, first `Aは Bより adjective です` N5 L12, last 〜きっての N1 L26. Includes 〜に比べて N3 L18 | US-5/8 |
| T-11 | `comparison` typed | Chip "Comparison · 17" shown. Grammar group contains 〜に比べて N3 L18 | US-5 |
| T-12 | `degree/extent` | Chip "Degree / Extent · 45". Tapping it lists 45 points incl. 〜ばかりか N2 L9, 〜ずつ N3 L5, 〜だらけ N3 L7 | US-5 |
| T-13 | `in addition` / `not only` | Grammar contains それに N4 L3, さらに N3 L3, 〜上に N3 L13, 〜ばかりでなく／〜だけでなく N3 L5, 〜に加えて N2 L1, 〜ばかりか N2 L9, 〜のみならず N1 L22 (meaning search; no new tag needed) | US-5 |
| T-14 | `contrast` | Chip "Concession / Contrast · 49". Grammar also contains 〜に対して N3 L8 (meaning "In contrast to"; it is tagged `viewpoint-standpoint` only), 〜反面 N2 L4, 〜にひきかえ N1 L21 | US-5 |
| T-15 | `ものの` | Grammar first. 〜ものの N2 L4 is #1 | US-5/7 |
| T-16 | `ばかりか`, `〜ばかりか`, `~ばかりか`, `～ばかりか` | Four identical result lists, top 〜ばかりか N2 L9 | US-2 |
| T-17 | `ばかり` | Grammar first, containing all 8: N4 L21 `Vた-form ＋ ばかりです`, N3 L5, N3 L9, N2 L9, N2 L17, N2 L19, N1 L17 ×2 | US-5/7 |
| T-18 | `ばかり` + level N2 | Exactly 〜ばかりか, 〜ばかりだ, 〜ばかりに | US-8 |
| T-19 | `わけにはいかない` | Grammar top 〜わけにはいかない N3 L18 | US-5 |
| T-20 | `いただけませんか` | Grammar top `Vて-form + いただけませんか` N4 L1. Contains N4 L8 (`"S" … と伝えていただけませんか`) and N4 L23 (causative) | US-5 |
| T-21 | `迷う` | Vocab top `迷う [道に〜]` N3 L1, displayed with the bracket | US-4 |
| T-22 | `迷惑` | Vocab top 迷惑 N3 L12. `かける [迷惑を〜]` N3 L12 ranked below it. Kanji contains 迷 N3 L1 and 惑 N1 L4 | US-4/6 |
| T-23 | `花見` | Vocab contains `[お]花見` N5 L6 | US-4 |
| T-24 | `ありがとう` / `arigatou` | Vocab top `[どうも]ありがとう[ございます]` N5 L2 (`n5-vocab-2-10`). The PR #11 review removed N1 有難う, so it is the only row | US-4 |
| T-25 | `さけ` | Vocab: 酒 N3 L10 above お酒 N5 L6 | US-4 |
| T-26 | `たくしー` | Vocab top タクシー N5 L16 | US-2 |
| T-27 | `ミル` | Vocab contains 見る N5 L9 (and 見ます N5 L6 via lemma) | US-2/3 |
| T-28 | `食べる` / `taberu` | Vocab contains 食べる N5 L7 and 食べます N5 L6 | US-3 |
| T-29 | `食べられない` | 食べる N5 L7 and 食べます N5 L6 with the path "→ 食べる (potential/passive, negative)" | US-3 |
| T-30 | `待たされた` | 待つ N5 L14, path shows causative-passive, past | US-3 |
| T-31 | `読まずに` | Vocab 読む N5 L9. Grammar contains 〜ずに N3 L10 | US-3/5 |
| T-32 | `高かった` / `寒くて` | 高い N5 L8 / 寒い N5 L5 | US-3 |
| T-33 | `かえって` | 帰る N5 L9 and 変える N4 L10 both shown in the deinflected tier. *(Amended.)* They rank **above** the literal prefix hit かえって来ます N4 L21, which still appears in the Vocabulary group | US-3 |
| T-34 | `きた` | Vocab: 北 N5 L20 (exact reading きた) first. Then 来る N5 L4 and 着る N5 L22 (deinflected tier) above every prefix hit (帰宅, 期待…). Kanji contains 来 N5 L4 and 北 N5 L20 (kun きた) | US-3/6 |
| T-35 | `kyoushitsu`, `kyōshitsu`, `kyousitu` | Vocab top 教室 N5 L3. `kyoshitsu` also finds it (Should #12, folded tier) | US-2 |
| T-36 | `jouzu` / `zyouzu` / `kitte` | 上手[な] N5 L9 / 上手[な] N5 L9 / 切手 N5 L11 | US-2 |
| T-37 | `lost` | Vocab contains 迷子 N3 L8, 無くなる N4 L13, 迷う N3 L1 (stem "lose"). Kanji contains 迷 N3 L1 | US-2 |
| T-38 | `even` | Grammar does **not** contain `A(place)で Bが あります` N5 L21 (meaning has "event" only) | US-2 |
| T-39 | `に` (single kana) | Grammar contains `N(time)に V` N5 L4 and `N(person)に あげます、etc.` N5 L7. Vocab only exact readings (二 N5 L2 `n5-vocab-2-29`, 荷 N1 L17 `n1-vocab-17-61`). Total ≤ 40 results | US-9 |
| T-40 | `よほど` | Vocab contains `よっぽど/よほど` N3 L17, よほど N3 L22, 余程 N1 L3 (`n1-vocab-3-81`) | US-4 |
| T-41 | `ちょうど` | Three rows N4 L21, N3 L1, N3 L15. With Could #15: one row with 3 badges | US-7 |
| T-42 | `丁度` | *(Amended.)* No vocab or grammar hit. The "No word matches 丁度" state lists the kanji 丁 N1 L11 (`n1-kanji-11-6`) and 度 N5 L22 (`n5-kanji-22-6`). Suggests trying the reading. No AI offer | US-9 |
| T-43 | Fresh browser opens `…/search?q=ものの&level=N2` (cold load through the `404.html` fallback) | Same results as T-15 filtered to N2. Title and focus OK. `…/search?q=ばかり&level=N2,N3` lists only N2 and N3 points | US-11 |
| T-44 | Activate result 〜ものの in T-15 | URL `/n2/grammar/4?focus=n2-grammar-4-1`. Card scrolled into view and highlighted, with **no** modal open. Back returns to results with the query intact | US-7/11 |
| T-45 | Index fetch blocked (offline, uncached) | Error with Retry. Header level and lesson navigation still works | US-9 |
| T-46 | Screen reader, type `although` | Announces "8 results: 8 grammar" once after a pause | §4 |
| T-47 | Network panel, entire session of T-01…T-42 | Zero requests to any AI or provider host. Only same-origin static assets | Non-goal |

---

## 6. Open questions

Status after `03-ux.md` and `04-data.md`. **Answered** items name their source. Remaining open items are marked **Open**.

**UX**
- Q-UX1. Overlay or full page? **Answered (UX §1.1):** one `/search` page, driven by a persistent header field. Lesson scroll is restored on return.
- Q-UX2. Deep link target and modal? **Answered (UX §2, orchestrator):** `?focus=<uid>`, highlight only, no auto-open of `GrammarDetailModal`. US-7 is amended.
- Q-UX3. Primary link for collapsed duplicates? **Answered (UX §3.3):** one row with level-ordered badges. The primary link is the occurrence at the current level if there is one, otherwise the lowest level.
- Q-UX4. Do the per-lesson filter boxes stay? **Answered (UX §1.3):** yes, relabelled "Filter this lesson…". On zero hits they show "Search all levels for "…" →". Arriving with `?focus=` clears the lesson filter.
- Q-UX5. Where does tag browsing live? **Answered (UX §1.3):** category chips on the `/search` empty state. Every `TagBadge` links to `/search?tag=<id>`. There is also a "Browse by function →" link in the Grammar sidebar.
- Q-UX6. Language of deinflection labels? **Answered (UX §2 F2):** English first, then Japanese in full-width brackets (`causative-passive, past（使役受身・過去）`).

**Data engineering**
- Q-DE1. Cold load of `/search`. **Answered (data §4.5). Correction to the earlier draft:** a `404.html` SPA fallback already exists, because `npm run build` copies `dist/index.html` to `dist/404.html`. The only missing piece is an explicit `/search` route declared before `/:level/:section`. Without it, the one-segment path falls into `*` and `LegacyRedirect`. No root-level `?q=` fallback is needed.
- Q-DE2. Library or hand-rolled? **Answered (data §4.1):** hand-rolled (~4 KB plus ~3 KB tables). It gives explicit tiers, and its logical schema is the future DB schema.
- Q-DE3. Lemma derivation. **Answered (data §2.3):** inferred at build time with no MVP migration. A `pos`/`lemma` enum migration is v2, after teacher review of the lemma report.
- Q-DE4. Data anomalies (言う read as `ゆう`, brackets inside `reading`). **Partly answered (data §7):** fix 言う in the generator script, not in the index builder. The builder strips brackets. **Open:** confirm whether the PR #11 review fixed 言う. At `36e400b`, `n3-vocab-23-124` still stores `ゆう`, and logging issues #1–#3 in `FINDINGS.md` is still pending.
- Q-DE5. Alias layer location and ownership. **Answered (data §6):** `data/search-aliases.json` holds 23 categories plus `tagAliases` and `okurigana`. The teacher owns content, and a Zod check in `validate:data` verifies the tag ids.
- Q-DE6. Index versioning and cache-busting. **Answered (data §4.3):** the build generates gitignored shards with content-hashed asset URLs, plus `schema`/`v`/`contentHash` checks. A stale uid opens the lesson without focus.
- Q-DE7. Size budget. **Answered (data §4.2):** the budget holds only if cheap keys are derived in the worker at load time, with progressive shard loading. **Open:** re-measure the sizes after the PR #11 vocab changes (corpus is down 266 rows, so the budget should still hold).
