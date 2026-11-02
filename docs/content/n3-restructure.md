# N3 restructure (2026-11)

N3 had 24 lessons that came from the textbook era: the vocab followed *Minna no Nihongo*
Chūkyū I–II lesson by lesson (L2 was the book's 外来語 lesson, L13 its proverbs and 四字熟語).
The grammar had been rewritten by an AI pass in October 2026 (105 of its points), but it
still sat in those lessons, in no particular order. N3 is rebuilt like N5 and N4
(`docs/content/n5-restructure.md`, `docs/content/n4-restructure.md`), which finishes the
rewrite: no level now follows a textbook's lessons.

## What changed

- **Grammar**: every point was rewritten in our own words: explanation, summary, details
  and examples. What N3 teaches is the same standard N3 syllabus. Examples use the cast
  shared with N5/N4 (アンナ, ケン, リー, エマ, 森, 青木, 小林). N3 lessons are not cumulative (the
  AI prompts use the level as the ceiling), so examples may use any N3 grammar.
- **Lesson order**: our own 24 lessons, grouped by function (table below): attitude adverbs
  first, then negatives, connectives, time, reasons, comparison, tendencies, contrast,
  conditions, regret, emphasis, softening, topics, hearsay, moments, change, certainty,
  feelings, attempts, "without", compound verbs, additions, describing, the passive.
- **Vocab**: all 3,176 rows were regrouped into 24 themes
  (`scripts/batches/n3-vocab-lessons.json`). A keyword pass over the glosses gave a first
  label; every word was then checked and placed by hand, and small themes were merged and
  big ones split to balance the lessons (77–196 words each; the old lessons had 126–171).
  Core words with example sentences come first in each lesson. No row was removed and no
  other field changed.
- **Vocab examples**: the 1,867 N3 example sentences were generic sentences, not the book's
  text (only three used named people: 佐藤, 田中, 山田). Those three were rewritten with our
  cast (`scripts/batches/n3-vocab-examples.json`); the rest are kept, after a teacher spot
  check.
- **Kanji**: each kanji moved to the first lesson whose vocab uses it.

## The 24 lessons

| # | Grammar theme | Vocab theme (words) | Grammar |
|---|---|---|---|
| 1 | On purpose, by chance | People and relationships (166) | わざわざ, わざと, ついでに, ふと, なるべく, しばらく |
| 2 | Strong negatives | Personality, appearance and clothes (116) | めったに〜ない, 決して〜ない, 別に〜ない, とても〜ない, まさか, どうしても, 一体 |
| 3 | Linking ideas | Body and health (104) | さらに, それとも, そのために, なぜなら, つまり／すなわち, 結局, ところが, 確かに〜が |
| 4 | Time words | Home and housework (77) | すでに, ついに, ぶりに, から〜にかけて, 一度に, 中（ちゅう／じゅう） |
| 5 | Reasons and results | Food and cooking (92) | おかげで／せいで, ものだから, ことから, 結果, わけだ, 上で |
| 6 | Degree and comparison | Shopping and money (117) | くらい, ほど〜ない, ほど, に比べて, よりも, わりに, にしては, あまりにも |
| 7 | Tendencies | Work and business (133) | がち, 気味, っぽい, だらけ, 一方だ |
| 8 | Contrast and concession | School and study (82) | に対して, ながらも, くせに, どんなに〜ても, たとえ〜ても, といっても, にしても |
| 9 | Conditions | Reading, writing and the news (134) | ばいい／といい, ば〜ほど, もしも, とすれば／としたら, さえ〜ば, てからでないと, てはじめて |
| 10 | Should and regret | Talking and messages (162) | べきだ, ばよかった, ば〜のに, たものだ, つもりだった, ところだった |
| 11 | Emphasis and limits | Travel, transport and town (156) | さえ, こそ, きり, ばかり, しかない, せいぜい, quantity + は, ずつ |
| 12 | Playing things down | Nature and weather (128) | なんて, なんか, も〜ば〜も, ことは〜が, ないことはない, わけではない, というより, むしろ |
| 13 | Topics and viewpoints | Science, technology and the environment (105) | について, に関して, にとって, として, において, と言えば, というのは |
| 14 | Hearsay and careful questions | Society, politics and the world (147) | によると, ということだ, んだって, っけ, のでしょうか, か何か |
| 15 | Moments in time | Culture and traditions (83) | うちに, 最中に, たとたん, 途中で, 際に, たびに, ごとに, たて |
| 16 | Changing together | Hobbies, sports and the arts (180) | にしたがって, につれて, とともに, に反して, を通して, とおりに |
| 17 | Sure and impossible | Time and order (170) | に違いない, わけがない, わけにはいかない, ようがない, とは限らない, 可能性がある, そうにない |
| 18 | Feelings and impressions | Amounts and degree (181) | てしょうがない, ずにはいられない, がたい, を込めて, ような気がする, ように見える, まるで〜ようだ, とみえる |
| 19 | Trying, pretending, asking others | Feelings (85) | ようとする, ようとしない, ふりをする, ように言う／頼む, てごらん, ても構わない |
| 20 | Without, and no point | Thinking, judging and deciding (172) | ずに, もせずに, ずに済む, っぱなし, たりしない, ている場合じゃない, ても始まらない, てもしょうがない |
| 21 | Compound verbs | Movement and actions (170) | かける, 込む, 直す, 合う, きる／きれない, 上げる, 通す |
| 22 | Examples and additions | Trouble, accidents and safety (93) | だけでなく, 上に, 例えば〜など, をはじめ, はもちろん, 〜の一つだ |
| 23 | Describing things | Describing things (127) | で有名だ, を中心に, 向け／向き, 的, は別として |
| 24 | The passive and agents | States, change and relations (196) | suffering passive, によって／による, に慣れる, の代わりに |

N3 vocab lessons are big (about 130 words), so the vocab themes are not tied to the grammar
of the same lesson the way N5/N4 are.

## Merged points

163 old rows became 160:
- つまり and すなわち became one point (L3).
- 〜きる and 〜きれない became one point (L21).
- によって／による and "A は B によって V passive" became one point (L24); the creator use is
  also taught in N4 L22.

## Japanese-teacher review

The SME review (2026-11-02) approved with changes. A sample of 60 kept vocab examples found
generic study sentences, not textbook text, so keeping them stands; one (言い訳する) was
unnatural and was rewritten. In the grammar, 田中 was left in two details sections (now 森),
an example misused 見直す ("re-watch"; it means re-check or re-evaluate) under 〜直す, and two
English translations assumed a gender the Japanese doesn't give. The sequence and the vocab
themes were kept.

## How it was applied

`npx tsx scripts/restructure-n3.ts` is a one-time migration with the same helpers as N5/N4
(`scripts/lib/n5Restructure.ts`, which now takes the lesson count). It reads the authored
grammar (`scripts/batches/n3-grammar/*.json`) and the vocab assignment, writes the three N3
data files and `grammar-app/src/store/n3RestructureUids.ts`, and refuses to run again.
`npx tsx scripts/rewrite-n3-vocab-examples.ts` then writes the four rewritten examples.
The AI cache (store v13) moves every cached N3 note, example set and mnemonic to its item's
new uid.

Scripts that placed rows into N3 lessons by old uid (`review-n3-kanji-vocab.ts`,
`move-grammar-levels.ts`, `restructure-grammar-levels.ts`) describe the old lesson numbers and
are not re-run.
