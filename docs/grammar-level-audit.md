# Grammar level audit

Compared our grammar points (N5 143, N4 119, N3 85) against jlptsensei.com's level lists
(N5 84, N4 132, N3 182, N2 160; N1 only the first 40 could be loaded).

## Status

| Stage | What | State |
|---|---|---|
| 1 | Restructure: move 14 N3 points to N4, drop 17 duplicates, park 20 N2/N1 points in `data/n2/grammar.json` (script: `scripts/restructure-grammar-levels.ts`) | done |
| 2 | Author the missing N3 points: 105 new points (`scripts/add-grammar-items.ts`), N3 is now 139 points over all 24 lessons | done |
| 3 | Author the missing N4 / N5 points: 25 N4 + 9 N5, plus 16 remaining N3 gaps | done |
| 4 | Re-level contested points (`scripts/move-grammar-levels.ts`): 13 N5 -> N4, 4 N4 -> N3, 1 N3 -> N2, 1 duplicate dropped | done |

Final counts: N5 139, N4 166, N3 158 (+21 parked as N2 in `data/n2/grammar.json`).

### Stage 4: re-leveling rule

Each contested point was checked against two sources (jlptsensei's level lists and Bunpro's
per-point JLPT tag). Where both gave a harder level the point moved up; where they disagreed it
also moved up (uncertain -> the higher level), one level at a time. Where both agreed the point
is at its current level it stayed, whatever a reviewer suspected.

Moved N5 -> N4: なければなりません and ないと(いけません) (jlptsensei N4 / Bunpro N4), までに, なかなか, ぜひ,
と思います, と言います, conditional と (jlptsensei N4, Bunpro N5), てあげる/てもらう/てくれる, たら,
ても and もし/いくら (N3 on jlptsensei; placed in N4). Moved N4 -> N3: とおりに, によって (passive
agent), とちゅうで, 数量＋は. N3 -> N2: ところだった. Dropped: N4 ば〜ほど (N3 already has it).
N5 lesson 25 now keeps only the generic subordinate-clause が rule, because its other four
points were all conditionals.

Kept where both sources agree: だろう, ないといけません (jlptsensei N5), なくてもいいです, づらい, 出す,
に気がつく (N4), がたい (N3 on both), とみえる (N3 on jlptsensei; Bunpro tags it N4), and the N5
adverb point よく／だいたい／あまり／全然 (basic N5 vocabulary).


Deliberately left alone: the borderline N4/N5 boundary items (section 1), and a few reference
entries that are already covered under different notation in our decks (e.g. てしまう, てくる,
ございます, お〜になる) or that are plain vocabulary (さて, たって, 数量＋は, which N4 17-3 already covers).
The new points' Japanese was authored against the schema and my own reading of each pattern; a
native-level review of a sample is still worthwhile.

**Caveat.** jlpt.jp publishes no grammar list (only a per-level competence description), so
every level boundary here is community consensus. jlptsensei is one source and it differs from
others on borderline points. Findings are tagged **High** (clearly wrong level / duplicate) or
**Borderline** (sources disagree). Nothing has been changed in the data.

Matching was done by title/structure, then checked by hand. Our N5/N4 split follows the old
textbook boundary (lesson 25/26), which is where most of the borderline items come from.

## 1. Misplaced

### N3 points that are N4 or N5 (High)

| Our point | Belongs at |
|---|---|
| n3-1-1 / n3-11-1 〜てくる・〜ていく | N4 (also a duplicate pair) |
| n3-1-3 / n3-15-1 〜という | N4 (also a duplicate pair) |
| n3-1-4 〜みたいだ | N4 |
| n3-2-1 〜てほしい | N4 |
| n3-2-2 〜ことにする, n3-2-3 〜ことになる | N4 |
| n3-3-1 〜ようにする, n3-3-2 〜ようになる | N4 (n4-11-3 already covers ようにする) |
| n3-3-3 〜始める/続ける/終わる | N4 |
| n3-4-1 / n3-11-4 〜らしい | N4 (also a duplicate pair) |
| n3-4-2 〜がる | N4 |
| n3-4-3 〜させられる | N4 |
| n3-5-3 〜てもらう/てくれる | N4 (we also teach it in N5) |
| n3-7-3 〜(の)なら | N4 (duplicate of n4-10-4) |
| n3-8-1 〜ことがある | N4 (N5 たことがある exists) |
| n3-10-1 〜まま | N4 |
| n3-10-3 〜はずだ | N4 (duplicate of n4-21-3) |
| n3-11-2 〜たら[どう]？ | N4 |
| n3-11-3 〜より…ほうが… | N5 (duplicate of N5 comparison points) |
| n3-11-7 〜ている | N5 |
| n3-12-3 〜たり〜たり | N5 (duplicate) |
| n3-23-3 この＋N | N5 |

### N3 points that are N2/N1

Verified against jlptsensei's N2 list (High): n3-16-1 〜に応じて, n3-16-3 〜にもかかわらず,
n3-17-2 〜からには, n3-18-3 〜ものの, n3-19-3 〜をめぐって, n3-20-2 〜からいうと,
n3-21-3 〜に基づいて, n3-21-4 〜が、一方で, n3-22-1 〜次第だ/次第で, n3-14-3 〜に(も)わたって,
n3-12-1 〜もの/もんだから.

Not found in the part of the lists I could load; from my own knowledge N2 or N1, so **confirm
before moving**: n3-17-3 〜ざるを得ない, n3-17-4 〜からなる, n3-14-2 〜といった,
n3-24-2 〜から〜に至るまで, n3-23-1 〜に及ぶ, n3-21-2 〜といえども, n3-22-2 〜をもって…とする,
n3-22-3 〜におきましては, n3-24-1 V-ない＋ざるN.

Net effect: N3 lessons 16–24 are mostly N2 material, and lessons 1–13 are mostly N4/N5 material.

### Duplicates inside N3

- らしい: 4-1, 11-4
- として: 7-2, 11-5, 19-1
- によって/による: 8-2, 16-2
- おかげで/せいで: 5-2, 12-5, 12-6
- 〜ず(に): 10-2, 11-6, 21-1
- ほど: 9-1 (ば〜ほど) vs 13-4

### N4 points that jlptsensei puts at N3 (Borderline)

n4-9-1 〜とおりに, n4-10-6 〜ば〜ほど (also duplicates n3-9-1), n4-12-5 〜によって (passive agent),
n4-14-4 とちゅうで, n4-17-3 Quantifier＋は.

### N4 points that jlptsensei puts at N5 (Borderline; our N4 starts at the old Book II boundary)

n4-1-1 んです, n4-7-1 ほうがいいです, n4-6-5 まだ〜ていません, n4-19-4 Nにします,
n4-19-1 すぎます, n4-5-1 〜てあります, n4-6-3 〜つもりです, n4-14-3 〜ので,
n4-13-3 〜のが好き/上手/下手.

### N5 points that jlptsensei puts at N4 (Borderline)

てあげる/てもらう/てくれる, 〜と思います, 〜と言います, 〜たら, 〜と (conditional),
〜までに, なかなか, ぜひ.

## 2. Missing

### N5 (low priority, mostly connectives and colloquial variants)

そして/それから/しかし, けど/けれども, ちゃいけない・じゃいけない, なくては/なくちゃ variants,
だろう, 〜かた (Vます-form 方), 一緒に/いつも.

### N4

間 / 間に, 〜出す, ではないか/じゃないか, 〜が必要/必要がある, はずがない, かしら/かい/かな,
頃/ごろ, 急に, または, なさい, に気がつく, おきに, さっき, さすが, そんなに, それでも,
〜たがる, transitive/intransitive pairs, やっと, 〜づらい, 〜と言われている, 〜と聞いた
(hearsay), 〜てよかった, 〜てすみません, 〜だけで.

### N3 (roughly 90–100 of jlptsensei's 182 have no counterpart)

Notable gaps: べきだ/べきではない, がち, 気味, っぽい, だらけ, ごとに, ぶりに, まるで, むしろ,
くせに, ながらも, わけだ/わけがない/わけにはいかない, ようがない, ずにはいられない,
さえ/さえ〜ば, こそ, 〜とは限らない, とたん, うちに, 上で/上に, わざわざ/わざと, 〜に反して,
〜にしたがって, 〜につれて, 〜によると/によれば, 〜をはじめ, 〜を中心に, 〜ばかりでなく,
〜だけでなく, 〜としたら/とすれば, 〜というより, 〜ということだ, 〜といっても,
〜つもりだった, 〜ようとする, 〜ふりをする, 〜かける, 〜きる (we have), 〜直す, 〜込む,
〜ついでに, 〜つもりで, 〜ところが/ところで, 〜どうしても, 〜どんなに〜ても, 〜ようなきがする.
Plus adverbs/connectives the list treats as grammar: さらに, しばらく, すでに, ついに, つまり,
なるべく, なぜなら, それとも, 結局, 決して〜ない, めったに〜ない.
