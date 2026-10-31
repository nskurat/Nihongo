# Global search: teacher review of the implementation

Reviewer: Japanese teacher (JLPT N5–N1). Branch `claude/cool-heisenberg-l4bgrr`, engine in
`grammar-app/src/services/search/`. Every result below was taken from the real engine:
`MemorySearchSource` built from `src/data` (the same set-up as `__tests__/golden.test.ts`), with
`rankLevel: 'N5'` unless stated otherwise. About 420 queries were run. Notation:
`食べます[N5L6|deinflected:2]` means the row title, level, lesson, `matchKind` and tier.
No AI provider was called.

**Overall verdict.** The foundations from `01-teacher.md` are in place and mostly work well:
kana/katakana/NFKC/〜 folding, Hepburn/kunrei/IME romaji, cleaned keys, ます-lemmas,
kanji-from-word, お/ご aliases, category chips, the single-kana guard and deinflection reason
lines. About 75 of the ~130 inflected forms I tried return the right word. The problems are
narrower than that number suggests, but they hit the forms N5 learners type most:

- the deinflector ignores verb class, so `して` shows 知る first;
- the romaji converter breaks every word with `nn` + vowel (`konnichiwa`, `minna`);
- English function words never reach N5/N4 grammar;
- "kana query → Grammar first" puts weak grammar matches above an exact word.

One error is mine. `01-teacher.md` §2 says `かえって` can come from 変える. It cannot: the
te-form of 変える is 変えて. That error spread to `04-data.md` §3.3/§3.5 and to golden test
T-33. See F1.

---

## 1. Findings, ordered by learner impact

Owner: **E** = search engine (`services/search`), **D** = content data or `scripts/`, **U** = UI
(`features/search`).

### F1. The deinflector does not check verb class, so the most common forms get wrong lemmas. Owner: E (must-have)

Ichidan rules (`て→る`, `た→る`, `ない→る`, `ろ→る`…) and godan rules (`って→う/つ/る`) both
emit candidates ending in る. `matchJapanese` accepts any vocab row whose key equals the
candidate. The only filter is "ends with the same kana", so the class is never checked.
Non-verbs also pass when they happen to end in a u-row kana.

| Query | Actual (top of vocab) | Expected |
|---|---|---|
| `して` | 知ります／知っています, 知る, します, 刷る | **します (する)** only. 知る→知って, 刷る→刷って |
| `しない` / `した` / `しよう` / `しろ` | 知る ranked at or above する | する. 知る's forms are 知らない/知った/知ろう/知れ |
| `かえって` | 却って, 帰る, **変える, 替える, 換える, 代える**, 反る, 返る | 却って, 帰る, 返る, 反る. The 4 ichidan verbs give かえて |
| `きって` / `きった` | 切手, **着ます, 着る**, 切る | 切手, 切る. 着る→着て |
| `きて` | 来る, 着る, **切る, 斬る** | 来る, 着る |
| `いって` / `いった` | 行く, **いつ**, **います (居る)**, 要る, 言う, 炒る | 行く, 要る, 言う, 炒る/煎る |
| `いて` | **いつ (imperative!)**, います, 要る | います/いる. 要る→要って |
| `もった` | **もう／まだ** first, then 持つ | 持つ, 盛る, 漏る |
| `ねて` | 寝る, **練る** | 寝る. 練る→練って |
| `おきて` | 掟, 起きます, **送ります** (via the `きて→くる` rule) | 掟, 起きる |
| `ate` (romaji あて) | 宛, 当て, **ある (te-form)** | ある→あって. See F8 |
| `させる` | **差す (potential)** above する | する (causative) first |

**Fix (E):**
1. At build time, give every vocab doc a verb class. Use, in order:
   - the `masuToDict` rule (it already decides ichidan/godan for all 240 ます-rows);
   - `pos` (`Group I/II/III`, `adverb`, `noun`…) on N5/N4 rows;
   - for dictionary forms, the reading: る after an a/u/o-row kana is godan. る after an
     i/e-row kana is ichidan, **unless** the word is in a `GODAN_RU_EXCEPTIONS` list. Use the
     standard list of about 45 entries: 帰る 返る 反る 切る 斬る 知る 入る 要る 走る 減る 蹴る 限る
     参る 散る 滑る 握る 喋る 焦る 照る 練る 煎る 炒る 茂る 湿る 陥る 遮る 覆る 罵る 嘲る 翻る 甦る
     蘇る 捻る 侮る 遡る 耽る 漲る 迸る 混じる 交じる 詰る 嘲る 抉る 弄る.
2. In `deinflect()` each candidate already carries `type` (v1/v5/vs/vk/adj-i/noun). Keep a hit
   only when the doc's class is compatible:
   - `v1` needs ichidan;
   - `v5` needs godan;
   - `vs` needs a **surface** that ends in する (rejects 刷る for して);
   - `vk` needs a surface that ends in 来る/くる, and the kana `き/こ` rules need an empty stem or
     a stem ending in て/で (連れてきた). That rejects 送る for おきて.
   - Docs whose `pos` is noun, adverb, pronoun or counter never match a verb rule (rejects いつ,
     もう, 五つ).
3. ら抜き must then get its own rule, because the godan potential rule will no longer reach
   ichidan verbs. Add `れる→る` with `in:[v1] out:v1`, label *potential (colloquial ら抜き)*, so
   `見れる`/`来れる`/`食べれる` keep working.
4. Rank by commonness when tiers tie. Hits from the irregular table (する/来る/行く/ある/いい)
   get `sub −0.5`. That puts します above 差す for `させる` and above 知る for `して`, even before
   the class gate.
5. Amend golden T-33. `かえって` must return 帰る (and 返る/反る) but **not** 変える. Correct
   `04-data.md` §3.3 and §3.5 and `01-teacher.md` §2, which use 変える as the example.

### F2. Romaji: `nn` + vowel is broken, and there is no ha/wa fallback. Owner: E (must-have)

`romajiToKana` treats `nn` as ん in every case and then reads the next vowel on its own.
Hepburn writes the double n in exactly these words, and they are the words beginners type first.

| Query | Actual | Expected |
|---|---|---|
| `konnichiwa`, `konnichiha` | こんいちわ / こんいちは → **no results** | こんにちは (N3 L11) |
| `minna` | みんあ → no results | みんな (N5 L18) |
| `onna` | おんあ → no results (`onnna` works) | 女 (N5 L8) |
| `sannen` | さんえん → only `~さん` | さんねん |
| `kanni` | かんい → 簡易 | かんに. `kan'i` → 簡易, which is the intended behaviour and works |
| `こんにちわ`, `こんばんわ`, `konnichiwa` | none | こんにちは / こんばんは |

**Fix (E):**
- `nn` + vowel/y → ん + the な-row syllable (consume one n): `konnichiwa` → こんにちわ,
  `minna` → みんな.
- `nnn` → ん + n…, which keeps IME typists working: `konnnichiha` → こんにちは.
- `nn` at the end or before a consonant → ん.
- `n'` stays the explicit break.
- When a kana query (typed or converted) has no exact hit, retry once with a final or
  particle-position わ→は and え→へ (こんにちわ, こんばんわ). Mark it `queryAs`.
- Do **not** guess かんい from `kani`. That policy is right.

### F3. English function words do not reach N5/N4 grammar. Owner: E + D (must-have)

`because` (N5) returns 〜ばこそ (N1), なぜなら, 〜おかげで… The N5 `S1から、S2` is 24th, and only
through its summary. **〜ので (N4 L14) is missing altogether.** `when`: とき (N5 L23) is
summary-only and last of 69. `before`: まえに (N5 L18) is 15th. `after`: あとで (N4 L9) is 11th.

There are two causes.
- **D:** N5/N4 grammar `meaning` is a description, not a gloss. から's meaning says
  "causal relationship" and never says "because".
- **E:** inside the English tier, `sub` includes `1 − density`. That puts long descriptive
  meanings below short N1 glosses *before* the level tie-break is applied, so the learner's
  level never gets a say.

**Fix:**
- **E:** when the query matches a category chip, put the Grammar group first and give grammar
  hits that carry one of the chip's tags `sub −1`. From the tagged rows, から and ので are both
  `cause-reason`, and とき, まえに and あとで are all `time-relative`.
- **E:** quantise density to two buckets (`0` if the query is ≥50% of the gloss tokens, else
  `0.5`), so the current level decides inside a bucket.
- **D (v2):** add a short `gloss` field ("because; so", "before ~ing", "when") to N5/N4 grammar
  through a `scripts/` migration, and index it in the meaning tier.

### F4. Group order "kana → Grammar first" buries exact words under weak grammar hits. Owner: E (must-have)

`groupOrderFor` fixes the group order by script alone. In the UI each group shows 8 rows before
the next group starts.

| Query | Actual group order and first rows | Expected |
|---|---|---|
| `わかります` | Grammar: 1 relevant exact (`N が あります／わかります…`) + 7 `Vます…` rows matched only on ます (tier 7); then Vocab わかります, 分かる | Vocab first (わかります, 分かる, 分る), then at most 2 grammar rows |
| `いきます` | Grammar 8 rows (only `V-て いきます` is relevant) before 行きます | Vocab first |
| `みずから` | 6 grammar rows matched on から before 自ら (exact) | Vocab 自ら, Kanji 自 |
| `うしろ`, `なかば`, `いきる`, `うまれる`, `たかい` | grammar noise (structure or contains, tier 7) before the exact word | Vocab first |
| `ぶん` | grammar `きっと／たぶん…` (contains) first | Vocab 文, Kanji 分 聞 文 |
| `カタカナ` | grammar かな (tier 7) first | Vocab 片仮名 |
| `otosan`, `okasan`, `sayonara` | grammar `~さん` / `Nなら` first, the word second (folded tier) | Vocab first |

**Rule to adopt (E):**
1. Order groups by their best `(tier, sub)`. Hits of tier ≥ 7 (hint, structure,
   pattern-in-query) do not count when deciding the order.
2. On a tie, the script default applies, with one refinement. When both Grammar and Vocab have
   an exact hit, Vocab goes first if its exact or lemma hit is a **verb or adjective** (it has a
   lemma, or a deinflection reached it). Otherwise Grammar goes first. This keeps `から`, `ので`,
   `にもかかわらず`, `ばかり` grammar-first and makes `わかります`/`いきます` vocab-first.
3. A katakana-only query goes Vocab first.
4. A romaji query whose word hit is `folded` counts as `romajiExact`.
5. Cap pattern-in-query grammar rows (tier 7, `sub 1`) at 2 per response. Never use bare
   inflection morphemes (ます ません ました ない た て です) as pattern keys when the query
   deinflected to a vocab lemma. Raise the minimum pattern-key length to 3, because 2-kana keys
   built from joined placeholders cause `にもかかわらず` → `S1か、S2か` via **かか**.

### F5. Missing inflection rules for forms learners paste. Owner: E (must-have for the first four)

| Query | Actual | Expected | Rule to add |
|---|---|---|---|
| `静かだった`, `静かでした`, `静かじゃない`, `元気です`, `いいです`, `きれいだった` | nothing (kanji-only or empty) | 静か, 元気, いい, きれい[な] | copula: `です でした だ だった じゃない ではない じゃなかった じゃありません ではありません` → `''` (type `noun`/`adj-na`). `です`/`でした` after an い-adj → strip (高いです, 高かったです) |
| `食べちゃった`, `行っちゃう` | nothing | 食べる, 行く | `ちゃう→て`, `じゃう→で` (out `v5`, so ちゃった chains). Label *completion, colloquial (ちゃう)* |
| `食べてる`, `食べとく`, `置いておく` | nothing | 食べる, 置く | `てる/でる→て/で` (in v1), `ておく/でおく/とく/どく→て/で` (v5). New label *preparation (ておく)* |
| `早く`, `高くなる` | nothing | 早い, 高い | adverbial `く→い` (terminal), `くなる→い` (in v5) |
| `食べるなら` | nothing | 食べる | `なら→''` (terminal), also after い-adj |
| `食べてください` | nothing | 食べる | `てください/でください→て/で` |

Out of scope by design, and correctly skipped: keigo stems (お〜になる), ぬ/ん negatives,
dialect.

### F6. Grammar titles in ます/です form do not match dictionary-form queries. Owner: E (must-have)

| Query | Actual | Expected title |
|---|---|---|
| `てしまう`, `ちゃう` | none | `Vて-form + しまいました／しまいます` (N4 L4) |
| `ようになる` | 3 contains rows, no exact | `Vようになります／Vなくなります` (N4 L11) |
| `ようにする` | — | `Vようにします` (N4 L11) |
| `はずだ` | none | `…はずです` (N4 L21), then `〜はずがない` |
| `そうだ` | only vocab 相談 (prefix) | `Vます-form ＋ そうです` (N4 L18), `plain form ＋ そうです` (N4 L22) |

**Fix (E, `grammarKeys.ts`):** for every title or structure key ending in a polite form, add a
plain-form variant key:
- `ます/ました/ません` → dictionary form, using `masuToDict` with corpus = grammar keys
  (しまいます→しまう, なります→なる, します→する);
- `です` → `だ` and → `''` (はずです → はずだ, はず);
- `でしょう` → `だろう`.

Also run the query through `deinflect()` and try the candidate lemmas against grammar surface
keys at the deinflected tier. Then `食べてしまった` also surfaces てしまう.

### F7. `する→noun` over-reaches. Owner: E (must-have, one line)

| Query | Wrong hit |
|---|---|
| `話して` | 話 (noun) "する-verb, te-form" |
| `として` | と (N1) "する-verb, te-form" |
| `ことにする` | 殊に "する-verb" |
| `来させられた` | 来 (N3) "する-verb, causative-passive, past" |

**Fix:** apply `r('する', '', L.suru, ['vs'], 'noun')` only when the remaining stem is **all
kanji (≥ 2 chars) or katakana** (勉強, 結婚, コピー). 話, と, 殊に and 来 all fail that test.

### F8. Latin queries: romaji fragments beat English meanings. Owner: E (should-have)

| Query | Actual | Expected |
|---|---|---|
| `rain` | vocab #1 オンライン (romaji らいん, contains), then 雨 | 雨 first |
| `so` | romaji そ: Kanji 祖 組 訴 素; grammar `こ／そ／あ／ど` | English hits + chips (Cause / Result) only |
| `ate` | 宛, 当て, ある (te-form) | 食べる (via `ate→eat`) first |
| `no` | 野 then いや, ノー | acceptable |

**Fix:**
- For Latin queries, romaji hits of tier ≥ 3 (prefix, contains, hint) rank **below** English
  meaning hits.
- When the converted kana is 1–2 characters and English has hits, keep only romaji *grammar*
  exact hits (particles). Drop kanji or vocab reading hits.
- `romajiExact` should require a tier ≤ 2 vocab hit with a reading of ≥ 3 kana.

### F9. ます→dictionary-form report: 4 wrong lemmas, 2 data readings. Owner: E + D (must-have, small)

All 240 rows of `grammar-app/src/generated/search/search-index-report.tsv` were checked by hand
(N5 106, N4 134). No N3–N1 rows appear, and that is correct: 覚ます, 励ます, 冷ます, だます and
ますます are dictionary words and are left alone (verified: `覚ます` exact, `冷まして` → 冷ます).

| uid | word | report lemma | Correct | Cause |
|---|---|---|---|---|
| n4-vocab-16-2 | くださいます | **くださう** | くださる | ラ行特殊 honorifics: masu stem ends in い, not り |
| n4-vocab-24-1 | いらっしゃいます | **いらっしゃう** | いらっしゃる | same |
| n4-vocab-24-3 | おっしゃいます | **おっしゃう** | おっしゃる | same |
| n4-vocab-24-4 | なさいます | **なさう** | なさる | same |
| n4-vocab-9-2 | 気が付きます | 気が付く / reading **きつく** | きがつく | **D:** row reading is `きつきます`, which should be `きがつきます` |
| n4-vocab-16-6 | 親切にします | 親切にする / reading **しんせつする** | しんせつにする | **D:** row reading is `しんせつに` (truncated), which should be `しんせつにします` |

The other 234 rows are right. That includes 存じます→存じる, 着きます→着く, はきます→はく,
おります→おる, 連れて行きます→連れて行く, 知っています→知っている and 楽しみにしています→楽しみにしている.

The wrong lemma is visible to learners. `いらっしゃって` shows いらっしゃいます with the reason line
"いらっしゃって → **いらっしゃう**", and `おっしゃった` does the same.

**Fix:**
- **E:** in `masuToDict`, a stem ending in `くださ|いらっしゃ|おっしゃ|なさ` + `い` → `…る`, before
  the pos rules. The deinflector's own table already does this.
- **D:** add the two readings to `scripts/lib/searchDataFixes.ts`.
- **E (risk):** remove the kana entries `いき`, `き` and `おき` from `ICHIDAN_I_EXCEPTIONS`. Today
  they are shadowed by pos or the corpus check, but a future kana `いきます`/`おきます` row (行く,
  置く) would become 生きる/起きる. Keep only the kanji forms there (生き, 着, 起き).

### F10. The long-vowel fold collapses い-adjective endings. Owner: E (should-have)

`foldLong` drops い after any i-row kana and あ after any a-row kana, including at the end of a
word:

| Query | Actual |
|---|---|
| `いい` | kanji 医 意 … via folded `い` (35 kanji rows) |
| `おおきい` / `ookii` | 沖 (おき) in vocab and kanji |
| `きれい` | 切れ (folded) |

**Fix:** never drop a **word-final** い or あ. Keep the o/u/e folds as they are, since they carry
`tokyo`/`kyoshitsu`/`sensē`, and those all work correctly today. The proper i-row/a-row long
vowels (おにいさん, おばあさん) still meet through the non-final rule.

### F11. Category chips: the mappings need curation, and some categories are missing. Owner: E (`aliases.ts`) (should-have)

All 22 chips map onto existing tags, and the mappings are honest given the current taxonomy.
Linguistic problems:

- **Limitation** = `emphasis-limitation` (39 rows), but only about 10 of those are limitation
  (だけ, しか, ばかり, しかない, に限り, かぎり). The tag also holds さえ, こそ, さらに, 上に, はもちろん,
  を中心に, ぜひ. The **Emphasis** chip (79 rows) is a superset of it. A learner who taps
  "Limitation" gets a mixed list. Fix: give `AliasCategory` an optional `titleKeys` include list
  and use it for Limitation until the v2 re-tag.
- **Topic / regarding** and **Standpoint / basis** both use `viewpoint-standpoint` (35 rows):
  `about` lists にとって, として, によると and 〜的. Either merge them into one chip
  "Topic / standpoint", or curate Topic with `titleKeys` (について, に関して, をめぐって, に対して).
- **`can't help` → Obligation is wrong.** All 3 English hits (〜てしょうがない, 〜ずにはいられない,
  〜てならない) are emotional. Move the alias to *Feelings*. Keep *no choice* under Obligation.
- **`let's` → Advice/request**, but `V ましょう` is tagged `volitional-intention`. Map `let's` to
  both Advice and Intention.
- **`may` → Permission only.** Add it to *Inference* (かもしれません). Add `about`, `around` and
  `roughly` to an *Approximation* chip (below).
- **`for` and `as`** show chips but return no rows, because both are stopwords. That is
  acceptable only because the chips appear. Keep it.
- **Missing chips** (the tags exist but no category uses them; learners type these words):
  - *Addition*, via `titleKeys`: ばかりか, ばかりでなく/だけでなく, のみならず, に限らず, 上に,
    に加えて, さらに, それに, はもちろん/はもとより. Today `not only` and `besides` get no chip.
  - *Approximation*: くらい/ぐらい, ごろ, ほど, ばかり.
  - *Listing / examples* (`listing-examples`, 23 rows): `such as`, `for example`, `and`.
  - *Experience* (`experience`): `have ever` returns **nothing** today, so Vたことがあります is
    unfindable in English.
  - *Keigo* (`keigo-*`, 29 rows): `honorific`, `humble`, `respectful`.
  - *Ease / difficulty* (`ease-difficulty`): `easy to`, `hard to`.
  - *Partial negation*: `not necessarily`.
  - *Frequency*: `every time`, `often`.

### F12. Okurigana and spelling variants. Owner: E (`aliases.ts`) + D (should-have)

What works: `わかる`/`分かる`/`分る` (all three find each other), `ちょうど`, `丁度` (the
"no word match" state lists 丁 · 度), `花見`/`お花見`, `さけ` → 酒 and お酒 (alias, ranked below 酒),
`おちゃ` → お茶, half-width `ﾀﾍﾞﾙ`/`ｺｰﾋｰ`, full-width `ＴＡＢＥＲＵ`, `タベル`, `たくしー`, and
`~ばかりか`/`～ばかりか`/`〜ばかりか`.

| Query | Actual | Fix |
|---|---|---|
| `落とす` | only 落とす (N3). The N4 row is spelled **落す** | add pair `落す/落とす` |
| `引っ越し` | NOWORD. The data has `引越し` (N2) | add `引越し/引っ越し` |
| `起る`, `売場` | NOWORD | add `起る/起こる`, `売場/売り場`, `手続/手続き` |
| `ご飯`, `御飯` | only the 朝/昼/晩ご飯 contains hits. N5 stores `ごはん` | add the N5 pair `ご飯/ごはん` (hand alias, as teacher §3 allows) |
| `こう` | vocab #1 **斯う** (N4 L17) | **D:** content-data says rare headwords were normalised, but 斯う and 然る (N4 L17) survived. Respell them as こう and しかる |

### F13. Kanji search. Owner: E (nice-to-have, apart from the verification)

**The 13 N5 readings restored by `scripts/fix-search-data.ts` are all correct and
conventional** (KANJIDIC okurigana split, the reading an N5 learner meets): 学 まな・ぶ, 会 あ・う,
分 わ・かる/わ・ける, 行 い・く/おこな・う, 来 く・る/きた・る, 休 やす・む, 去 さ・る, 自 みずか・ら,
転 ころ・ぶ, 動 うご・く, 後 うし・ろ, 生 い・きる/う・まれる, 半 なか・ば.
- 来 きた・る is archaic for N5, but harmless.
- Leaving 日 か, 一 ひと, 真 ま, 円 まる and 千 ち as bare readings is right.
- Verified hits: `まなぶ`, `おこなう`, `ころぶ`, `うしろ`, `なかば` and `みずから` each return the
  kanji as an exact kanji hit.

What works: a single kanji puts Kanji first (`分`, `迷`, `水`). On'yomi in hiragana, katakana or
romaji all work (`めい`/`メイ`/`mei` → 明 名 迷 命 鳴). Rendaku `ぷん` → 分. A kun stem without
okurigana works (`まよ` → 迷). Meanings work (`lost`, `astray` → 迷). Compounds decompose
(`迷惑` → 迷 · 惑).

Issues:
- For single-kanji queries the Kanji group fills with other kanji through compound hints:
  `日` → 人 ‹日本人›, 語 ‹日本語›, 製 ‹日本製›; `川` → 山 ‹山川›, 中 ‹**中川**›, which is a surname.
  Suppress `compound`-kind kanji hits when the query is a single kanji.
- `ぷん` → vocab オープン (contains on the folded katakana). Kana queries of 2 characters should
  not contains-match inside katakana words.
- A radical query (`辶`) returns nothing. That is the agreed nice-to-have.

### F14. Labels and reason lines. Owner: E (labels) + U (join)

The English and Japanese labels are correct and natural: 丁寧・過去, 可能・受身, 使役受身, 意向形,
命令形, 様態, 名詞化, 進行・状態, 結果の状態, 完了, 希望 (the school-grammar name for たい).
Corrections:

- **U:** `reasonLine` joins Japanese step labels with `・`, but several labels already contain
  `・`. The result is `可能・受身・否定・過去` for 食べられなかった, which reads like four alternatives.
  Join the steps with ` → ` (or `＋`): `可能・受身 → 否定 → 過去`.
- **E:** `ず形` is not a standard term. Use `否定（ず）` / en *without (ず/ずに)*.
  `仮定・ば` → `仮定形（ば）`, `仮定・たら` → `条件（たら）`.
- **E:** drop the bare `て形` step before an auxiliary. `食べている` now shows
  "te-form, ongoing/state (ている)" and should show "ongoing/state (ている)". Same for てある and
  てしまう.
- **E:** add the ら抜き label from F1.3. Leave `potential/passive` as it is: adding "honorific"
  would only make the line longer without helping learners.
- **U:** `行く` appears twice in a row (`n5-vocab-4-12` いく and `n5-vocab-4-37` ゆく, same
  lesson). Show the reading on both rows, or collapse them with "also read ゆく".

### F15. Things that are right and should be locked in by tests

- Single-kana guard: `の` 16 grammar / 1 vocab / 3 kanji, `に` 20/2/9, `は` 22/4/11, `を` grammar
  only, `て` 28/1/2, all exact. The particle grammar comes first. This is what a teacher wants.
- `きた` → 北 (exact) first, then 来る/着る. That is right: an exact homophone outranks an
  inflection.
- Grammar by form:
  - `ものの`, `ばかりか` (all tilde forms), `ずに` (plus 〜ずに済む, 〜ずにはいられない);
  - `読まずに` → 読む plus grammar 〜ずに;
  - `いただけませんか`, `はです`, `わけにはいかない`, `ば〜ほど`/`ばほど`, `ようが`/`うが`,
    `つつも`;
  - `に対して`, `について`, `にとって`, `として`.
- Romaji:
  - `shimbun`/`shinbun`/`sinbun`, `tukue`, `tyotto`, `huyu`, `zisho`, `jyuu`/`juu`, `kitte`,
    `gakkou`;
  - `kyoushitsu`/`kyōshitsu`/`kyousitu` exact, `kyoshitsu`/`kyooshitsu` folded;
  - `ko-hi-`, `ohayō`, `wo`/`o`/`ha`/`ni` particles, `nippon`.
- The deinflection battery that passes:
  - polite ×5, て/た/ない/なかった, potential, passive, causative, causative-passive (incl.
    `待たされた`, `読ませられた`, `行かされた`, `来させられた`), volitional, ば/たら, たい/たくない/
    たかった, ている/ていた/ています/てある/てしまった, imperative, ながら, すぎる, そう;
  - い-adj く/くて/かった/くない/くなかった/ければ/かったら/さ/そう/すぎる;
  - `よかった`/`よくない` → いい/良い; `ない`/`なかった`/`あった` → ある; `できる` → 出来る +
    する potential; kana `のみました`, `たべません`, `およいだ`, `すわって`.

### F16. Data gaps that search exposes. Owner: D (for the content pipeline; not a search bug)

`にほんご`/`日本語` and `とうきょう` find no word, because neither is a vocab row. 元気 and
こんにちは exist only at N3, and おはよう and さようなら only at N2. An N5 learner searching
`genki` or `ohayou` lands in an N3/N2 lesson. The cumulative-coverage rule in
`docs/content-data.md` explains this, but N5 greetings and 日本語 belong in N5. Raise it with the
content owner.

---

## 2. Prioritised fix list

**Must-have before release** (each one breaks a top-50 N5 query):
1. F1 verb-class gate + ら抜き rule + amend T-33. `して`, `かえって`, `いって` and `きって` are
   wrong today.
2. F2 `nn`+vowel and the ha/wa retry. `konnichiwa` and `minna` return nothing.
3. F4 group order by best tier, and cap pattern-in-query rows. `わかります` shows 7 noise rows
   before the word.
4. F3 category-tag boost + density buckets. `because` misses から/ので.
5. F5 copula, ちゃう, てる/とく, adverbial く, なら. Learners paste these from sentences.
6. F6 plain-form grammar keys. `てしまう` and `はずだ` find nothing.
7. F7 する→noun guard (one condition).
8. F9 honorific lemma fix + 2 data readings (the reason line shows いらっしゃう).

**Should-have:** F8 Latin ranking, F10 fold guard, F11 chip curation and new chips (Addition,
Experience, Keigo, Approximation, Listing), F12 okurigana pairs, F14 label wording and join.

**Nice-to-have:** F13 compound-noise suppression and katakana-contains guard, a radical filter,
and F16 content gaps.

---

## 3. Regression query set (for `golden.test.ts`)

`rankLevel: 'N5'` unless noted. "Today" says whether the current build passes.

| # | Query | Expected | Today |
|---|---|---|---|
| 1 | `して` | vocab deinflected: します (する) first; 知る and 刷る absent | fail |
| 2 | `しない` | します (する) present; 知る absent | fail |
| 3 | `しろ` | 白 exact first; します (imperative) present; 知る absent | fail |
| 4 | `かえって` | 却って exact; 帰る, 帰ります deinflected; 変える/替える/換える/代える absent | fail (amend T-33) |
| 5 | `かえった` | 帰る, 帰ります; 変える absent | fail |
| 6 | `きって` | 切手 exact, 切る deinflected; 着る absent | fail |
| 7 | `きて` | 来る, 来ます, 着る; 切る/斬る absent | fail |
| 8 | `いって` | 行く first; 要る, 言う present; いつ and います absent | fail |
| 9 | `いて` | います first; いつ absent | fail |
| 10 | `もった` | 持つ first; もう／まだ absent | fail |
| 11 | `ねて` | 寝る/寝ます; 練る absent | fail |
| 12 | `おきて` | 起きる/起きます; 送ります absent | fail |
| 13 | `させる` | します (causative) ranked above 差す | fail |
| 14 | `話して` | 話す, 話します; 話 (noun) absent | fail |
| 15 | `として` | grammar 〜として（は）… top; vocab と absent | fail |
| 16 | `ことにする` | grammar 〜ことに する top; vocab 殊に absent | fail |
| 17 | `見れる` | 見る deinflected, step label contains "ら抜き" | fail (label) |
| 18 | `食べちゃった` | 食べる/食べます deinflected | fail |
| 19 | `食べてる` | 食べる/食べます deinflected | fail |
| 20 | `静かだった` | 静か (N5 L11) deinflected | fail |
| 21 | `元気です` | 元気 | fail |
| 22 | `いいです` | いい (N5 L21) top vocab | fail |
| 23 | `早く` | 早い (N5 L17) | fail |
| 24 | `食べるなら` | 食べる | fail |
| 25 | `てしまう` | grammar `Vて-form + しまいました／しまいます` (N4 L4) top | fail |
| 26 | `はずだ` | grammar `…はずです` (N4 L21) top | fail |
| 27 | `ようになる` | grammar `Vようになります／Vなくなります` (N4 L11) top | fail |
| 28 | `konnichiwa` | vocab こんにちは; queryAs こんにちは | fail |
| 29 | `minna` | vocab みんな (N5 L18) top | fail |
| 30 | `onna` | vocab 女 (N5 L8) top | fail |
| 31 | `こんにちわ` | vocab こんにちは | fail |
| 32 | `kan'i` | 簡易 exact; `kani` does not return 簡易 | pass |
| 33 | `because` | groupOrder[0] = grammar; `S1から、S2` (N5 L9) and `…ので、〜` (N4 L14) in grammar top 3 | fail |
| 34 | `before` | `…まえに、V2` (N5 L18) in grammar top 3 | fail |
| 35 | `when` | `…とき、〜` (N5 L23) in grammar top 3 | fail |
| 36 | `rain` | vocab top 雨; オンライン not in top 3 | fail |
| 37 | `so` | no kanji group; chips Cause / reason + Result / consequence | fail |
| 38 | `ate` | 食べる in vocab top 3; ある absent | fail |
| 39 | `わかります` | groupOrder[0] = vocab; わかります then 分かる; ≤ 2 grammar rows with matchKind contains | fail |
| 40 | `みずから` | groupOrder[0] = vocab; 自ら top | fail |
| 41 | `たかい` | groupOrder[0] = vocab; 高い top | fail |
| 42 | `カタカナ` | groupOrder[0] = vocab; 片仮名 | fail |
| 43 | `otosan` | groupOrder[0] = vocab; お父さん | fail |
| 44 | `にもかかわらず` | grammar 〜にもかかわらず top; `S1か、S2か` absent | fail |
| 45 | `食べれば食べるほど` | grammar 〜ば〜ほど top of grammar | fail |
| 46 | `いい` | no kanji row with matchKind folded | fail |
| 47 | `おおきい` | 大きい top; 沖 absent | fail |
| 48 | `落とす` | both 落とす (N3) and 落す (N4) | fail |
| 49 | `引っ越し` | 引越し (N2) | fail |
| 50 | `いらっしゃって` | いらっしゃいます hit with deinflection.lemma いらっしゃる (not いらっしゃう) | fail |
| 51 | `can't help` | chip Feelings / attitude; no Obligation chip | fail |
| 52 | `have ever` | chip Experience; `Vた-form ことが あります` (N5) in grammar | fail |
| 53 | `日` | kanji group = [日] only (no compound-kind kanji) | fail |
| 54 | `食べさせられた` | 食べる: causative-passive → past | pass |
| 55 | `高くなかった` | 高い: negative → past | pass |
| 56 | `来られる` / `こられる` | 来る: potential/passive | pass |
| 57 | `行こう` | 行く: volitional | pass |
| 58 | `読みながら` | 読む: while (ながら) | pass |
| 59 | `よかった` | いい top (deinflected) | pass |
| 60 | `覚ます` | 覚ます exact, no deinflected hit of 覚る | pass |
| 61 | `～ばかりか` | 〜ばかりか (N2 L9) top | pass |
| 62 | `の` | exactOnly; grammar `Aの B` top; ≤ 40 rows | pass |
| 63 | `ﾀﾍﾞﾙ` | 食べる exact | pass |
| 64 | `mei` | kanji 明, 名, 迷 exact | pass |
| 65 | `ころぶ` | kanji 転 exact (restored reading), vocab 転ぶ | pass |

Rows 1–16 and 39–47 are the ones I would add first. They pin down the class gate and the
group-order rule, which are the two changes with the widest effect.

---

## 4. How this was checked

- Engine: `realIndex()` (`__tests__/realIndex.ts`) → `MemorySearchSource.search(q, {rankLevel, limitPerType})`,
  driven by a throwaway tsx script outside the repo. About 420 queries in 9 batteries:
  deinflection ×2 (~200 forms), romaji (~95), orthography and grammar form (~75), English
  (~45), categories (~20), kanji (~50), group order (~30), variants (~25), ます-verbs.
- Lemma report: `npm run build:search-index`, then all 240 rows of
  `search-index-report.tsv` read by hand.
- The data claims (`pos`, `meaning`, readings, tags) were checked against `src/data/*.json`
  with small Python counts.
- No browser run was needed: the worker runs the same `SearchEngine`. The UI-level points (F4
  group order, F14 reason line) follow from `resultDisplay.ts` (8 rows collapsed per group,
  steps joined with `・`).
