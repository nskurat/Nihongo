# Global search: a teacher's guidance

Written from the point of view of someone who teaches JLPT prep to adult non-native
learners. Every example comes from `grammar-app/src/data/` as it is today
(about 700 grammar points, 7,800 vocab rows and 1,950 kanji across N5–N1). The aim is
to say **what learners will type and what they expect back**. Indexing mechanics are
left to the engineering docs.

---

## 1. What learners actually type

| Who | Typical query | Why |
|---|---|---|
| N5–N4, no IME yet | `taberu`, `arigatou`, `kyoushitsu` | They read romaji off a textbook and can't type kana yet. |
| N5–N4 with IME | `たべる`, `ありがとう` | The IME gives kana first; many stop there and don't convert. |
| N3+ | `迷う`, `ものの`, `〜ばかりか` | They copy from a JLPT book or a sentence they are reading. |
| Everyone | `although`, `because`, `lost`, `minute` | They know the meaning and need the Japanese. |
| Everyone | `ばかり`, `ても`, `わけ` | They half-remember a grammar pattern and type its kana core. |

**Romaji must be normalised, not matched literally.** The data stores romaji only for
N5/N4 vocab (≈560 rows), always wāpuro-style: `kyoushitsu`, `ookii`, `jouzu[na]`,
`[o]hanami`. Learners will also type Hepburn (`kyōshitsu`, `kyoshitsu`), kunrei
(`kyousitu`, `zyouzu`) and IME keystrokes (`si`, `tu`, `hu`, `nn`, `xtu`). So don't
search the stored `romaji` field. **Convert the query to hiragana and match it against
`reading`.** That also covers N3/N1 vocab and kanji readings, which have no romaji at all.
The romaji→kana converter should accept all of these:

- `shi/si→し`, `chi/ti→ち`, `tsu/tu→つ`, `fu/hu→ふ`, `ji/zi→じ`, `ja/zya/jya→じゃ`, `sha/sya→しゃ`
- doubled consonant → っ (`kitte→きって`, `matcha/maccha→まっちゃ`)
- `n'`, `nn` and `n` before a consonant → ん. `kan'i→かんい`, but `kani→かに`. Without
  the apostrophe, `kani` stays かに. Don't try to guess かんい here.
- Long vowels: `ō/ô/oh/oo/ou` are equivalent, as are `ū/uu` and `ē/ei/ee`. Easiest
  approach: build a "long-vowel-folded" key on both sides (おう/おお/おー → お,
  えい/ええ → え, うう → う). Then `toukyou`, `tokyo`, `tōkyō` and `tookyoo` all meet
  とうきょう. A few false positives (おばさん/おばあさん) are acceptable at this level
  of fuzziness. Rank exact-kana hits above folded hits.
- `wo→を`, `ha→は` (literal). Particles are discussed in section 6.

**Kana:** fold katakana to hiragana on both sides, so `ミル` finds `見る`'s reading
and `たくしー` finds タクシー. Normalise full-width and half-width forms (NFKC).
Normalise `~`, `～`, `〜` and `-` to one placeholder: there is already one title with an
ASCII `~` (`~さん`, N5) among 423 that use `〜`.

**English:** match whole words in `meaning`, with light stemming (section 6), so `lost`
finds `lose [one's way]` but `even` doesn't match `event`. Don't do substring matching: "even" appears in 40 grammar
meanings, most of them incidental.

---

## 2. Inflection (deinflection)

The data is inconsistent, which makes this more urgent than in a dictionary app.
**N5/N4 vocab stores verbs in ます-form** (`探します`, `遅れます`, `起きます`: 228 rows),
while N3/N1 stores the dictionary form (`迷う`, `案じる`). N5 even has both `行く` and
`行きます`. A learner who types `食べる` must find `食べます` (N5) as well as `食べる`, and
one who types `わかります` must find `分かる`. So the index should store a **lemma
(dictionary form) for every verb row**. It can be computed from `word` + `pos`
(`Verb (Group I/II/III)`) at build time. Then deinflect the query to candidate lemmas too.

What learners actually paste, by level:

| Level | Forms to handle | Example query → target |
|---|---|---|
| N5 | ます/ません/ました/ませんでした, て, た, ない, なかった, たい | `わかります`→分かる, `行って`→行く, `食べない`→食べる |
| N4 | potential, volitional (よう/おう), ば/たら conditional, passive, imperative, ている/てある/てしまう (strip the auxiliary) | `食べられない`→食べる, `行こう`→行く, `書けば`→書く |
| N3+ | causative (させる/せる), causative-passive (させられる/される), そう/すぎる stems, ず/ずに | `待たされた`→待つ, `読まずに`→読む |
| all | い-adj: く, くて, かった, くない, くなかった, ければ, さ, そう | `高かった`→高い, `寒くて`→寒い |

Rules that matter:

- **Irregulars by table, not rules:** する/します/して/した/しない/できる/させる/される;
  来る (くる/きます/きて/こない/こられる/来させる); 行く→行って/行った (not 行いて).
  Also ある (negative ない), いい (よかった/よくない), and the polite irregular いらっしゃる
  (いらっしゃいます, not いらっしゃります).
- **Godan/ichidan ambiguity is fine to over-generate.** `かえって` could be 帰る (godan),
  変える (ichidan) or 返る. Return **all** candidate lemmas that exist in the index and
  let ranking sort them out. Both `帰る` (N5) and `変える` (N4) are in the data, and
  showing both is a teaching moment, not a bug. The deinflector should emit candidates and
  keep only the ones that are real index lemmas. Never invent words.
- `食べられない` is potential **or** passive. The lemma is the same, so it doesn't matter.
- Recursion depth 2–3 (`食べさせられなかった` = causative → passive → negative → past) is
  enough. Don't do more.

**Recommended scope:** a rule-based deinflector of roughly 60–80 suffix rules plus
an irregular table, applied only to queries that are kana or end in kana. That is
the scope of jisho.org's or Yomichan's tables, cut down to the forms above.
Skip keigo stems (お〜になる), ぬ/ん archaic negatives, and dialects. Show the inference
in the UI ("食べられない → 食べる (potential/passive, negative)"). Learners find that
explanation as valuable as the hit itself.

---

## 3. Orthographic variants and annotations in this data

The stored strings carry a lot of teaching markup. **Index a cleaned "search key"
alongside the display string**, and never display the key.

| In the data | Search key(s) to index | Note |
|---|---|---|
| `迷う [道に〜]` (N3) | `迷う`, plus `道に` as a low-weight phrase | `[...]` after a word is a collocation hint: 279 rows in N3/N1 |
| `かける [迷惑を〜]` | `かける`; `迷惑` low weight | Searching 迷惑 should still surface it, ranked below 迷惑 itself |
| `[お]花見`, `[どうも]ありがとう[ございます]` (N5) | with and without the bracketed part: `花見`, `お花見`, `ありがとう`, `どうもありがとうございます` | `[..]` here marks optional text |
| `きれい[な]`, `立派 [な]` | `きれい`, `きれいな` | な-adj marker |
| `近い／遠い`, `これ／それ／あれ`, `よっぽど/よほど` | split on `／` and `/` and index each part | 52 vocab rows; many grammar titles (`〜にしろ／〜にせよ`) |
| `〜先`, `〜中 [留守〜]`, `〜過ぎ` | `先`, `中`, `過ぎ` (strip 〜) and flag as affix | Also `大〜 [好き/嫌い]` |
| `〜つつ（も）`, `〜（よ）うが`, `〜以上（は）` | `つつ`, `つつも`; `うが`, `ようが` | Full-width parentheses mean optional |
| Kanji `まよ・う`, `たか.い`, `-さん` | `まよう`, `まよ`; `たかい`, `たか` | **Three separator styles**: N5/N4 use `.` and `-`, N3/N1 use `・`. Normalise all of them |

Orthography learners will hit:

- **Kana vs kanji spelling.** `わかる` must find `分かる` (via `reading`). `ありがとう`
  must find both the N5 expression and N1's `有難う`. `ちょうど` exists only in kana. A
  learner typing `丁度` gets nothing, which is acceptable, since we don't ship a dictionary.
  Reading-based matching covers 95% of this. Don't build a variant table except for the
  handful of okurigana pairs (`分る/分かる`, `行なう/行う`, `終る/終わる`), which a
  small hand list handles.
- **お/ご prefixes.** `花見` should find `[お]花見`, and `さけ` should find `お酒`. But
  don't strip お from `おいしい` or `おもしろい`. Approach: index every お/ご-initial noun
  under both forms (119 vocab rows start with お/ご/御), and rank the literal form first.
- **Kanji compound readings with rendaku.** `分` is read `フン/プン/ブ`. A learner
  typing `ぷん` should hit it (plus 十分, 半分 via vocab readings).

---

## 4. Grammar search

Learners look for grammar in three ways, in this order of frequency:

1. **By form**: `ものの`, `ばかりか`, `わけにはいかない`. Strip `〜` from both sides and
   do a prefix and contains match on the cleaned title, then on `structure`.
   Titles also contain textbook placeholders: `Vて-form + いただけませんか`,
   `N(place)で V`, `Aは Bです`. Strip `V`, `N`, `A`, `B`, `S1`, `-form`, `(place)` and
   so on from the key, so that `いただけませんか` and `はです` hit.
2. **By meaning**: "although" gives 8 clean hits today (〜ものの, 〜つつ（も）,
   〜とはいえ…), but "because" gives 16 including noise. Search `meaning` first and
   `summary` second. **Never `explanation`/`details` by default**: they mention other
   grammar points constantly.
3. **By function**: "ways to say 'because'", "all the contrast grammar at N2". This is
   where tags come in, plus the English alias list below.

### The current taxonomy (66 function tags on 696 points)

It is good to have a fixed vocabulary, but the function facet is **too fine at the
long tail and too coarse in the middle**:

- **Missing "addition" (not only… but also).** `〜ばかりか` is tagged
  `degree-extent + emphasis-assertion`, and `〜ばかりでなく／〜だけでなく` is tagged
  `emphasis-limitation`. A teacher files all three, plus 〜上（に）, 〜に加えて, さらに and
  それに, under *addition*. This is the most visible gap.
- **`degree-extent` is a junk drawer** (45 points). It mixes intensity
  (とても, なかなか), approximation (〜ごろ, 〜くらい), distribution (〜ずつ), range
  (〜から〜にかけて), and "full of" (〜だらけ, 〜気味). Split off *approximation* and
  *range/scope*.
- **`emphasis-limitation` vs `emphasis-assertion`** confuse learners and taggers
  alike. Limitation (だけ, しか, ばかり, 〜きり) is a clear category. Emphasis (こそ, さえ,
  まで) is another. "Assertion" currently holds 決して〜ない, まるで〜ようだ, つまり and
  一体, which are adverbs with nothing in common.
- **`concession-contrast` conflates two things.** Concession ("although": のに, ものの,
  たとえ〜ても) and contrast ("whereas": 〜に対して, 〜反面, 一方) are different questions
  on the exam. Split them.
- **Near-duplicates to merge:** `completion` / `creation-completion`,
  `emotion-expression` / `spontaneous-perception` overlap, and `nominalizer` and
  `demonstrative` exist both as function and as structure tags.
- **`viewpoint-standpoint` (35)** mixes "regarding/about" (〜について, 〜に関して,
  〜をめぐって) with "from the standpoint of" (〜にとって, 〜として). "About/regarding"
  is what learners type.
- Tags used ≤3 times (`causative-passive`, `attempt`, `creation-completion`,
  `permission`, `experience`, `command`) are fine to keep. They are real N5/N4
  categories, just with few points.

### Proposed function categories (search aliases in *italics*)

These are display categories with aliases. They can map onto existing tags without
re-tagging; new tags are noted as such.

| Category | Existing tags it covers | English aliases learners type |
|---|---|---|
| Cause / reason | cause-reason | *because, since, due to, thanks to, reason, why, so* |
| Result / consequence | result-consequence, decision-outcome | *so, therefore, as a result, ended up* |
| Purpose | purpose | *in order to, so that, for* |
| Condition | conditional | *if, when, provided, unless, in case* |
| Concession | concession-contrast (split) | *although, even though, despite, even if, but* |
| Contrast | concession-contrast (split) | *whereas, while, on the other hand, unlike* |
| **Addition (new)** | — (from emphasis-limitation, degree-extent) | *not only, also, besides, moreover, in addition* |
| Limitation | emphasis-limitation (split) | *only, just, nothing but, no more than* |
| Emphasis | emphasis-limitation, emphasis-assertion | *even, especially, precisely, indeed* |
| Degree / intensity | degree-extent (split), excessive-degree | *very, so much, too, extent, how much* |
| **Approximation (new)** | degree-extent (split) | *about, around, roughly, approximately* |
| **Range / scope (new)** | degree-extent, time-relative | *from…to, throughout, across, over* |
| Comparison | comparison | *than, compared to, rather, more, the most, as…as* |
| Similarity / appearance | similarity-appearance | *like, as if, seems, looks* |
| Hearsay | hearsay | *I heard, apparently, they say* |
| Inference / certainty | conjecture-inference, certainty-expectation, possibility | *probably, must be, maybe, might, surely* |
| Obligation | obligation-necessity | *must, have to, no choice, can't help* |
| Permission / prohibition | permission, prohibition | *may, allowed, must not, don't* |
| Advice / request / command | advice-suggestion, request, command | *should, please, had better, let's* |
| Intention / volition | volitional-intention, attempt | *intend, plan, try to, going to, will* |
| Time / sequence | time-relative, simultaneous-action, completion | *when, before, after, while, as soon as, until* |
| Topic / regarding | viewpoint-standpoint (split) | *about, regarding, concerning, as for* |
| Standpoint / basis | viewpoint-standpoint, manner-accordance | *for (someone), as, according to, based on* |
| Change / state | change-of-state, state-continuation, habit-effort | *become, keep, still, used to* |
| Feelings / attitude | emotion-expression, spontaneous-perception | *regret, can't help feeling, surprise* |
| Voice & conjugation | passive, causative, causative-passive, potential, giving-receiving | *passive, causative, can, give, receive* |

Short English function words (*so, but, as, for, even, about*) are ambiguous. Map them
to **several** categories and show the category chips rather than one guessed list.

---

## 5. Kanji search

Each kanji appears once across the levels (no duplicates), so a kanji query has one
canonical home.

- **By character** (most common): an exact match on `kanji` is always result #1.
- **By reading**: match the query (kana or romaji→kana, katakana-folded) against
  normalised on/kun readings. Index both the full kun reading and the stem: `まよう`
  and `まよ` for `まよ・う`, `あげる` and `あ` for `あ.げる`. On'yomi are stored in katakana
  (`メイ`). Fold them, so that `めい` or `mei` hits 迷, 名 and 明. Expect many hits for
  common readings (`こう`, `しょう`). Sort them by level, then lesson.
- **By meaning**: whole-word match on `meaning` (`lost` → 迷, `astray`).
- **From a word**: the learner types `迷惑` and wants 迷 and 惑. Rule: **when a query
  contains kanji, also return each kanji character in it as a kanji result**, below the
  vocab hit. Cheap and very useful.
- **Compounds**: kanji rows carry `compounds`. Index them so `迷子` finds kanji 迷 even
  if there's no vocab row, but rank them below real vocab rows.
- **Radical / strokes**: nice-to-have. `radical` is stored as `辶 (walk)`, so
  `walk` or `辶` could filter. A stroke-count filter (`strokes: 9`) only helps learners
  who don't know the character. That is a handwriting-input problem, not text search.

---

## 6. Ranking and grouping

**Tiers within each type:** exact on the cleaned key > exact lemma after deinflection >
prefix > contains > reading match via romaji or long-vowel folding > English meaning >
collocation hint or compound. Within a tier, sort by **the learner's current level
first**, then lower levels (review), then higher levels, then by lesson.

**Grouping:** show three labelled groups, *Grammar · Vocabulary · Kanji*. Order them by
the query script:

- query is a single kanji (`分`): **Kanji first** (分 N5 L4), then vocab containing it
  (分かる, 自分, 半分, 十分…), then grammar (`今 -時-分です`).
- kana/`〜` query (`ばかり`, `ものの`): **Grammar first**, then vocab.
- English query: **Vocab first**. If it hits an alias in the section 4 table, put a
  category chip on top ("Cause / reason: 12 points").

Every result shows **level + lesson badge** (`N3 · L12`), the reading in furigana, and
the meaning. It links to `/:level/:section/:lesson` and scrolls to the item. Cap each
group at about 8 with "show all".

**Pitfalls:**

- **Single-kana queries** (`の`, `は`, `に`, `て`) match half the database. For queries of
  one kana: match only exact grammar titles or keys (`Nの N`, `〜て`) and exact vocab words.
  Disable contains matching until there are 2+ kana. A single *kanji* is fine (it's
  meaningful).
- **Particles** are best served by grammar: `に` should surface the N5 particle points
  (`N(time)に V`, `N(person)に あげます`), not 3,000 vocab rows containing に.
- **Deinflection over-reach**: `きた` deinflects to 来る and 着る, and `いって` to 行く, 言う and 要る. Show deinflected hits
  in their own tier with the explanation line, never above an exact match.
- **Duplicates across levels** (86 vocab words recur: ちょうど at N4 and N3, 来る at N5
  and N1). Collapse them into one result with multiple level badges. Don't make the
  learner scroll past copies.
- **English stemming**: light stemming only (`lost`→`lose` via a small irregular list,
  `-s/-ed/-ing`). A synonym engine is out of scope.

---

## 7. Priorities

### Must-have

1. **Kana/katakana folding + NFKC + 〜/~/～ normalisation**: free, and without it
   identical-looking queries fail.
2. **Romaji→hiragana query conversion (Hepburn, kunrei, IME) matched against `reading`**:
   N5/N4 learners can't type kana, and N3/N1 rows have no romaji at all.
3. **Cleaned search keys** (strip `[..]`, `（..）`, `〜`, split on `／`, normalise `・ . -`
   in kanji readings): the raw strings defeat even exact matching (`迷う [道に〜]`).
4. **Verb lemma per vocab row + deinflection of the query (masu, te/ta, nai, potential,
   passive, i-adj)**: N5/N4 store `食べます` while learners type `食べる`, and the reverse.
5. **Grammar form search on cleaned title + structure, ignoring V/N/A placeholders**:
   form is how grammar is looked up 70% of the time.
6. **English meaning search, whole-word, on `meaning`/`summary` only**: second most
   common query, and noisy if it reaches the explanations.
7. **Typed, grouped results with level·lesson badges and deep links**: a hit is useless
   if the learner can't see where it sits in their syllabus.
8. **Single-kana guard and current-level-first ranking**: prevents the "の returns 4,000
   rows" first impression.

### Nice-to-have

1. **Function-category aliases ("because" → Cause/reason chip)**: high value for
   grammar review, and it needs only the mapping table above, not re-tagging.
2. **Adding *addition*, *approximation* and *range* tags, and splitting concession/contrast**:
   fixes the most-asked category gaps (ばかりか is currently unfindable by function).
3. **Long-vowel-folded fuzzy reading match**: catches `tokyo`/`kyoshitsu` from
   Hepburn-without-macrons typists.
4. **Kanji-from-word decomposition** (`迷惑` → 迷, 惑): cheap, and a favourite study habit.
5. **Show the deinflection path** ("待たされた → 待つ, causative-passive past"): turns
   search into a grammar lesson.
6. **Collapse duplicate vocab across levels into one multi-badge result**.
7. **お/ご-prefix aliasing and the small okurigana variant list**: low frequency but
   embarrassing when it fails (`花見`).
8. **Radical filter for kanji**: helps only advanced users. Stroke count is lowest
   priority.
