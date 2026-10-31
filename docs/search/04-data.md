# Global search: data model, index and adapter

Status: draft for implementation · Inputs: `01-teacher.md`, `02-requirements.md`, `03-ux.md` §7.2,
`services/content/*`, `types/*`, `data/*`. I measured every number below on the real data **at merge `36e400b`**
(kanji/vocab review, PR #11: 696 grammar, 9,171 vocab (N5 759, N4 763, N3 3,202, N2 1,588, N1 2,859), 2,214 kanji =
12,081 items) with throwaway prototype scripts kept outside the repo. §9 lists what changed since the first draft.
Gzip is level 9, matching what GitHub Pages serves. Brotli is shown for reference only.

**Decision in one paragraph.** A build-time script (`scripts/build-search-index.ts`) turns the 15 content
files into 7 versioned JSON shards. Each shard holds one compact `SearchDocument` per item: display fields plus
only the search keys that need content knowledge to derive (cleaned variants, ます→dictionary lemmas,
collocation hints, お-aliases, grammar form keys). Keys that are cheap to derive are rebuilt in a Web Worker at
load time: normalised surface and reading, the long-vowel fold and English tokens. The query engine is
hand-rolled. No search library is used, because none of them match the tier ranking and none of them handle
Japanese without an n-gram index larger than the whole budget. Queries pass through a pure **QueryPlanner**
(normalise → script → romaji → deinflect) that the static backend and any future database share. The DB adapter
then replaces only the **matcher**. Measured size: **349 KB gzip** total (budget 400 KB), grammar shard **56 KB**
(budget 80 KB).

---

## 1. Logical data model

### 1.1 `SearchDocument` (one per grammar point, vocab row or kanji)

```ts
// services/search/types.ts. This is the data contract. The same shape becomes a DB row later.
type DocType = 'grammar' | 'vocab' | 'kanji';               // = ContentSection
interface SearchDocument {
  uid: Uid;  type: DocType;  level: Level;  lesson: number;  // from uid; uid is the primary key
  // display fields (shown unchanged, never matched raw)
  title: string;          // grammar.title | vocab.word | kanji.kanji
  reading?: string;       // vocab.reading | kanji: onyomi/kunyomi arrays kept as stored
  meaning: string;        // grammar.meaning | vocab.meaning | kanji.meaning
  structure?: string;     // grammar only (UX shows it when matchField === 'structure')
  tags?: string[];        // grammar tag ids
  // search keys. Every key is already normalised (§2.1).
  keys: {
    surface: string[];    // cleaned word/title variants: 迷う; 花見, お花見; つつ, つつも
    reading: string[];    // hiragana readings (vocab reading variants, kanji full on/kun + kun stem)
    lemma: string[];      // dictionary form(s) + lemma reading for ます rows: 食べる, たべる
    alias: string[];      // お/ご-stripped forms (酒, さけ), okurigana variants
    hint: string[];       // collocation hint (道に, 迷惑), grammar structure keys, extra kanji compounds
    folded: string[];     // long-vowel-folded readings: derived at load
    en: string[];         // English tokens of meaning (+ grammar summary, lower weight): derived/shipped (§2.6)
    kanjiChars?: string[];// vocab: CJK chars in the word, for kanji-from-word: derived at load
  };
  dupKey?: string;        // vocab: surface[0] + '|' + reading[0], used to collapse cross-level duplicates
}
```

On the wire, each shard stores documents as positional arrays and leaves out every key that the worker can
derive, so the shipped format is smaller than this logical shape (§4.2). The logical shape is what tests and
the DB see.

### 1.2 Mapping to a future database

| Logical | SQLite FTS5 / Postgres | Meilisearch / Typesense |
|---|---|---|
| `SearchDocument` minus `keys` | `search_doc(uid PK, type, level, lesson, title, reading, meaning, structure, level_rank)` | one `items` collection; display fields `displayed`, not searchable |
| `keys.*` | `search_key(uid FK, kind ENUM(surface,reading,lemma,alias,hint,folded), key TEXT)`, B-tree on `key` (exact and prefix via `key >= ? AND key < ?||'￿'`), FTS5 `trigram` / `pg_trgm` index on `key` for contains | array attributes `k_surface`, `k_reading`, `k_lemma`… with `searchableAttributes` in tier order. Ranking rule `attribute` first, then `level_rank`, `lesson` |
| `keys.en` | FTS5 `porter` table `search_en(uid, field, text)` | `meaning`/`summary` searchable with English stemming |
| tags | `doc_tag(uid, tag)` + `tag(id, facet, label)` | `tags` filterable facet |
| aliases | `search_alias(category, alias, tag)` | synonyms or a pre-query lookup |

The key-derivation code (§2) runs **once in the build script** for both targets. A DB loader inserts the same
`SearchDocument`s, so search behaviour cannot drift between backends.

---

## 2. Key derivation (build time, `services/search/keys/*`, pure + unit-tested)

### 2.1 Normalisation `norm(s)` (shared by index and query)
1. `NFKC` (full-width ASCII and half-width kana; `～` U+FF5E becomes `~`).
2. Lower-case. Katakana U+30A1–30F6 → hiragana (−0x60). Keep `ー`.
3. `~ ～ 〜` → `〜`. Collapse whitespace.

`key(s)` = `norm(s)` with `〜`, whitespace and `・` removed. Every stored key and every query goes through
`key()`, so `~ばかりか`, `～ばかりか` and `〜ばかりか` are the same string (T-16 verified).

### 2.2 Vocab annotation stripping (teacher §3), applied to `word` and to `reading`
1. **Reading gloss** `漢字（かな）` → drop the parenthesised part (`本社（ほんしゃ）／支店`, 2 rows).
2. Split on `／` and `/`. Each part is indexed separately (49 rows).
3. **Collocation hint**: a `[…]` whose content contains `〜` (`迷う [道に〜]`, `かける [迷惑を〜]`, `[〜を]ください`) is
   removed. Its content minus `〜` goes to `keys.hint` (`道に`, `迷惑を`).
4. **Optional text**: any other `[…]` or `（…）` (`[お]花見`, `きれい[な]`, `[どうも]ありがとう[ございます]`) produces the
   cross-product of with and without (at most 6 expansions).
5. `key()` each result. Leading or trailing `〜` marks an affix (`〜中`). The affix is stripped from the key, and the doc keeps a
   flag the UI can show.

`word` and `reading` are processed in parallel, and their parts are paired by index when the counts match. That pairing is how
`入ります／出ます` gets one lemma per part.

### 2.3 ます → dictionary form (answers **Q-DE3**: infer at build time, no data migration for MVP)
`pos` exists only on N5/N4 (559 rows), and 83 of those are a bare `verb`. Rule for every surface variant ending in
`ます` (240 rows: N5 94, N4 134, N3–N1 12):

| Order | Condition | Lemma | Rows (measured) |
|---|---|---|---|
| 0 | pos `expression`, or ends `ございます` (`おめでとう ございます`, `ご座います`) | none | — |
| 1 | `…[てで]います` (`住んでいます`) | `…ている`. The te-form is deinflected on the query side | 3 |
| 2 | stem ends `来`/`き` and pos III or kanji `来` | `…来る` / `くる` | 3 |
| 3 | stem ends `し`, and pos III or no pos with no godan `…す` lemma in the corpus | `…する` (`勉強します→勉強する`) | 49 |
| 4 | pos `Group II` → stem+`る`. pos `Group I` → i-row→u-row (`き→く, り→る, い→う…`) | | 43 + 65 |
| 5 | stem ends in e-row kana or a bare kanji (`寝`, `見`) | ichidan, stem+`る` | 36 |
| 6 | i-row stem, exactly one candidate (ichidan stem+`る` or godan) exists as a corpus word | that one | 41 |
| 7 | i-row stem in `ICHIDAN_I_EXCEPTIONS` (いる/居る, 見る, 着る, 起きる, 借りる, 降りる, 浴びる, できる, 足りる, 生きる, 過ぎる, 信じる, 感じる, 落ちる, 伸びる, 閉じる…) | ichidan | 3 |
| 8 | otherwise | godan (ichidan i-row verbs are a small closed set) | 10, all checked correct |

The corpus check uses all cleaned vocab surfaces plus kanji `compounds` words. Both the lemma and the lemma
reading (`たべる`) are stored, so `たべる`, `taberu` and `食べる` all hit `食べます` (T-28 verified). The build
writes the table of derived lemmas (`uid, word, pos, lemma, rule`) to `search-index-report.tsv` for teacher review. The
exceptions list lives in code (`services/search/keys/lemmaExceptions.ts`), not in `data/`. **v2:** a `scripts/` migration
adds normalised `pos` + `lemma` to the N5/N4 rows once the teacher has signed off that report.

N3–N1 rows are already in dictionary form: lemma = surface, nothing is stored. い-adjectives need no stored lemma
either. The deinflector reduces `高かった→高い`, and that string is a surface key.

### 2.4 Kanji readings
Fold katakana. For kun readings, index both the **full reading** with the separator removed (`まよう`, `あげる`)
and the **stem** before it (`まよ`, `あ`). Since PR #11 every level uses `・` (2,077 readings) and affix readings are
gone. The normaliser still accepts `.` and strips leading/trailing `-`, because that costs nothing and keeps the
builder tolerant of future source refreshes.
On'yomi → hiragana (`メイ→めい`). Under the single-kana guard (§3.5), only full readings count as exact. Stems do not.

### 2.5 Grammar title / structure keys
1. NFKC. Reading gloss `上（じょう）` → `上`. Drop parentheses containing Latin (`(place)`, `（made in／by）`).
2. Split alternatives on `／ / ・`.
3. Expand optional `（…）` with and without (`〜つつ（も）` → `つつ`, `つつも`).
4. Cut anything after `→` (`い-adj（〜い→さ）`).
5. Extract Japanese runs (kana/kanji). Placeholders `V N A B S1 Noun Verb adj -form plain form` disappear because they
   are Latin. The key is the **joined runs** (`Aは Bです` → `はです`), and each run of ≥2 chars is also a key
   (`Vて-form + いただけませんか` → `ていただけませんか`, `いただけませんか`).

Title keys → `surface`. Structure keys that are not already title keys → `hint`. T-15/16/17/19/20 all pass on the prototype.

### 2.6 English
- Tokenise `meaning` (and grammar `summary`) on `[^a-z0-9']+`, drop `'s`, and drop a ~30-word stopword list
  (`a an the of to in on at for by with and or is be as it one sb sth someone something etc`).
- **Index side: plural folding only** (`-ies→y`, `-(s|x|z|ch|sh)es`, `-s` except `ss/us/is`). **Query side:**
  expand to candidate bases (`-ing`/`-ed` with and without `e` or a doubled consonant, plus an irregular table of
  ~60 entries: `lost→lose, went→go…`). Doing it this way round means `even` never meets `evening` or `event`
  (T-38 passes), while `lost` reaches `lose [one's way]` (T-37 passes).
- Multi-word queries: phrase match on the normalised meaning ranks above an all-words AND. Stopwords are removed
  from the query first (`in addition` → `addition`).
- Grammar `summary` tokens that are not already in `meaning` are shipped as a space-joined string (a lower tier).
  `explanation`, `details` and examples are never indexed.

### 2.7 Aliases and variants
- **お/ご**: the surface matches `^[おご御][CJK]`. Strip the first char from the surface **and** the reading
  (`お酒` → alias `酒`, `さけ`). Kana-initial `おいしい` never matches the pattern. T-25 then ranks 酒 (exact) above お酒 (alias).
- **Okurigana pairs** (`分る/分かる`, `終る/終わる`, `行なう/行う`, ~10 entries): a hand table in `search-aliases.json`
  (§6). Each entry adds the other spelling to `alias`.
- **Kanji compounds**: 4,013 compound words, of which only **384** are not already a vocab surface. Ship only those
  384 as `hint` on the kanji. The other 3,629 are reached by kanji-from-word decomposition (§3.4). This
  saves 17 KB gzip (kanji shard 83.7 → 67.0 KB).

---

## 3. Query pipeline (`services/search/query/*`, pure, shared by every backend)

```
raw → norm → detectScript → [romaji→kana] → candidates{key, tier, via} → backend.match → rank → group → SearchResult
```

### 3.1 Script detection
After `norm`: `kanji` if it contains CJK (single kanji = `kanji-single`), `kana` if it contains only hiragana/`ー`/`〜`,
`latin` if it matches `[a-z' āīūēōâîûêô-]+`, `mixed` otherwise. A Latin query runs **both** the English path and
the romaji path. The romaji path runs only if the conversion yields pure kana. The result reports `queryAs` (UX:
"Searching as きょうしつ"). Group order follows PM US-7: kanji-single → Kanji first, kana/〜 → Grammar first,
English → Vocab first. When the romaji reading has an exact vocab or kanji hit, Vocab goes first.

### 3.2 Romaji → hiragana (hand-rolled, ~120 lines + table. wanakana is 7.0 KB gz and an acceptable fallback, but its long-vowel and `oh` policy differs)
- Greedy longest match (4→1 chars) over a table that covers Hepburn, kunrei and IME spellings: `shi/si, chi/ti, tsu/tu, fu/hu,
  ji/zi, ja/jya/zya, sha/sya, cha/cya/tya`, `xtu/ltu/xtsu` → small っ, `xa…xyo` small kana, `wo→を`, `ha→は`.
- `n`: `n'` → ん. `nn` → ん. `n` followed by a non-vowel, non-`y` or by end of input → ん. **`n` + vowel/`y` is always な行**
  (`kani` → かに, never かんい; T-03/T-04 verified).
- A doubled consonant (not `n`) → っ. `tch` → っち (`matcha`).
- Macrons and circumflexes: `ā→aa, ī→ii, ū→uu, ē→ee, ō/ô→ou`. `oh` + consonant or end → `おう`. `-` → `ー`.
- Long vowels are **not** guessed during conversion. The hiragana goes through the `foldLong` tier instead (§3.5):
  after an o-row kana drop `う/お/ー`, after an e-row kana `い/え/ー`, after u-row `う`, after a-row `あ`, after i-row `い`. So
  `kyoshitsu` reaches 教室 in the folded tier, `kyōshitsu`/`kyousitu` reach it exactly (T-35 verified), and
  `tokyo`/`tookyoo` meet `とうきょう`.

### 3.3 Deinflection (data-driven, `deinflectRules.ts`)
The rule table is data: `{ from, to, label: {en, ja}, inType, outType }`. Types are `masu, te, ta, adj-i, v1, v5, vs,
vk, neg, any`. Rules apply **type-chained** (Yomichan style: a rule's `inType` must match the previous rule's `outType`),
recursion depth ≤ 3, and every intermediate string is deduped. Scope is exactly the teacher's §2 table: polite (ます, ません, ました,
ませんでした), te, ta, ない, なかった, たい, potential, passive, causative, causative-passive (`される`/`させられる`),
volitional, ば, imperative, ず/ずに, the ている/てある/てしまう auxiliaries (strip), and the い-adj forms く, くて, かった, くない,
くなかった, ければ, さ, そう. That comes to ~70 suffix rows. A separate **irregular table** covers する/来る (all forms, incl. 来 kanji),
行く→行って/行った, ある→ない, いい→よかった/よくない and いらっしゃいます. It applies only to queries that are kana or end in kana.

Each candidate lemma is kept **only if it equals a `surface`, `reading` or `lemma` key of a vocab doc**. The
lemma's verb class is not checked, because we have no reliable `pos`. Over-generation is accepted (`かえって` → 帰る, 変える, and also 買う via 買える),
and candidates are ordered by path length. The hit carries `deinflection: {input, lemma, steps[{en, ja}]}` for
the UX reason line. Prototype results: `食べられない→食べる/食べます`, `待たされた→待つ`, `読まずに→読む`,
`高かった→高い`, `きた→来る/着る`, `わかります→分かる/分る`: all as the PM expects.

### 3.4 Candidate generation (static backend)
- **Exact**: hash map `key → postings[(doc, kind)]` over all key kinds.
- **Prefix**: binary search over the sorted array of distinct keys (30.2k).
- **Contains**: linear `indexOf` over the distinct keys, only when the query has ≥ 2 chars. It costs 2.3 ms on desktop for
  the worst case (2 kana). A mid-range phone at about 5× slower is well inside 50 ms.
- **Pattern-in-query** (grammar only): grammar surface keys of ≥ 2 kana that occur **inside** the query. This is how
  `読まずに` surfaces 〜ずに (T-31), which plain contains matching misses.
- **Kanji-from-word**: each CJK char in the query → the kanji doc with that `kanji`. Only CJK chars, never kana.
- **English**: `token → postings` map, intersected across query words.
- Filters (level, type, tag) apply to the postings **before** ranking. Per-facet counts are computed the same way.

### 3.5 Ranking tiers and tie-breaks
| Tier | `matchKind` (UX §7.2) | Rule |
|---|---|---|
| 0 | `exact` | query key == surface/reading key (incl. variants) |
| 1 | `lemma`, `alias-o`, `variant` | query == stored lemma (`食べる`→食べます) or alias |
| 2 | `deinflected` | deinflected query == surface/reading/lemma (vocab only) |
| 3 | `prefix` | key starts with the query |
| 4 | `contains`, `kanji-from-word` | key contains the query (≥2 chars), plus decomposed kanji |
| 5 | `reading-folded` | foldLong(query) == foldLong(reading) |
| 6 | `meaning` | English phrase, then AND (grammar `summary` is 6.5) |
| 7 | `collocation`, `compound`, structure | `hint` keys |
| — | `tag` | `listByTag`: no tiers, ordered N5→N1, then lesson (T-10) |

A doc keeps its best tier. *(Fix round 2, orchestrator decision.)* Within a tier: **lower levels first** (N5 → N1, the
learner's level gets no priority, so a rare current-level word never buries a core N5/N4 word), then shorter vocab headwords,
then lesson, then position. Deinflected hits order by path length; irregular lemmas (する/来る/行く/ある/いい) go first, and a
lemma must have a compatible word class (verb class from `pos`, the ます rule, or the dictionary form plus a godan-る exception
list), so かえって → 帰る but never 変える. English hits use two density buckets; grammar in a matched category chip ranks
first (its teacher-curated core points such as because → から, ので at the very top), and N5/N4 chip members are listed even
without a meaning match. Groups are ordered by their best real hit (tier < 7); on a tie a Vocab verb/adjective beats Grammar.
Patterns inside the query are capped at 2 grammar rows (whole kana runs, no bare morphemes). **Single-kana guard**: a query of
one kana runs tier 0 only (grammar surface, vocab word or reading, kanji full readings). It is capped at 40.
Duplicates are collapsed **after** ranking by `dupKey`. The best-ranked row is primary and the rest become `alsoAt`.

**Two acceptance-list conflicts, now decided by the orchestrator (2026-10-31):**
(a) **T-33 amended: deinflected ranks above literal prefix.** With prefix first, `きた` would fill the top 8 vocab with
汚い, 北半球, 帰宅, 期待… and push 来る and 着る out (T-34). Under the decided order, `きた` returns 北 (exact), then
来る, 来ます, 着ます, 着る (deinflected), then prefix hits. `かえって` returns 却って, then 帰る/変える (deinflected), then
`かえって来ます` (prefix), still within the top 8. PM US-3 now says the same.
(b) **T-42 decided: a "no word match" state.** `丁度` has no word row but decomposes into 丁 and 度, which are both kanji rows.
When the only hits are `kanji-from-word`, the response sets `wordMatch: false` and the UI shows "No word matches 丁度.
Kanji in your query: 丁 · 度", listing those kanji and suggesting a reading search (PM US-9).

---

## 4. Index format, build and runtime

### 4.1 Library vs hand-rolled (answers **Q-DE2**)
| Option | Code size (measured, min+gz) | Japanese | Fit |
|---|---|---|---|
| MiniSearch 7.2.0 | 5.9 KB | Whitespace tokenizer. CJK needs a custom n-gram tokenizer, which multiplies the serialised index (radix tree + per-term stats) | BM25 scoring ≠ tier ranking. No deinflection hooks. Prefix and fuzzy are good |
| FlexSearch 0.8.212 | 4.5 KB light / 10.7 KB compact / 17.5 KB bundle | Has a `Charset.CJK` (char-level) encoder | Resolution-based scoring is opaque. Its export format is library-specific, so it does not port to a DB. The 0.8 API still churns |
| Fuse.js 7.5.0 | 7.3 KB basic / 9.1 KB full | Bitap fuzzy, char-level | Linear scan of every doc on each keystroke (12k × fields). Fuzzy scores mean nothing for kana/kanji |
| **Hand-rolled** | **~4 KB est.** (maps + binary search + tiers) + romaji/deinflect tables (~3 KB) | Exactly the teacher's rules | Tiers are explicit. Its logical schema is the DB schema (§1.2) |

**Decision: hand-rolled.** A library would only provide matching, and our matching is three data structures.
The hard parts (normalisation, romaji, deinflection, tiers) are ours either way. This code ships in the worker chunk,
not the main bundle.

### 4.2 Shards, format and measured sizes
Seven shards: `grammar` (with the tag list and alias categories), `kanji`, and `vocab-{N5…N1}`. Each file is
`{ "schema": "search-index", "v": 1, "contentHash": "…", "shard": "vocab-N3", "docs": [...] }`, with docs as positional arrays:
- grammar: `[uid, title, meaning, tagIdx[], structure, surfaceKeys[], structureKeys[], summaryTokens]`
- vocab: `[uid, word, reading, meaning, {v?: variants, l?: lemmas, h?: hints, a?: aliases}]` (the object is left out when empty: true for 92% of rows)
- kanji: `[uid, kanji, meaning, onyomi, kunyomi, extraCompounds]`

| Variant (all 7 shards) | Raw | **Gzip** | Brotli |
|---|---|---|---|
| A. Display fields only | 884 KB | 309 KB | 250 KB |
| C. Everything precomputed (normalised, folded, English tokens, kanji reading keys) | 1,976 KB | **558 KB, over budget** | 433 KB |
| **Recommended** (display + non-derivable keys + structure, extra compounds only) | 1,024 KB | **349 KB** | 282 KB |

| Recommended shard | Docs | Raw | Gzip |
|---|---|---|---|
| grammar (+tags) | 696 | 184 KB | **56.5 KB** (budget 80) |
| kanji | 2,214 | 196 KB | 67.0 KB |
| vocab-N5 / N4 | 759 / 763 | 54 / 56 KB | 17.4 / 18.8 KB |
| vocab-N3 / N2 / N1 | 3,202 / 1,588 / 2,859 | 224 / 110 / 200 KB | 77.3 / 39.5 / 72.0 KB |

**Q-DE7:** the budget holds only if cheap keys are derived in the worker (variant C fails at 558 KB). Load-time
derivation for all 12,081 docs takes **240–270 ms in Node on a desktop** (JSON.parse of all shards: 6 ms. The rest is
`key()` with NFKC, English tokenising and map building). Estimated at 4–5× on a mid-range phone, that is 1.0–1.25 s for
the whole corpus. That cost is why loading is progressive (§4.4). Levers measured if the budget tightens: shipping the full grammar `summary`
for display costs +12.4 KB, so fetch it on demand through `contentRepository.getItem` instead. Short uids save only 5.7 KB,
so keep full uids (DB primary key). Truncating meanings saves <1 KB, so not worth it. Headroom today is 51 KB. Example
sentences are never indexed, so the planned vocab-example work does not grow the index.

### 4.3 Build, versioning, cache-busting (answers **Q-DE6**)
- `scripts/build-search-index.ts` reads `src/data/**` and calls the pure `buildSearchIndex(content)` from
  `services/search/build/`, the same function the tests call. It writes
  `grammar-app/src/generated/search/*.json` (gitignored, never committed, so it cannot drift from the data) plus
  `search-index-report.tsv` (lemma table and warnings). Wire it in as `"prebuild"` and `"predev"`, or as a one-line call in the
  `build` script. A later Vite plugin can call the same function in `buildStart`.
- The worker loads shards with `import.meta.glob('../../generated/search/*.json', { query: '?url', import: 'default' })`
  and `fetch`. Vite names the assets with a **content hash**, and the worker chunk that references them is itself hashed. An index can therefore
  only ever be paired with the app build that produced it, and HTTP caching is safe (`immutable`).
- `schema` + `v` are checked by the loader. On a mismatch it throws `ContentError('load-failed')`. `contentHash` (sha-256 of
  the 15 source files + builder version) goes into every shard. A shard set with mixed hashes is rejected.
- **Stale tab after deploy.** An old tab requests old hashed URLs, which the deploy removed. The loader's `ContentError` shows
  Retry, and a second failure suggests reloading. This is the same behaviour lesson chunks have today. A uid from a stale result that no longer exists
  is caught by `contentRepository.getItem` → `null` → the lesson opens without focus.
- `validate:data` adds one check: every alias category references an existing tag id (§6).

### 4.4 Runtime: Web Worker, progressive load
- A module worker (`new Worker(new URL('./search.worker.ts', import.meta.url), { type: 'module' })`) holds the
  index, planner and matcher. It talks over a ~40-line `postMessage` RPC with request ids, and replies to stale queries are
  dropped. In tests or environments without workers, the same engine runs in-thread (`InThreadSearchSource`).
- The main bundle gets only the RPC client and types (≈1–2 KB gz, well under +15 KB).
- Prefetch starts on the first focus of the header field (UX §4.1). Order: `grammar` → `vocab-{currentLevel}` → `kanji` →
  remaining vocab, with each shard indexed as it arrives. The response carries `status: 'partial' | 'ready'`, so the
  first query can answer from what has loaded and re-run itself once loading finishes. For first search on Fast 4G: grammar (56 KB) plus the
  current vocab arrives in ~0.4 s and indexes in ~0.1–0.3 s on a phone, and the full corpus is ready within the 1.5 s p75.
  Warm worst case measured on desktop: **2.3 ms per query** (2-kana contains scan; single cold runs up to ~8 ms). Memory is roughly 15–20 MB of maps (estimate, to be verified in DevTools).

### 4.5 Q-DE1: cold load of `/search`
`npm run build` already copies `dist/index.html` to `dist/404.html`, so GitHub Pages serves the SPA for any sub-path
(with HTTP status 404, which is harmless for users). `serve.json` rewrites everything locally. The missing piece is the
router: one-segment paths fall into `*` → `LegacyRedirect` today, so `/search` needs an explicit route
before `/:level/:section` (UX §7.1 already plans this). No root-level `?q=` fallback is needed.

---

## 5. The adapter seam

`ContentSource` keeps its per-lesson API **unchanged** (`listLessons`, `getItems`, `getItem`, and `search(query, scope)` stays as the
in-lesson filter). Lesson navigation and `?focus=` keep using `contentRepository.getItems`/`getItem`. Global search is a
**separate interface with the same swap pattern**, because its lifecycle (worker, index) and result shape differ:

```ts
// services/search/SearchSource.ts
export interface SearchOptions {
  levels?: Level[]; types?: DocType[]; tag?: string; category?: string;
  rankLevel: Level; limitPerType?: number /* 8; Infinity for "show all" */;
}
export interface SearchHit {
  uid: Uid; type: DocType; level: Level; lesson: number;
  title: string; reading?: string; meaning: string;        // vocab word / kanji char in title
  onyomi?: string[]; kunyomi?: string[]; structure?: string; tags?: string[];
  matchKind: MatchKind; matchField: MatchField; tier: number;
  highlights?: { field: MatchField; ranges: [number, number][] }[];  // offsets into the DISPLAY string
  deinflection?: { input: string; lemma: string; steps: { en: string; ja: string }[] };
  via?: string;  alsoAt?: { uid: Uid; level: Level; lesson: number }[];
}
export interface SearchResponse {
  query: string; queryAs?: string; script: Script; exactOnly: boolean; wordMatch: boolean;
  groupOrder: DocType[]; groups: Record<DocType, SearchHit[]>;
  totals: Record<DocType, number>; facetCounts: { type: Record<DocType, number>; level: Record<Level, number> };
  categories: CategoryChip[]; hiddenByFilters: number; otherLevelsCount: number; queryHasKanji: boolean;
  status: 'partial' | 'ready';
}
export abstract class BaseSearchSource {
  abstract search(query: string, opts: SearchOptions): Promise<SearchResponse>;
  abstract listByTag(tag: string, opts?: Omit<SearchOptions, 'tag'>): Promise<SearchHit[]>;   // N5→N1, lesson
  abstract listCategories(): Promise<CategoryChip[]>;          // empty-state browse panel
  abstract warmup(): Promise<void>;                             // prefetch on focus; rejects with ContentError
}
export const searchRepository = { /* facade */ };  export function setSearchSource(s: BaseSearchSource): void;
```

- `WorkerSearchSource` (static, now) = planner + static matcher in the worker.
- `HttpSearchSource` (later) = the **same planner on the client**, which sends `PreparedQuery { candidates: {key, tier, kind, via}[],
  enTerms, filters }` to the DB. The DB does exact/prefix/trigram lookups on `search_key`. Ranking and grouping are shared
  (`rank.ts`), so the database never has to know about romaji or deinflection, and switching backends changes only the matcher.
  A Meilisearch/Typesense adapter can instead send the raw query plus the expanded candidates as an `OR` of quoted terms.
- `highlights` are computed in the matcher: `norm()` keeps string length for kana and tilde folding, and NFKC changes are tracked with an
  offset map, so ranges always index the display string.
- `useSearch` (UX §7.1) calls `searchRepository.search`, not `contentRepository.search`. The PM wording "ContentSource.search
  extended" is met in spirit: a DB class may implement both interfaces.

---

## 6. Tag and alias layer (answers **Q-DE5**)

`grammar-app/src/data/search-aliases.json` sits next to `tag-taxonomy.json`. It is hand-authored reference data, not generated rows.
The teacher owns its content and engineering owns its validation:

```json
{ "version": 1,
  "categories": [
    { "id": "cause-reason", "label": "Cause / reason", "tags": ["cause-reason"],
      "aliases": ["because", "since", "due to", "thanks to", "reason", "why", "so"] },
    { "id": "concession-contrast", "label": "Concession / Contrast", "tags": ["concession-contrast"],
      "aliases": ["although", "even though", "despite", "whereas", "on the other hand", "unlike", "but", "contrast"] } ],
  "tagAliases": { "degree-extent": ["degree/extent", "degree", "extent"] },
  "okurigana": [["分る", "分かる"], ["終る", "終わる"], ["行なう", "行う"]] }
```

- There are 23 MVP categories (PM §3). Addition, Approximation and Range are left out until the v2 re-tag. A Zod schema in
  `validate:data` checks that tag ids exist, aliases are unique per category, and labels are present.
- Every tag also matches on its id and its normalised taxonomy label (`Degree / Extent` → `degree extent`, `degree/extent`)
  automatically. `tagAliases` adds only the extras.
- The build embeds categories, tag ids and counts in the `grammar` shard, so chips cost no extra request. A query
  whose normalised form equals an alias (phrase match) yields `categories[]`, and an ambiguous alias (`so`, `but`, `for`) yields
  several chips. `listByTag` and `category` filters read the in-memory tag postings. In the DB these become the
  `doc_tag` and `search_alias` tables.

---

## 7. Data quality issues that affect search

Status re-checked at merge `36e400b`. **Open** = still in the data. **Fixed** = gone after PR #11.

| # | Issue (measured) | Status | Effect | Fix |
|---|---|---|---|---|
| 1 | **言う stored with reading `ゆう`** (`n3-vocab-23-124`). Re-verified: `いう` still returns no 言う row | **Open** | `いう`, `いって`, `iu` miss it | Correct in `review-n3-kanji-vocab.ts`, re-run, `validate:data`. **No** override in the index builder |
| 2 | **Brackets inside `reading`**: 206 rows (`[お]はなみ`, `きれい[な]`, `かける [迷惑を〜]`), while `迷う [道に〜]` stores a clean `まよう` | **Open** (unchanged) | Inconsistent, but the builder strips both | Builder handles it (§2.2). A later script can unify the convention: reading mirrors the word's annotations |
| 3 | **Reading covers only part of a slash pair**: `本社（ほんしゃ）／支店` → `してん`, `細い（ほそい）／太い` → `ふとい` | **Open** | The parts mis-pair. 本社 is searchable only through the gloss | Script fix: word `本社／支店`, reading `ほんしゃ／してん` (uid unchanged) |
| 4 | **Tilde**: 423 grammar titles and 220 vocab words use `〜`. One title uses ASCII `~さん` (N5) | **Open** (harmless) | None after `norm` | Optional one-line migration `~`→`〜` for display consistency |
| 5 | **Romaji** only on 559 N5/N4 rows | Open (by design) | None (romaji is never matched) | None. The field can be dropped in v2 |
| 6 | **`pos`** only on N5/N4 (559 rows), in 30+ spellings (`Noun`/`noun`, `verb` ×83, `Verb (Group I) (phrase)`) | **Open** | Lemma inference falls back to heuristics (§2.3) | v2 migration to a closed enum + `lemma`, after teacher review of the lemma report |
| 7 | **Kunyomi separators**: was `.` 677, `・` 1,468, `-` affixes 96 | **Fixed** (all 2,077 use `・`, affix readings dropped) | — | Builder stays tolerant (§2.4) |
| 8 | **Truncated N5 kun readings** (new find): stems stored without okurigana or separator, e.g. 分 `わ`, 行 `い`/`おこな`, 生 `い`/`う`, 来 `く`/`きた`. Same in the pre-merge data | **Open** | `わける`/`いく` do not reach kanji 分/行 through their reading. Only the vocab rows and kanji-from-word find them. A bare `わ`/`い` counts as a "full" reading under the single-kana guard | Script: restore okurigana from KANJIDIC (`わ・ける`, `い・く`) for N5 kanji. Teacher to confirm which readings to show |
| 9 | **Spaces inside words** (`連れて 行きます`, `おめでとう ございます`) | Open (harmless) | None (`key()` strips them) | None |
| 10 | **Cross-level duplicates**: 19 groups / 39 rows with identical word and reading (ちょうど ×3, いつも N5+N3, ある N5+N3, 必要 N4+N3…), plus same-level repeats (`休みます` N5 L4 and L11) | Open (fewer than the teacher's ~86, counted by word) | Clutter | Collapsed at query time by `dupKey` (§3.5) |
| 11 | **147 N4 kanji compounds with null reading/meaning** (phrases like `絵をかきます`) | Open | Only the compound word is indexed. A null reading is skipped | None for search |

#1, #3 and #8 should be logged in `docs/refactor/FINDINGS.md`. `validate:data` auto-logs warnings there, and the builder's
report should use the same format.

---

## 8. Test strategy

- **Unit tests per pure module** (`services/search/**/__tests__`): `norm`/`key` (NFKC, kana fold, tilde), `vocabVariants`
  (one case per row of teacher §3's table), `grammarKeys` (placeholders, optional parens, `→`), `kanjiReadingKeys` (3
  separator styles, affixes), `masuToDict` (every rule row in §2.3 plus the exceptions), `romajiToKana` (Hepburn, kunrei, IME,
  `n'`, `nn`, `kani`, macrons, `oh`, `tch`), `foldLong`, `deinflect` (each rule plus depth-3 chains, irregulars, "no invented
  lemmas"), English (`queryForms`, stopwords, `even`≠`event`), `rank` (tier order, level tie-breaks, single-kana guard,
  dup collapse).
- **Golden queries**: `golden.test.ts` builds the index **in memory** from the real `src/data` with `buildSearchIndex`
  (no files, no worker) and runs PM §5 T-01…T-42 as a table `{ query, opts, expect: { top?, contains?, notContains?,
  exactly?, groupOrder?, totalMax? } }`. T-33 and T-42 follow the decisions in §3.5. Re-run at `36e400b`, the prototype passes T-01–05, 08, 09, 13
  (meaning search), 15, 16, 19–23, 25–30, 32, 34–40. T-31 needs pattern-in-query, which the prototype lacks. **T-24 needs a
  fixture update**: PR #11 replaced N1 `有難う` with the common spelling, so `ありがとう`/`arigatou` now find only the N5 row.
  The prototype did not implement the T-42 "no word match" flag. Uids in the PM list that moved with the N2/N1 regeneration:
  簡易 `n1-vocab-28-28` (was N1 L11, T-03; PM already updated), 分る `n2-vocab-8-57` (was N2 L12, T-02), 余程
  `n1-vocab-3-81` (was N1 L4, T-40). Because N2/N1 uids are positional and regenerated, N2/N1 fixtures assert on
  `{word, level}` and look the lesson up from the data, not from a hard-coded uid.
- **Budget test**: gzip each built shard with `zlib` in vitest and assert ≤ 80 KB (grammar) and ≤ 400 KB (total). That
  catches content growth in CI. A worst-case keystroke query timing is reported (not asserted) to avoid flaky tests.
- **Contract test**: one shared spec runs `listByTag('comparison')` (17, N5→N1 order) and a few goldens against any
  `BaseSearchSource`, so a future DB adapter must pass the same suite.
- No test touches AI providers (AGENTS.md). The search code never imports `services/ai`.

---

## 9. Changes since the first draft (re-measured at merge `36e400b`)

- **Sizes**: total 357 → **349 KB gzip**. N1 vocab dropped from 79.8 to 72.0 KB (2,859 rows instead of 3,116), and the
  other shards moved by under 1 KB. Headroom is now 51 KB. Load/derive 240–270 ms (desktop Node). Warm worst-case query 2.3 ms.
- **Decisions recorded** (§3.5): T-33 amended (deinflected above literal prefix), T-42 "no word match; kanji in your query".
- **Fixed in the data**: kunyomi separators and affix readings (§7 #7). **Still open**: 言う/ゆう, the slash-pair readings,
  bracketed readings, `pos`. **New find**: truncated N5 kun readings (§7 #8).
- **What the new data changes in the design:**
  1. *Common spellings replaced rare ones* (何時も→いつも, 有難う removed). More words are now written in kana only, which
     reading-based matching already covers. Kanji spellings learners paste from older texts (`何時も`, `有難う`) now return
     no word match. That is acceptable per the non-goals ("no general dictionary"), and the T-42 state handles it. If the
     Waller spelling (`listKanji`, today only in `scripts/sources`) is ever copied into app data, the builder should index
     it as an `alias` key (tier 1, `matchKind: 'variant'`, `via` = the rare spelling). That needs no schema change.
  2. *Uniform `・` kunyomi* simplifies §2.4. The tolerant normaliser stays.
  3. *N2/N1 uids are regenerated positionally* whenever lower levels change. The index must therefore always be rebuilt from the same
     commit as the content (it is, via the build script and gitignored output), and golden fixtures must not hard-code N2/N1 uids (§8).
  4. *The coverage rule removed most cross-level repeats*. Duplicate collapsing (`alsoAt`) still matters for 19 groups but is
     less urgent (PM "Could" #15).
  5. *ます derivation*: 240 rows (was 244). By rule: corpus check 41, default godan 10, exceptions list 3. All 10 default-godan
     results were rechecked and are correct. No change to the rule order.

