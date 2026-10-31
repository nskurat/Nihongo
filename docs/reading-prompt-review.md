# Reading Practice prompt: teacher review

Scope: the prompt that generates a Reading Practice passage and its 5-question quiz:
`grammar-app/src/services/ai/prompts.ts`, `promptBuilder.ts`, how `registry.ts` sends it,
what `readingParser.ts` accepts and how `features/reading/ReadingSection.tsx` renders it.
I judged it by reading prompts built with real lesson data (N5 L5, N4 L10, N3 L8, N2 L5,
N1 L10, plus general prompts). **No AI provider was called.**

Note: this review was written before N2/N1 got vocab data and Reading Practice; both now
exist on `main`, so N2/N1 lesson prompts carry grammar and vocab targets like the other levels.

## 1. Issues in the old prompt

### Pedagogy

| # | Issue | Evidence (old prompt) |
|---|---|---|
| P1 | **One length for every level, measured in English words.** An N5 note and an N3 essay got the same size, and "words" means nothing for Japanese. Real JLPT texts run from about 80–250 characters at N5 to about 1,000 at N1. | `1. Passage Length: Around 150 words (approx. 250–350 Japanese characters).` |
| P2 | **No genre or register.** JLPT reading is built on text types (N5 notes and notices, N3 essays and guides, N1 editorials and critiques). Nothing asked for them, so the model tended to write the same "story about a trip" at every level. | `Generate a captivating, natural Japanese reading passage` |
| P3 | **The persona stopped at N3** but the builder accepts N2/N1. | `specializing in JLPT N5, N4, and N3 reading comprehension.` |
| P4 | **No ceiling.** No grammar, vocab or kanji limit beyond "aligned with". In particular a lesson-targeted N5 L5 prompt (Minna L5: へ 行きます, で (vehicle), いつ) would happily come back with て-form and plain style, which L5 learners have not met. | `Keep sentence structures, vocabulary, and kanji aligned with JLPT ${level} proficiency.` |
| P5 | **Question types were generic.** There was no 指示語 (referent), 下線部 (quoted phrase), 主張理解 (writer's claim) or 情報検索 (information retrieval), and no progression from detail at N5 to argument at N1. | `testing reading comprehension, main idea, and specific details` |
| P6 | **No distractor rules.** No plausibility, parallel form or "uses passage words but misstates them" rule. Nothing stopped the longest option from being the right one, or answers that general knowledge alone could give (e.g. "Where is Mt Fuji?"). | — |
| P7 | **Explanations only had to be "citing passage evidence"**, with no requirement to quote the sentence or to say why the tempting distractor is wrong. | `"explanationJp": "Japanese explanation … citing passage evidence."` |
| P8 | **One furigana policy for every level.** Every kanji got furigana at N1 too, unlike the exam. That inflates output tokens by about 60% at N2/N1 for little benefit. | `For all Kanji, write the reading in brackets` |

### Reliability

| # | Issue | Evidence |
|---|---|---|
| R1 | **Labelled options.** "(A, B, C, D)" invites `"A. 京都へ行った"`, but the UI already prints A–D (`String.fromCharCode(65 + optIdx)`), so the learner saw "A  A. …". | `exactly 4 options (A, B, C, D)` |
| R2 | **Answer-key bias.** The model chose `correctIndex` freely, and the schema example showed `"correctIndex": 1`. Models over-pick one position (often the first or second), and they copy example values. | `"correctIndex": 1,` |
| R3 | **Furigana notation was under-specified for the parser.** The parser only ruby-fies a *run of kanji* immediately followed by `[reading]`. `食べ物[たべもの]` renders "食べ" bare with "たべもの" over 物. `行き[いき]` leaves raw brackets on screen. Nothing said "one bracket per kanji run, okurigana outside", how to handle 熟字訓 (今日[きょう]), or that `[]` must not be used for anything else. | `like this: 漢字[かんじ] or 京都[きょうと]へ行[い]きました` |
| R4 | **The lesson vocab injected square brackets into a prompt where `[]` means furigana.** About 17% of N3 vocab rows (316/1,878) carry notes such as `迷う [道に〜]`, `平凡 [な]`, `[お]花見`, and they were pasted verbatim. Phrases and affixes were also passed as "words": `確か、〜たと思います。`, `〜過ぎ`, `もう／まだ`. | `vocabList.slice(0, 8).map((v) => \`${v.word} (${v.reading}: ${v.meaning})\`)` |
| R5 | **The target selection was always the first 4 grammar / first 8 vocab rows.** N5 lessons have up to 10 grammar points and N4 up to 12, so the last ones (e.g. N4 L10 `〜たら［どう］？`, `もし and いくら`) never appeared. Every generation for a lesson drilled the same 8 words, out of up to 158 at N3. There was also no "use at least N" requirement, so "incorporate naturally" was often ignored. | `.slice(0, 4)` / `.slice(0, 8)` |
| R6 | **Long English `meaning` strings were pasted whole.** N4 grammar meanings are multi-sentence paragraphs. | — |
| R7 | **JSON robustness gaps.** Nothing said to avoid ASCII `"` in Japanese text (common in quoted speech, and it breaks JSON) or how to write paragraph breaks. | — |
| R8 | **Anthropic `max_tokens: 1500` truncates the response.** A full set (passage with furigana, translation, glossary, 5 questions with JP and EN explanations) is about 2.5k output tokens at N3 and 4–5k at N1. Claude responses were cut mid-JSON and failed to parse. Gemini and OpenAI set no cap. | `providers/anthropic.ts` |
| R9 | **Weak wording.** "Pure Japanese question", "true immersion" and "captivating" are vague. Two bits of text claimed to be the system prompt (OpenAI's own system message plus the in-prompt persona). That is harmless, but the persona needed to be a real role. | — |

## 2. Decisions and rationale

### Language of the instructions: English, with Japanese for terms of art and models of output

- **Following instructions.** All three providers' models (Gemini Flash, GPT-4o/mini/3.5, Claude Sonnet/Haiku) are tuned mostly on English instructions. Rules like "exactly", "MUST be 1, 1, 2, 3, 0", "never" and "at most 3" are followed most reliably in English, and the weaker defaults here (gpt-4o-mini, gpt-3.5-turbo, Flash) are the ones that drift most on Japanese meta-instructions.
- **Token cost.** Japanese prose usually takes 1.5–2× the tokens of the same instruction in English on these tokenizers. The prompt is about 6–7.6k characters, so a Japanese version would cost noticeably more input tokens per generation, paid by the user, without adding information.
- **Naturalness of the output** depends far more on the stated genre, register and examples than on the language of the instructions. Translationese comes from vague English topics, not from English rules. So the prompt gives Japanese where it shapes the output: genre names (社説, 評論, エッセイ, お知らせ), JLPT question types (内容理解, 指示語, 主張理解, 情報検索), real question stems (「「〜」とあるが、どういうことか。」, 「筆者の主張に最も近いものはどれか。」), connectives per level, and furigana examples.
- **The schema keys and topic strings are English already.** The preset topics are English, and the JSON keys are a parser contract.

**Result: English instructions, Japanese exemplars, schema unchanged.**

### Level rules table (`READING_LEVEL_SPECS` in `prompts.ts`)

| Level | Length (chars, no furigana) | Genres | Register | Furigana | Q1–Q5 plan |
|---|---|---|---|---|---|
| N5 | 200–300 | diary, message/email, self-intro, notice (お知らせ) | です/ます, short sentences | every kanji | detail, detail, sequence, reason **or** 情報検索, whole/purpose |
| N4 | 300–450 | diary/blog, letter/email, notice/rules, short explanation | polite (plain in diary) | every kanji | detail, detail, reason, 情報検索 / decision, main message |
| N3 | 400–550 | エッセイ, letter, 案内, short article | だ/である for essays, polite for letters | every kanji | paraphrased detail, 指示語, reason, quoted phrase / feeling, main idea |
| N2 | 550–750 | コラム, commentary, opinion essay, business email | written である, formal vocabulary | words beyond N3 only | 下線部, reason, referent / example role, inference / attitude, 主張理解 |
| N1 | 700–900 | 社説, 評論, argumentative essay | dense である, thesis + concession | words beyond N3 only | 下線部, argument logic, implication, premise / attitude, 主張理解 |

- The lengths are compressed relative to the exam (one passage has to carry 5 questions, and N1 is capped at 900 for output-token cost), but they rise monotonically and keep the N5 vs N1 gap.
- **Furigana:** at N5–N3, every kanji. The UI's always/hover/off toggle already gives immersion, and learners at these levels need the readings. At N2/N1, furigana goes only on words beyond N3, proper nouns and irregular readings, every time they appear, as in the exam. This saves about a third of the passage's output tokens and makes "always" mode show readings exactly where they help.
- **The final question is always about the whole passage**, and questions follow passage order, as in the JLPT.

### Ceilings

- **Kanji ceiling for N5/N4** comes from the portal's own data. `useReadingData` loads the kanji lists (N5 = 220 chars, N4 = N5 + N4 = 498) and the prompt says "use only these kanji; other words in hiragana". The model's sense of "basic kanji" is least reliable exactly here. Target vocab may keep its spelling (N5 L5's 誕生日 contains non-list kanji). At N3+ the list would be too long and the repo's N3 kanji set is partial (121 rows), so those levels get a verbal ceiling.
- **Lesson ceiling for N5/N4.** The N5 data follows the Minna no Nihongo order exactly (L14 て-form, L17 ない-form, L18 dictionary form, L19 た-form, L20 plain style, L22 noun modification). Lesson prompts say "studied Lessons 1–n only" and, for N5, list the forms not yet taught. These rules apply to the passage and options. Question stems and explanations may use standard short JLPT N5 phrasing, because explaining an answer without から/て-form is unworkable. N4 L*n* is described as Minna 25 + *n*.
- **Vocab above level:** at most 3 words, each listed in `vocabulary`.

### Question quality

- Distractors must be built from words that do appear in the passage, but wrong in who, when or why, reversed, or over-generalised. They must be parallel in form and similar in length. No all-of-the-above, and the correct option must not be the longest. From N3 up, the correct option paraphrases the passage instead of copying it, so that word-matching does not work.
- "No question may be answerable from general knowledge or common sense alone."
- `explanationJp` must quote the decisive sentence in 「」, give the reason, and say why the most tempting distractor is wrong. It refers to options by content, never by letter, because the letters are the UI's.

### Reliability fixes

- **Answer key assigned by code.** `buildAnswerKey()` returns five positions that use every index 0–3 at least once, in random order. The prompt says `correctIndex values … MUST be 2, 0, 3, 1, 2`. The schema example no longer shows a concrete index. I chose this over shuffling options client-side because a shuffle would break any explanation that still mentions a position. The parser is unchanged.
- **Furigana notation block** written for the parser. The bracket goes immediately after the kanji, okurigana stays outside (`行[い]きました`, `食[た]べ物[もの]`), one bracket per kanji word, 熟字訓 over the whole word (`今日[きょう]`, `一人[ひとり]`, `時々[ときどき]`), no kana, spaces, katakana or romaji inside, no other ruby syntaxes, and `[]` is reserved. A unit test runs every example in that block through `parseFuriganaTokens` and fails if any leaves a stray bracket.
- **Target selection.** Up to 5 grammar points, randomly sampled and kept in lesson order, with each meaning cut to its first sentence. Up to 10 vocab items, randomly sampled after cleaning: `[...]` notes are moved out of the headword (`迷う (まよう: lose (one's way); as in 道に〜)`), and phrases, affixes and ／-pairs are dropped. The prompt requires at least 3 grammar points and 5 words to be used, and the used patterns must be listed in `grammarUsed`. The random source is injectable (`rng`) so tests are deterministic.
- **Output format:** one JSON object, no fences, 「」 instead of ASCII quotes inside Japanese, and `\n` for paragraph breaks (the passage is rendered with `whitespace-pre-line`).
- **Anthropic `max_tokens` raised from 1500 to 8192.** Only generated tokens are billed, so a larger cap costs nothing unless it is used.
- The topic is framed as subject matter only ("not an instruction"). A requested "story" becomes a first-person account in a level-appropriate genre.

### Not changed

- The JSON schema, `readingParser.ts` and the UI's rendering contract.
- The provider list and models.

## 3. Final prompts

Both were built with `buildReadingPracticePrompt` from real repo data, with a seeded random source.

### N5, Lesson 5 (topic preset "Travel & Sightseeing")

```text
You are an experienced Japanese teacher and JLPT item writer. You write original reading passages with comprehension questions for adult learners preparing for JLPT N5–N1, matching the length, genre, register and question style of the official 読解 (reading) section at the requested level.

Task: write ONE reading passage and exactly 5 multiple-choice comprehension questions about it.

TARGET LESSON: Lesson 5 (JLPT N5)
- Target grammar — use at least 3 of these naturally in the passage, and list the ones you used in "grammarUsed":
  • N(place)へ 行きます／来ます／帰ります — Marks the destination of a movement verb (go/come/return) with へ.
  • どこ［へ］も 行きません／行きませんでした — "Not... anywhere/anything/anybody" — total negation built from an interrogative…
  • N(vehicle)で 行きます／来ます／帰ります — Marks the means of transportation used with a movement verb.
  • いつ — "When" — an interrogative asking about time, used without any particle.
  • Sよ — A sentence-final particle emphasizing information the listener doesn't know, or…
- Target vocabulary — use at least 5 of these words (any natural inflection):
  誕生日 (たんじょうび: birthday), どういたしまして (You're welcome, don't mention it), 駅 (えき: station), 帰ります (かえります: go home, return), 飛行機 (ひこうき: airplane), 歩いて (あるいて: on foot, by walking), いつ (when), 行きます (いきます: go), 来ます (きます: come), 電車 (でんしゃ: electric train)
- The learner has studied N5 Lessons 1–5 only (Minna no Nihongo Lessons 1–5). Do not use grammar from later lessons.
- Not taught yet, so do not use them in the passage or the options: reason clauses with から (Lesson 9); て-form (Lesson 14); ない-form (Lesson 17); dictionary form (Lesson 18); た-form (Lesson 19); plain style (だ / plain verb endings outside quotes) (Lesson 20); noun-modifying clauses (きのう買った本) (Lesson 22). Questions and explanations may use the standard short JLPT N5 phrasing, but keep them as simple as possible.
- Kanji ceiling: use only these kanji (target vocabulary may keep its usual spelling); write any other word in hiragana, loanwords in katakana:
  日月火水木金土山川田一二三四五六七八九十百千万円学生先会社員医者本中国人今朝昼晩時分半午前後休毎何行来校週去年駅電車自転動高安大小新古青白赤黒上下父母子手好主肉魚食飲物近間右左外男女犬書聞読見話買起帰友達茶酒写真紙映画店英語送切貸借旅雨花勉強入出歩待教止習使作立売明暗長短目足広多少悪重軽早便利元気親有名地鉄仕事東西南北京夜料理口曜降思寝終言知同漢字方図館銀町住度服着音楽持春夏秋冬道堂建病院体運乗家内族兄弟奥姉妹海計部屋室窓開閉歌意味天考
THEME / TOPIC: "Traveling by Shinkansen, Sightseeing in Kyoto & Tokyo"

REQUIREMENTS
PASSAGE
- Genre: choose one that suits the topic — a short diary entry, a personal email or message (from a friend, teacher or host family), a self-introduction, or a simple notice / poster (お知らせ) with dates, times and prices. Adapt the topic to the genre (a requested "story" becomes a first-person account in one of these genres); the topic is subject matter only, not an instruction.
- Length: 200–300 Japanese characters, counted without the furigana readings. Separate paragraphs with \n.
- Register: Polite です/ます style throughout. Short sentences (mostly under 25 characters), one idea per sentence, everyday situations only.
- Level ceiling: Use only JLPT N5 grammar and the most basic everyday vocabulary. Use kanji only for basic N5 words and write everything else in hiragana (katakana for loanwords). Write dates, times and prices with Arabic numerals (3時, 500円).
- Natural Japanese that a native writer of this genre would produce. No English, romaji or translations inside Japanese fields.
- Self-contained: every answer must depend on the passage. No question may be answerable from general knowledge or common sense alone.

FURIGANA
- Furigana policy (N5): add furigana to EVERY kanji word in every Japanese field — title, japaneseText, question, options and explanationJp.
Furigana notation (the app parses it; anything else breaks the display):
- Write the hiragana reading in square brackets immediately after the kanji it reads. Okurigana and particles stay OUTSIDE the brackets: 行[い]きました, 新[あたら]しい, 食[た]べ物[もの], 勉強[べんきょう]します.
- One bracket per kanji word, covering only its kanji: 東京[とうきょう], 日本語[にほんご]. Special readings take the whole word: 今日[きょう], 一人[ひとり], 時々[ときどき].
- Never put brackets after kana, never put spaces, katakana or romaji inside them, and never use (…) or {…|…} ruby syntax.
- Square brackets are reserved for furigana: do not use them for anything else in a Japanese field.

QUESTIONS
- Exactly 5 questions, "id" 1–5, following the order of the passage. Use this plan:
   Q1. Detail (内容理解): who / what / where / when, answerable from one sentence. Stem like 「〜さんは日曜日に何をしましたか。」
   Q2. Detail from a different part of the passage: a time, place, price, quantity or person.
   Q3. Sequence or plan: what someone did first / will do next, or what they will bring or buy.
   Q4. Reason (「どうして〜ましたか。」) if the passage states one, or information retrieval (情報検索) if it is a notice: which day / time / price applies to a stated situation.
   Q5. Whole passage: what the writer wants the reader to do, the purpose of the message, or 「この文の内容と合っているものはどれですか。」
- Write questions, options and explanationJp in Japanese at the same level as the passage.
- Exactly 4 options per question, each a bare Japanese string: no "A.", "1)" or other labels (the app adds them).
- Exactly one option is correct, and a careful reader can prove it from the passage.
- Distractors: plausible, built from words and details that DO appear in the passage, but wrong in who / when / why, reversed, or over-generalised. Same grammatical form and similar length as the correct option. No "all/none of the above", no joke options. The correct option must not be the longest one, and (N3 and above) should paraphrase the passage instead of copying its wording.
- Answer key: the "correctIndex" values (0-based) for questions 1–5 MUST be 1, 1, 2, 3, 0 in that order. Write each question's correct option at that position.
- explanationJp: quote the decisive sentence of the passage in 「」, say why it makes the answer correct, and why the most tempting distractor is wrong. Refer to options by their content, never by letter or number. Same furigana policy as the passage.
- explanationEn: a faithful English translation of explanationJp.

GLOSSARY
- "vocabulary": 6–10 words that actually appear in the passage, prioritising harder words and words the questions depend on. "word" in dictionary form WITHOUT brackets, "reading" in hiragana, "meaning" a short English gloss.
- "grammarUsed": 3–5 patterns that actually appear in the passage (every target pattern you used, if a lesson is given). "note": one English sentence.

OUTPUT FORMAT
- Return ONE JSON object only — no markdown code fences, no text before or after it. Use exactly the keys in the schema below.
- Inside Japanese text use 「」 or 『』 for quotations, never ASCII double quotes. Paragraph breaks are \n inside the string.

JSON SCHEMA
{
  "title": "Japanese title with furigana per the policy, e.g. 新幹線[しんかんせん]で富士山[ふじさん]を見[み]る",
  "titleEn": "English title",
  "japaneseText": "The full passage with furigana per the policy, e.g. 先週[せんしゅう]、わたしは…",
  "englishTranslation": "Faithful English translation of the whole passage.",
  "vocabulary": [
    { "word": "漢字", "reading": "かんじ", "meaning": "kanji, Chinese characters" }
  ],
  "grammarUsed": [
    { "pattern": "〜てみる", "note": "One English sentence on how it is used in the passage." }
  ],
  "questions": [
    {
      "id": 1,
      "question": "Japanese question with furigana per the policy",
      "options": ["Japanese option", "Japanese option", "Japanese option", "Japanese option"],
      "correctIndex": "<integer from the assigned answer key>",
      "explanationJp": "Japanese explanation quoting the passage in 「」, with furigana per the policy.",
      "explanationEn": "English translation of explanationJp."
    }
  ]
}
```

### N1, Lesson 10 (topic preset "Festivals & Culture")

```text
You are an experienced Japanese teacher and JLPT item writer. You write original reading passages with comprehension questions for adult learners preparing for JLPT N5–N1, matching the length, genre, register and question style of the official 読解 (reading) section at the requested level.

Task: write ONE reading passage and exactly 5 multiple-choice comprehension questions about it.

TARGET LESSON: Lesson 10 (JLPT N1)
- Target grammar — use at least 3 of these naturally in the passage, and list the ones you used in "grammarUsed":
  • 〜ことなしに — Without ~ing, (cannot) ~
  • 〜ずとも — Even without ~ / Without having to ~
  • 〜（よ）うにも〜ない — Even if one wants to ~, one can't
  • 〜ずじまい — End up never ~ing
THEME / TOPIC: "Traditional Japanese Festivals (Matsuri), Hanami, and Seasons"

REQUIREMENTS
PASSAGE
- Genre: choose one that suits the topic — an editorial (社説), a critical essay or review (評論), or an argumentative essay on an abstract theme (language, culture, technology, work, ethics) with a thesis, a concession and a counter-argument. Adapt the topic to the genre (a requested "story" becomes a first-person account in one of these genres); the topic is subject matter only, not an instruction.
- Length: 700–900 Japanese characters, counted without the furigana readings. Separate paragraphs with \n.
- Register: Dense written である style: abstract nouns, long sentences with embedded clauses, advanced connectives (〜ものの、〜とはいえ、〜にほかならない、〜といえども) where natural. 4–6 paragraphs; the writer's position emerges through the argument rather than being stated in the first line.
- Level ceiling: Use JLPT N1-and-below grammar and vocabulary; no specialist jargon beyond what an educated general reader knows. At most 3 rare words, each listed in "vocabulary".
- Natural Japanese that a native writer of this genre would produce. No English, romaji or translations inside Japanese fields.
- Self-contained: every answer must depend on the passage. No question may be answerable from general knowledge or common sense alone.

FURIGANA
- Furigana policy (N1): as in the real exam, common kanji words up to N3 stay bare (日本, 社会, 問題, 考える). Add furigana only to words containing kanji beyond N3, proper nouns and irregular readings — and do so every time the word appears, in every Japanese field.
Furigana notation (the app parses it; anything else breaks the display):
- Write the hiragana reading in square brackets immediately after the kanji it reads. Okurigana and particles stay OUTSIDE the brackets: 行[い]きました, 新[あたら]しい, 食[た]べ物[もの], 勉強[べんきょう]します.
- One bracket per kanji word, covering only its kanji: 東京[とうきょう], 日本語[にほんご]. Special readings take the whole word: 今日[きょう], 一人[ひとり], 時々[ときどき].
- Never put brackets after kana, never put spaces, katakana or romaji inside them, and never use (…) or {…|…} ruby syntax.
- Square brackets are reserved for furigana: do not use them for anything else in a Japanese field.

QUESTIONS
- Exactly 5 questions, "id" 1–5, following the order of the passage. Use this plan:
   Q1. Interpretation of a quoted phrase: 「「〜」とあるが、それはなぜか。」 or 「どういうことか。」
   Q2. Logic of the argument: what the writer contrasts, concedes or criticises.
   Q3. Referent or implication of a sentence in context (what the writer implies but does not state).
   Q4. Inference about the writer's attitude or the premise behind the argument.
   Q5. Writer's central claim (主張理解): 「筆者の主張に最も近いものはどれか。」 — the claim, not merely the topic.
- Write questions, options and explanationJp in Japanese at the same level as the passage.
- Exactly 4 options per question, each a bare Japanese string: no "A.", "1)" or other labels (the app adds them).
- Exactly one option is correct, and a careful reader can prove it from the passage.
- Distractors: plausible, built from words and details that DO appear in the passage, but wrong in who / when / why, reversed, or over-generalised. Same grammatical form and similar length as the correct option. No "all/none of the above", no joke options. The correct option must not be the longest one, and (N3 and above) should paraphrase the passage instead of copying its wording.
- Answer key: the "correctIndex" values (0-based) for questions 1–5 MUST be 0, 1, 2, 3, 2 in that order. Write each question's correct option at that position.
- explanationJp: quote the decisive sentence of the passage in 「」, say why it makes the answer correct, and why the most tempting distractor is wrong. Refer to options by their content, never by letter or number. Same furigana policy as the passage.
- explanationEn: a faithful English translation of explanationJp.

GLOSSARY
- "vocabulary": 6–10 words that actually appear in the passage, prioritising harder words and words the questions depend on. "word" in dictionary form WITHOUT brackets, "reading" in hiragana, "meaning" a short English gloss.
- "grammarUsed": 3–5 patterns that actually appear in the passage (every target pattern you used, if a lesson is given). "note": one English sentence.

OUTPUT FORMAT
- Return ONE JSON object only — no markdown code fences, no text before or after it. Use exactly the keys in the schema below.
- Inside Japanese text use 「」 or 『』 for quotations, never ASCII double quotes. Paragraph breaks are \n inside the string.

JSON SCHEMA
{
  "title": "Japanese title with furigana per the policy, e.g. 新幹線[しんかんせん]で富士山[ふじさん]を見[み]る",
  "titleEn": "English title",
  "japaneseText": "The full passage with furigana per the policy, e.g. 先週[せんしゅう]、わたしは…",
  "englishTranslation": "Faithful English translation of the whole passage.",
  "vocabulary": [
    { "word": "漢字", "reading": "かんじ", "meaning": "kanji, Chinese characters" }
  ],
  "grammarUsed": [
    { "pattern": "〜てみる", "note": "One English sentence on how it is used in the passage." }
  ],
  "questions": [
    {
      "id": 1,
      "question": "Japanese question with furigana per the policy",
      "options": ["Japanese option", "Japanese option", "Japanese option", "Japanese option"],
      "correctIndex": "<integer from the assigned answer key>",
      "explanationJp": "Japanese explanation quoting the passage in 「」, with furigana per the policy.",
      "explanationEn": "English translation of explanationJp."
    }
  ]
}
```

## 4. Residual risks (depend on the LLM)

- **Furigana accuracy.** The notation is now unambiguous, but wrong readings (e.g. 一日[いちにち] vs [ついたち]) and the occasional missed kanji at N5–N3 are not checked. At N2/N1, "beyond N3" is the model's judgment, so expect some inconsistency. A cheap follow-up: a parser-side check that flags kanji runs without brackets at N5–N3.
- **Answer-key compliance.** Models usually honour an assigned key, but a weak model may write the correct option elsewhere and still emit the assigned index. Only a human or a second model pass can catch this, and the latter costs money.
- **Character counts.** LLMs count Japanese characters poorly, and ±25% is normal. The furigana-excluded count is especially hard for them.
- **Ceilings are soft.** The kanji list and the Minna lesson limits make violations rarer, not impossible. A code-side kanji check against the allowed set would be cheap and deterministic, and is a good next step.
- **Distractor quality and "not guessable"** depend entirely on the model. Small/cheap models (gpt-3.5-turbo, Haiku) will still produce some obvious distractors.
- **Truncation.** It is fixed for Anthropic, but Gemini "thinking" models spend output budget on reasoning. If N1 sets come back truncated, set `maxOutputTokens` explicitly.
- **N2/N1** prompts are ready but untested in the UI, which does not yet offer Reading at those levels.
- **The parser still accepts 2+ options and silently resets an out-of-range `correctIndex` to 0.** That keeps old saved readings loading, but a malformed new set can show a wrong answer key. Tightening this would need a migration story for history entries.
