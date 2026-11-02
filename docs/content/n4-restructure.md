# N4 restructure (2026-11)

N4 followed *Minna no Nihongo* Book II lesson for lesson (N4 Lesson n = Minna Lesson 25 + n).
A spot check of the book's grammar notes (Lessons 27 and 35) found 11 example sentences
copied word for word, explanations that closely reworded the book's English, and the book's
さくら大学. N4 was rebuilt the same way as N5 (`docs/content/n5-restructure.md`); N3 is next
(backlog §4).

## What changed

- **Grammar**: every point was rewritten in our own words: new explanation, summary,
  details and example sentences. What N4 teaches is the same: the points are the standard
  N4 syllabus, not the book's. The book's cast is gone; examples use the same names as N5
  (アンナ, ケン, リー, エマ, 森, 青木, 小林). Each example uses grammar from its own lesson or
  earlier where possible (the set phrases たらいいですか in L1 and もしかしたら in L8 come
  before たら itself in L9).
- **Lesson order**: our own 25 lessons, grouped by what a learner wants to do (table below).
  The potential comes first (L2), so ように (L13) can build on it; every conditional sits in
  two lessons (L9 たら／と／ても／のに, L10 ば／なら／場合); appearance (L18) and hearsay (L19)
  are side by side; passive (L22) comes right before causative (L23) and keigo (L24–25),
  which reuses its forms.
- **Vocab**: all 792 rows were regrouped by theme (`scripts/batches/n4-vocab-lessons.json`).
  Core words with example sentences come first in each lesson. Their 300 example sentences
  were all rewritten for each word's new lesson (`scripts/batches/n4-vocab-examples.json`,
  `scripts/rewrite-n4-vocab-examples.ts`). No row was removed and no other field changed.
- **Kanji**: each kanji moved to the first lesson whose vocab uses it.
- **AI prompts**: N4 lesson scopes no longer mention Minna. Like N5, they name the forms a
  lesson has not reached yet (`N4_FORM_MILESTONES` in `services/ai/prompts.ts`): potential 2,
  volitional 7, たら／と／ても 9, ば／なら 10, imperative 11, appearance そう／よう／みたい 18,
  hearsay 19, passive 22, causative 23, respectful keigo 24, humble keigo 25.

## The 25 lessons

| # | Grammar theme | Vocab theme | Grammar |
|---|---|---|---|
| 1 | Explaining and asking | Appointments, meetings, keeping in touch | んです, ていただけませんか, Q + たらいいですか, それは〜ですね, に for the destination |
| 2 | What you can do | Senses, skills, sports | potential form, が with potentials, 見える／聞こえる, できる (be made), は／も／しか with particles |
| 3 | Habits and how often | Daily life and study routine | ている (habit), ながら, ことがある, 間／間に, おきに, ごろ |
| 4 | Reasons | Accidents, disasters | ので, て／くて／で (reason), N で (cause), てよかった, てすみません, し, それに, それで, とか, または |
| 5 | States and results | Things that break or get lost | transitive／intransitive pairs, ている (result), てある, まま, まだ (still), まだ〜ていない, ありました |
| 6 | Getting things done | Housework and tidying | ておく, てしまう, てみる, 始める／終わる／続ける, 出す, に気がつく, て来る, やっと |
| 7 | Plans and intentions | Plans, exams, life events | と思う, volitional, (よ)うと思っている, つもり, 予定, ことにする, ことになる, ぜひ |
| 8 | Guessing | Weather and nature | きっと／たぶん〜でしょう, かもしれない, はず, はずがない, じゃないか, さすが |
| 9 | If, even if, although | Money and shopping | たら (if), たら (when), もし／いくら, と, ても, それでも, のに |
| 10 | If: ば and なら | Travel and transport | ば-form, using ば, Q + ばいいですか, なら, と／ば／たら／なら compared, 場合は |
| 11 | Advice, rules, commands | Health and rules | ほうがいい, たらどう, imperative and prohibitive, where imperatives appear, なさい, なければならない／ないと, 必要 |
| 12 | Quoting and meanings | Language, reading, writing | と言う, と言っていた, と伝えていただけませんか, と読む／と書いてある, という意味, という N, そ〜 in writing |
| 13 | Change and effort | Growing and changing | ように, ようになる／なくなる, ようにする, く／にする, N にする, く／に + V, てくる／ていく, 急に |
| 14 | Turning actions into nouns | Hobbies, arts, festivals | の, のは adj, のが adj, のを忘れた, のを知っていますか, のは N です, 〜さ |
| 15 | Questions inside sentences | Office work and machines | Q + か, かどうか, でしょうか, かな／かしら, どこかで／どこかに |
| 16 | Doing things for people | Family, gifts, favours | てあげる／もらう／くれる, やる, いただく, くださる, ていただく／てくださる, てくださいませんか, てほしい, N に (as a gift) |
| 17 | Purpose and amounts | Cooking and food | ために, のに (for), quantity も, quantity で, だけで, から／でつくる, そんなに, なかなか |
| 18 | How things look | Appearance, clothes, materials | adj そう, V そう, ようです, みたい, 声／音／においがする |
| 19 | What you hear | News and society | hearsay そうです, らしい, と聞いた, ということです／って |
| 20 | Too much, easy, hard, others' feelings | Feelings | すぎる, やすい／にくい, づらい, がる, たがる |
| 21 | Timing | Moving house, deliveries | ところ, たばかり, さっき／たった今, あとで vs てから, て／ないで + V, ないで (instead), までに, とき + particles |
| 22 | The passive | Trouble and crime | passive form, direct passive, passive of something of mine, thing + passive, と言われている |
| 23 | The causative | School and science | causative form, を + intransitive, に + transitive, make vs let, させていただけませんか, させられる |
| 24 | Respectful language | Guests and the workplace | 敬語 overview, れる／られる, お〜になる, special respectful verbs, お〜ください, お／ご on words |
| 25 | Humble language | Formal visits and the home | 謙譲語 overview, お〜する, special humble verbs, ございます, keigo level and consistency |

The vocab themes only loosely match the grammar themes: words were grouped so each
lesson's examples can use its grammar (accident words in the reasons lesson, cooking in the
purpose-and-amounts lesson, school words with the causative).

## Merged points

166 old rows became 162:

- でしょう (plain form + でしょう) and きっと／たぶん／もしかしたら became one point (L8).
- なければなりません and the casual 〜ないと became one point (L11).
- Object は (好きです・上手です) joined は／も／しか (L2).
- The two adjective そう rows became one (L18).

あとで (N5 L25) is now taught in N4 as a contrast with てから (L21).

## Japanese-teacher review

The SME review (2026-11-02) approved with changes:
- **Wrong or misleading**: the そ-in-writing details used それで (a conjunction) as its
  example; "only に works with 入る" was overstated (部屋へ入る is fine); the はず note
  ruled out わたしは行くはずです, which is right when someone else made the plan.
- **Taught too early**: と, ば, ても, のに, ないで and ので appeared in examples before their
  lessons (L1, L2, L5, L6, L7, L8). All were rewritten with earlier grammar.
- **Unnatural**: 新しい魚 → 新鮮な魚; たった今〜たばかり → たった今〜たところ;
  ご覧になってください → a plain question with ご覧になる; お先にどうぞ used as the set phrase.
- About ten smaller fixes to translations and examples (a gendered "sir", doll vs stuffed
  toy, floor numbering, 酔う, 落ちている).

The lesson sequence was kept as it is.

## How it was applied

`npx tsx scripts/restructure-n4.ts` is a one-time migration with the same helpers as N5
(`scripts/lib/n5Restructure.ts`, now level-aware). It reads the authored grammar
(`scripts/batches/n4-grammar/*.json`, each point listing the old uids it `replaces`) and the
vocab assignment, writes the three N4 data files and `grammar-app/src/store/n4RestructureUids.ts`,
and refuses to run again on restructured data. `npx tsx scripts/rewrite-n4-vocab-examples.ts`
then writes the new vocab examples; it checks each row's word first and is idempotent.
The AI cache (store v12) moves every cached N4 note, example set and mnemonic to its item's
new uid; where rows merged, the most recently generated note wins.

Scripts that placed or fixed rows by old N4 uid (`fill-n5-n4-gaps.ts` for N4,
`fix-n4-compounds.ts`, `renumber-n4.ts`) describe the old lesson numbers and are not re-run.
