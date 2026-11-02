# N5 restructure (2026-11)

N5 used to follow *Minna no Nihongo* Book I lesson for lesson. A spot check of the book's
grammar notes against our N4 data (Book II, Lessons 27 and 35) found example sentences
copied word for word and explanations that closely reworded the book's English. The
owner's book was used for the check; N2/N1 come from online sources and are out of scope.
N5 was rebuilt first; N4 and N3 follow the same way (backlog §4).

## What changed

- **Grammar**: every point was rewritten in our own words. Each has a new explanation,
  new example sentences and a new details section. The grammar points themselves (what N5
  teaches) are the same: they are the standard N5 syllabus, not the book's. Very basic
  sentences (わたしは学生です) may resemble any textbook's; that is fine. The book's cast
  (ミラーさん, IMC …) is gone; examples use our own names (アンナ, ケン, リー, エマ, 森, 青木, 小林).
- **Lesson order**: our own 25 lessons, grouped by what a learner wants to say. Existence
  comes early (lesson 4), numbers and shopping get their own lesson (5), giving and
  receiving is taught as one set (あげます／もらいます／くれます, lesson 9), and every
  permission, prohibition and obligation pattern sits together (lesson 17).
- **Vocab**: all 800 rows were regrouped by theme (`scripts/batches/n5-vocab-lessons.json`).
  The core words that carry example sentences come first in each lesson. Their 272 example
  sentences, which used the book's cast (ミラーさん, ワットさん, IMC …), were all rewritten for
  each word's new lesson (`scripts/batches/n5-vocab-examples.json`,
  `scripts/rewrite-n5-vocab-examples.ts`). No row was removed and no other field changed.
- **Kanji**: each kanji moved to the first lesson whose vocab uses it.

## The 25 lessons

| # | Theme | Grammar |
|---|---|---|
| 1 | Meeting people | AはBです, じゃありません, か, はい／いいえ, も, の (group), さん |
| 2 | Things around you | これ／それ／あれ, この／その／あの, 何 (なに／なん), の (owner), S1かS2か, そうですか |
| 3 | Places | ここ／こちら, place です, どこ／どちら, こ・そ・あ・ど, の (made in), お〜／ご〜 |
| 4 | There is / there are | あります／います (question word が), place に…が, …は place に, position words, や, N ですか, ありませんか |
| 5 | Numbers and shopping | numbers and counters, いくら／〜をください, と, だけ |
| 6 | Time and daily routine | 〜時〜分, Vます and its four forms, time に, から〜まで, いつも／時々, ね |
| 7 | Calendar and getting around | へ行きます, で (vehicle), と［一緒に］／一人で, いつ and dates, どこへも／何も, よ |
| 8 | Doing things | を, をします, 何をしますか, で (place), ませんか, ましょう |
| 9 | Tools and giving | で (means), 〜語で何ですか, あげます, もらいます, くれます, もう／まだ |
| 10 | Describing things | い／な-adjectives, predicate and modifier forms, とても／あまり, どう／いかが, どんな, どれ, どの, が／しかし／けど |
| 11 | Likes, skills and reasons | が好き／上手／わかる／ある, degree adverbs, に〜回, から, どうして |
| 12 | Weather and comparisons | past of nouns and adjectives, より, どちら, いちばん |
| 13 | Wants and outings | 欲しい, たい, purpose に, に入る／を出る, どこか／何か |
| 14 | Verb forms and requests | verb groups, dictionary form, て-form, てください, ましょうか (offer), introductory が, 方 |
| 15 | Ongoing actions and states | ている (progressive, state, habit), 知っています／知りません, が for what happens |
| 16 | Linking | て、て, くて, で, てから, AはBが adj, どうやって, そして／それから |
| 17 | Permission and rules | てもいい, てはいけません, ない-form, ないでください, なくてもいい, なければならない, ちゃいけない／なくちゃ, object は |
| 18 | Abilities and hobbies | ことができます, 趣味は〜ことです |
| 19 | Experiences and change | た-form, たことがあります, たり〜たり, なります, そうですね |
| 20 | Casual talk | polite and plain style, when to use which, plain conversation |
| 21 | Guesses, opinions and events | でしょう (probably), だろう, でしょう？, place で event があります, occasion で, Nでも |
| 22 | Describing with clauses | noun modification, clause + noun, が inside a modifying clause, dictionary form + 時間／約束／用事 |
| 23 | When and where | とき, dictionary form vs た-form とき, が inside とき／から clauses, を with movement |
| 24 | が for new information | person が V, question word が |
| 25 | Before and after | まえに, たあとで／のあとで |

The milestones the AI prompts rely on (`N5_FORM_MILESTONES` in `services/ai/prompts.ts`) are
reason clauses with から 11, dictionary form and て-form 14, ない-form 17, た-form 19, plain
style 20, noun-modifying clauses 22.

## Merged and new points

139 old rows became 136:

- お国, お〜 and ご注文 merged into one **お〜／ご〜** point (lesson 3).
- The two verb-group rows merged (lesson 14).
- どんな N and Aはどんな Bですか merged (lesson 10).
- N(person)と V and 一緒に merged (lesson 7).
- The two "が for a scene" rows merged (lesson 15).
- New: **いくらですか／N を ください** (lesson 5), **〜でしょう (probably)** (lesson 21) and
  **V たあとで／N のあとで** (lesson 25, paired with まえに).

## Japanese-teacher review

The SME review (2026-11-02) approved with changes. It fixed four wrong explanations, one
wrong translation and an ungrammatical vocab example, plus about 20 smaller slips. The lesson
order changed as a result:
- The dictionary form moved next to the て-form (L14), so the て-form rule has its basis.
- どの joined どれ (L10).
- が inside clauses moved to where clauses are first used (L22, L23).
- でしょう got its own point before だろう (L21).
- まえに and the new あとで became L25.

## How it was applied

`npx tsx scripts/restructure-n5.ts` is a one-time migration. It reads the authored grammar
(`scripts/batches/n5-grammar/*.json`, each point listing the old uids it `replaces`) and the
vocab assignment. It writes the three N5 data files and
`grammar-app/src/store/n5RestructureUids.ts`, and refuses to run again on restructured data.
`npx tsx scripts/rewrite-n5-vocab-examples.ts` then writes the new vocab examples. It checks
each row's word first and is idempotent.
The AI cache (store v11) moves every cached note, example set and mnemonic to its item's new
uid. Where rows merged, the most recently generated note wins.

Scripts that placed rows into N5 lessons before this change (`add-core-expressions.ts`,
`fill-n5-n4-gaps.ts` for N5) describe the old lesson numbers and are not re-run.
