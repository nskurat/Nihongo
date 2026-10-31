# AI study-item prompts: teacher review

Scope: every AI button except Reading Practice (already reviewed in
`docs/reading-prompt-review.md`, whose conventions this review reuses):

| Button | Where | Prompt | Sent / parsed by | Rendered by |
|---|---|---|---|---|
| AI: More Examples | grammar card (`GrammarSection.tsx`) | `getGrammarExamplesPrompt` | `generateGrammarExamples` → `parseGrammarExamples` | plain text `{ex.jp}` / `{ex.en}` |
| AI: Explain Nuances | grammar card, and "Ask AI: Explain Nuance & Give Practice Sentences" in `GrammarDetailModal.tsx` | `getGrammarNuancePrompt` | `generateGrammarNuance` → `cleanMarkdownNote` | `MarkdownViewer` |
| AI: Explain Usage | vocab card (`VocabSection.tsx`) | `getVocabHelpPrompt` | `generateVocabHelp` → `cleanMarkdownNote` | `MarkdownViewer` |
| AI: Create Mnemonic Story | kanji card (`KanjiSection.tsx`) | `getKanjiMnemonicPrompt` | `generateKanjiMnemonic` → `cleanMarkdownNote` | `MarkdownViewer` |

Prompts live in `grammar-app/src/services/ai/prompts.ts`. The new
`services/ai/studyItems.ts` turns a data row into a prompt (`*PromptFor`) and cleans
the reply. `registry.ts` only sends. I judged the prompts by building them from real
rows (N5 L5 `n5-grammar-5-3`, N1 L3 `n1-grammar-3-2`, `n5-vocab-5-3`, `n3-vocab-8-3`,
`n1-vocab-5-1`, `n5-kanji-4-7`, `n3-kanji-3-1`, `n1-kanji-5-1`) with a small tsx script.
**No AI provider was called.**

## 0. Findings that apply to all four prompts

| # | Issue | Evidence |
|---|---|---|
| G1 | **Furigana mismatch with the UI.** None of these outputs goes through `FuriganaText`. Grammar examples are rendered as plain text, and the notes go through `MarkdownViewer` (marked + DOMPurify), which has no ruby support. A model that has picked up the Reading convention (`漢字[かんじ]`) shows raw brackets, and `[text](...)` can even turn into a link. Nothing in the old prompts said how to give readings, so models did it inconsistently: romaji, `(かんじ)`, brackets or nothing. | `MarkdownViewer.tsx`, `GrammarSection.tsx:279` |
| G2 | **The level was a label, not a ceiling.** "for a JLPT N5 learner" with no grammar or kanji limit. An N5 Lesson 5 item (before て-form, Minna L14) got examples like 「電車に乗って学校へ行きます」. N5 notes used kanji the learner cannot read. | old prompts |
| G3 | **The data's context was thrown away.** Only title, meaning and structure (grammar), or word, reading and meaning (vocab/kanji) were sent. Tags, lesson, existing examples, part of speech, compounds, strokes and the usage notes in brackets were all ignored, although they cost a few tokens and steer the output strongly. | `registry.ts` |
| G4 | **No output contract for the Markdown notes**, so length and structure varied by model, often with a "Sure! Here's…" preamble or headings that are too large for a small card. | old prompts |

Shared decisions:

- **English instructions, Japanese exemplars**, as in the reading review: better rule-following on the cheaper default models (Flash, gpt-4o-mini) and roughly half the input tokens of Japanese instructions. Japanese appears only where it shapes the output: patterns, the ✗ → ✓ format, sample collocations and readings.
- **Level ceiling per level** (`STUDY_LEVEL_RULES` + `learnerScope()` in `prompts.ts`), taken from the item's level and lesson. For N5/N4 the lesson follows Minna no Nihongo order, so N5 prompts list the forms not taught yet (`N5_FORM_MILESTONES`, now shared with the reading builder) and N4 Lesson n = Minna 25 + n. Kanji ceiling: N5/N4 write only basic words in kanji and the rest in hiragana. N3+ get a verbal ceiling. Kanji lessons are not in Minna order, so kanji prompts use the level only.
- **Furigana convention for these outputs.** Grammar example `jp` is plain Japanese with **no readings at all**, the same as the data's own examples. In Markdown notes, a Japanese word or phrase quoted in the English text gets its reading in **full-width parentheses**: `道に迷う（みちにまよう）`. That is every kanji word at N5–N3 and only words beyond N3 at N2/N1, mirroring the reading policy. Full example sentences carry no readings. Square brackets are banned. As a safety net, `cleanMarkdownNote` converts any stray `漢字[かんじ]` into `漢字（かんじ）`, and `parseGrammarExamples` strips bracket furigana.
- **Explicit Markdown contract**: fixed bold labels, a blank line between parts (marked would otherwise merge them into one paragraph), no headings, tables, preamble or closing, and a word cap (examples 3 × ≤25–65 chars; nuance ≤160 words; usage ≤110; mnemonic ≤100).
- **Cost.** Prompts grew from about 300 characters to 1.6–2.6k characters (about 500–800 input tokens), which is still a fraction of a cent on every listed model. Output, the billed part that matters, is now capped explicitly and is shorter or the same as before.

## 1. AI: More Examples (`getGrammarExamplesPrompt`)

### Old prompt

```text
Generate 2 new, natural Japanese example sentences for the JLPT ${level} grammar point: "${title}" (Meaning: ${meaning}). Structure: ${structure}.

CRITICAL: Return ONLY a valid JSON array of objects with "jp" and "en" keys. Do NOT include markdown code fences or conversational text.
Example format:
[
  {"jp": "...", "en": "..."},
  {"jp": "...", "en": "..."}
]
```

### Issues

- **E1 Repeats.** The button appends (`addExamples`), and the prompt knew neither the 2–3 examples already on the card nor earlier AI ones. The model's single most likely sentence (「電車で行きます。」 for `n5-grammar-5-3`) came back, often word for word as the data's own example.
- **E2 No ceiling or lesson scope** (G2). An N5 L5 learner got て-form and plain-form sentences.
- **E3 No variety rule.** Two sentences in the same frame ("I … every day") that do not show how far the pattern reaches (negative/past, the different word classes it attaches to).
- **E4 Register blind.** N1 written patterns (〜といえども, 〜ならいざしらず) were put into casual chat, and casual ones (〜ではあるまいし, tagged `colloquial`) into formal prose. The tags that say this were not sent.
- **E5 JSON contract clash.** OpenAI is called with `response_format: json_object`, which **only returns objects**, but the prompt asked for a bare array. It worked only because the registry also accepted `{examples: [...]}`, and the key name was left to chance.
- **E6 Brittle parsing.** A bare `JSON.parse` meant prose around the JSON threw a raw `SyntaxError` into the error banner. Rows with a missing `en` or with romaji were stored and rendered. Bracket furigana showed up raw (G1).
- **E7 Long meanings.** N4 meanings run to 500 characters and were pasted whole.

### Decision

- Send the item's lesson, function **tag labels**, structure (only when it differs from the title) and the **first sentence** of the meaning (≤160 chars).
- Send the **sentences already shown** (data examples plus earlier AI presses, newest 8) with "do not repeat or lightly reword". `useGrammar` now passes `previous: generatedExamples[uid]`.
- **3 sentences** per press. The cost is negligible and it gives the variety rule room: different situations and subjects, and different forms where the structure allows.
- Style per level, plus "use the register the pattern lives in" at N2/N1. The sentence cap rises from 25 characters (N5) to 65 (N1).
- **Contract `{"examples":[{"jp","en"}]}`**, which works in every provider's JSON mode. The new `parseGrammarExamples` in `studyItems.ts`:
  - accepts the object or a legacy bare array, strips fences and surrounding prose;
  - drops malformed rows, rows without kana or kanji (romaji) and rows without English;
  - strips bracket furigana and removes duplicates of already-shown sentences (ignoring punctuation and spaces);
  - caps the count at 3 and throws a friendly "could not be read" error for non-JSON.

### New prompt — N5 (n5-grammar-5-3, Lesson 5)

```text
You are an experienced Japanese teacher writing example sentences for an adult learner preparing for JLPT N5.

GRAMMAR POINT (JLPT N5, Lesson 5)
- Pattern: N(vehicle)で 行きます／来ます／帰ります
- Meaning: Marks the means of transportation used with a movement verb.
- Function: Particle Usage; Direction / Movement
- Already shown to the learner (do not repeat or lightly reword these):
  • 電車で行きます。
  • タクシーで来ました。
  • 駅から歩いて帰りました。

TASK: write 3 new example sentences that use this grammar point.
- Every sentence uses the target pattern as the structure describes, in a situation where a native speaker would really choose it — not a neutral frame with the pattern dropped in.
- Vary them: different situations (e.g. home, work or school, shopping, travel, news) and different subjects; where the structure allows, vary the form too (affirmative / negative, past / non-past, the different word classes it attaches to).
- Style: Polite です/ます style. Do not put a stiff written pattern into casual chat, or a casual one into a formal notice.
- Level ceiling (JLPT N5): Use only N5 grammar and the most basic everyday words. Write kanji only for basic N5 words (日本, 学校, 先生, 行きます, 食べます); write every other word in hiragana, loanwords in katakana.
- The learner has studied N5 Lessons 1–5 only (Minna no Nihongo order).
- Not taught yet, so never use them in Japanese sentences: reason clauses with から (Lesson 9); て-form (Lesson 14); ない-form (Lesson 17); dictionary form (Lesson 18); た-form (Lesson 19); plain style (だ / plain verb endings outside quotes) (Lesson 20); noun-modifying clauses (きのう買った本) (Lesson 22).
- One sentence each, at most 25 Japanese characters.
- "jp" is plain Japanese only: no furigana or readings in [] or （）, no romaji, no English, no Markdown, no numbering. Use 「」 for quotations, never ASCII double quotes.
- "en": a natural English translation that makes the meaning of the pattern visible.

OUTPUT: one JSON object only — no code fences, no other text:
{"examples":[{"jp":"…","en":"…"},{"jp":"…","en":"…"},{"jp":"…","en":"…"}]}
```

### New prompt — N1 (n1-grammar-3-2)

```text
You are an experienced Japanese teacher writing example sentences for an adult learner preparing for JLPT N1.

GRAMMAR POINT (JLPT N1, Lesson 3)
- Pattern: 〜ないまでも
- Structure: Verb (ない-form) + までも
- Meaning: Even if not ~, at least ~
- Function: Concession / Contrast; Degree / Extent
- Already shown to the learner (do not repeat or lightly reword these):
  • 毎日とは言わないまでも、週に一度は運動したほうがいい。
  • 優勝できないまでも、決勝には進みたい。

TASK: write 3 new example sentences that use this grammar point.
- Every sentence uses the target pattern as the structure describes, in a situation where a native speaker would really choose it — not a neutral frame with the pattern dropped in.
- Vary them: different situations (e.g. home, work or school, shopping, travel, news) and different subjects; where the structure allows, vary the form too (affirmative / negative, past / non-past, the different word classes it attaches to).
- Style: The register the pattern really lives in (written, formal or conversational). Do not put a stiff written pattern into casual chat, or a casual one into a formal notice.
- Level ceiling (JLPT N1): Use grammar and vocabulary at N1 or below; no specialist jargon beyond what an educated reader knows.
- One sentence each, at most 65 Japanese characters.
- "jp" is plain Japanese only: no furigana or readings in [] or （）, no romaji, no English, no Markdown, no numbering. Use 「」 for quotations, never ASCII double quotes.
- "en": a natural English translation that makes the meaning of the pattern visible.

OUTPUT: one JSON object only — no code fences, no other text:
{"examples":[{"jp":"…","en":"…"},{"jp":"…","en":"…"},{"jp":"…","en":"…"}]}
```

## 2. AI: Explain Nuances (`getGrammarNuancePrompt`)

### Old prompt

```text
Act as an expert Japanese linguist. Briefly explain subtle nuances, typical conversational contexts, and common learner traps for "${title}" (${meaning}) at ${level} level. Keep it to one clear, insightful paragraph.
```

### Issues

- **N1 No contrast.** Nuance is learned by contrast, but the prompt never asked for a comparison. The output was a paraphrase of the meaning the card already shows.
- **N2 "Conversational contexts" is wrong for half of N1/N2.** Many of those patterns are written-only (`formal-written` tag), and the prompt pushed the model to invent conversational uses.
- **N3 No examples, no structure.** One paragraph with no minimal pair and no ✗ → ✓, which is the most useful form for a learner. The modal button promises "Explain Nuance & Give Practice Sentences", and the prompt delivered no sentences.
- **N4 Comparisons could jump levels.** Nothing stopped an N5 note from contrasting で with 〜によって.
- **N5 "Expert linguist" persona** invites terminology (aspect, modality, evidentiality) instead of teaching. Missing context (G3) and no Markdown contract (G4).

### Decision

- The persona becomes a teacher who knows the card is already visible ("do not restate").
- Three fixed parts:
  - **Nuance**: attitude, written vs spoken, formality, what can follow.
  - **Compared with**: the 1–2 patterns a learner at this level most confuses it with, **from this level or lower**, each with a one-line difference and a **minimal pair**.
  - **Common mistake**: ✗ → ✓ with a reason.
- **Confusable candidates from the data.** `relatedGrammarTitles()` sends the same-lesson patterns that share a function tag (lessons group confusables), up to 4, for example へ / と for `n5-grammar-5-3`. The model is told to use them only "when they really are confusable". `useGrammar` passes `lessonItems: currentContent`.
- One data example anchors the intended sense. Add "usually" for tendencies and "do not invent restrictions".
- Lesson scope applies, so N5 minimal pairs stay inside the learner's lessons.

### New prompt — N5 (n5-grammar-5-3)

```text
You are an experienced Japanese teacher. Write a short nuance note on one grammar point for an adult learner preparing for JLPT N5. The learner already sees the meaning, structure and examples on the card, so do not restate them.

GRAMMAR POINT (JLPT N5, Lesson 5)
- Pattern: N(vehicle)で 行きます／来ます／帰ります
- Meaning: Marks the means of transportation used with a movement verb.
- Function: Particle Usage; Direction / Movement
- Example from the lesson: 電車で行きます。
- Patterns from the same lesson with a similar function: N(place)へ 行きます／来ます／帰ります, N(person/animal)と V

WRITE exactly these three parts:
**Nuance:** 1–2 sentences on what the pattern adds beyond its English gloss — speaker attitude, written vs spoken, formality, and what typically follows or cannot follow it.
**Compared with:** the 1–2 patterns a JLPT N5 learner most often confuses it with, taken from N5 or lower levels (prefer the same-lesson patterns above when they really are confusable). For each, one bullet: the difference in one line, then a minimal pair — the same sentence with each pattern — and what changes in meaning or naturalness.
**Common mistake:** one typical learner error as ✗ wrong sentence → ✓ corrected sentence, with a one-line reason.

ACCURACY AND LEVEL
- Describe real usage only. If a difference is a tendency rather than a rule, say "usually". Do not invent restrictions.
- Level ceiling (JLPT N5): Use only N5 grammar and the most basic everyday words. Write kanji only for basic N5 words (日本, 学校, 先生, 行きます, 食べます); write every other word in hiragana, loanwords in katakana.
- The learner has studied N5 Lessons 1–5 only (Minna no Nihongo order).
- Not taught yet, so never use them in Japanese sentences: reason clauses with から (Lesson 9); て-form (Lesson 14); ない-form (Lesson 17); dictionary form (Lesson 18); た-form (Lesson 19); plain style (だ / plain verb endings outside quotes) (Lesson 20); noun-modifying clauses (きのう買った本) (Lesson 22).

FORMAT (rendered as Markdown)
- Explanations in English. Japanese only for patterns, words and example sentences; Japanese sentences at JLPT N5 level or below.
- Readings: when you quote a Japanese word or phrase in the English text, put its hiragana reading in full-width parentheses right after it — every Japanese word or phrase with kanji: 道に迷う（みちにまよう）. Full example sentences carry no readings. Never use square brackets.
- Start each bold label on a new line with a blank line between parts. No romaji. Use only the bold labels shown: no headings, tables, preamble ("Sure!") or closing remarks.
- At most 160 words in total.
```

### New prompt — N1 (n1-grammar-3-2)

```text
You are an experienced Japanese teacher. Write a short nuance note on one grammar point for an adult learner preparing for JLPT N1. The learner already sees the meaning, structure and examples on the card, so do not restate them.

GRAMMAR POINT (JLPT N1, Lesson 3)
- Pattern: 〜ないまでも
- Structure: Verb (ない-form) + までも
- Meaning: Even if not ~, at least ~
- Function: Concession / Contrast; Degree / Extent
- Example from the lesson: 毎日とは言わないまでも、週に一度は運動したほうがいい。
- Patterns from the same lesson with a similar function: 〜ならいざしらず

WRITE exactly these three parts:
**Nuance:** 1–2 sentences on what the pattern adds beyond its English gloss — speaker attitude, written vs spoken, formality, and what typically follows or cannot follow it.
**Compared with:** the 1–2 patterns a JLPT N1 learner most often confuses it with, taken from N1 or lower levels (prefer the same-lesson patterns above when they really are confusable). For each, one bullet: the difference in one line, then a minimal pair — the same sentence with each pattern — and what changes in meaning or naturalness.
**Common mistake:** one typical learner error as ✗ wrong sentence → ✓ corrected sentence, with a one-line reason.

ACCURACY AND LEVEL
- Describe real usage only. If a difference is a tendency rather than a rule, say "usually". Do not invent restrictions.
- Level ceiling (JLPT N1): Use grammar and vocabulary at N1 or below; no specialist jargon beyond what an educated reader knows.

FORMAT (rendered as Markdown)
- Explanations in English. Japanese only for patterns, words and example sentences; Japanese sentences at JLPT N1 level or below.
- Readings: when you quote a Japanese word or phrase in the English text, put its hiragana reading in full-width parentheses right after it — words with kanji beyond N3 only: 道に迷う（みちにまよう）. Full example sentences carry no readings. Never use square brackets.
- Start each bold label on a new line with a blank line between parts. No romaji. Use only the bold labels shown: no headings, tables, preamble ("Sure!") or closing remarks.
- At most 160 words in total.
```

## 3. AI: Explain Usage (`getVocabHelpPrompt`)

### Old prompt

```text
Explain practical usage, common collocations, or register nuances for the Japanese word "${word}" (${reading}, meaning: "${meaning}") for a JLPT ${level} learner. Keep it to 1-2 concise sentences with 1 extra natural sample sentence.
```

### Issues

- **V1 "or"** let the model pick just one of usage, collocations or register. Collocations, the most useful part for production, were often skipped.
- **V2 No common-mistake slot.** The classic traps are particle choice (に会う, not を会う), transitive/intransitive pairs (開く/開ける) and senses the English gloss suggests but Japanese lacks (取る ≠ every "take"). None were asked for.
- **V3 Bracket notes pasted verbatim.** About 17% of N3 rows look like `取る [ノートを〜]` or `[お]花見`, and the model saw `"取る [ノートを〜]"` as the word. N5 headwords in ます-form (`帰ります`) were not explained.
- **V4 The sample sentence could duplicate the card's `exampleJp`**, and it ignored the level and lesson (an N5 L5 word got a て-form sentence).
- **V5** Part of speech was not sent, and there was no Markdown or furigana contract (G1, G4).

### Decision

- Fixed parts: **Usage** (situations, register, how it differs from a near-synonym the learner knows), **Collocations** (2–3, with particle and gloss, readings in （）), **Watch out** (one real ✗ → ✓, omitted if there is none) and **Example** (one new sentence plus a translation).
- `splitVocabHeadword()` moves 〜-collocation notes into a "Typical use" hint. Optional parts stay in full-width parentheses (`（お）花見`, `平凡（な）`). Brackets in meanings become parentheses.
- Send part of speech, the lesson, and the card's example with "do not reuse it". At N5, a ます-form headword is flagged as such. Same level and lesson scope as grammar.

### New prompt — N5 (n5-vocab-5-3 帰ります, Lesson 5)

```text
You are an experienced Japanese teacher. Write a short usage note on one word for an adult learner preparing for JLPT N5. The card already shows the word, its reading and English meaning, so do not restate them.

WORD (JLPT N5, Lesson 5)
- Word: 帰ります（かえります）
- Meaning: go home, return
- Part of speech: Verb (Group I)
- The headword is listed in ます-form, as N5 textbooks do; treat it as that verb.
- Example already on the card (do not reuse it): うちへ帰ります。

WRITE these parts (leave out "Watch out" if there is no real, common pitfall):
**Usage:** 1–2 sentences — the situations it is used in, its register (casual, polite, written) and, if one exists, how it differs from a near-synonym the learner is likely to know (name it).
**Collocations:** 2–3 frequent combinations with their particle, each with a short English gloss, e.g. 道に迷う（みちにまよう）— get lost.
**Watch out:** one common learner mistake — wrong particle, transitive/intransitive partner, a sense the English gloss suggests but the Japanese word does not have — as ✗ → ✓.
**Example:** one new natural sentence using the word, then its English translation on the next line.

LEVEL
- Level ceiling (JLPT N5): Use only N5 grammar and the most basic everyday words. Write kanji only for basic N5 words (日本, 学校, 先生, 行きます, 食べます); write every other word in hiragana, loanwords in katakana.
- The learner has studied N5 Lessons 1–5 only (Minna no Nihongo order).
- Not taught yet, so never use them in Japanese sentences: reason clauses with から (Lesson 9); て-form (Lesson 14); ない-form (Lesson 17); dictionary form (Lesson 18); た-form (Lesson 19); plain style (だ / plain verb endings outside quotes) (Lesson 20); noun-modifying clauses (きのう買った本) (Lesson 22).

FORMAT (rendered as Markdown)
- Explanations in English. Japanese only for patterns, words and example sentences; Japanese sentences at JLPT N5 level or below.
- Readings: when you quote a Japanese word or phrase in the English text, put its hiragana reading in full-width parentheses right after it — every Japanese word or phrase with kanji: 道に迷う（みちにまよう）. Full example sentences carry no readings. Never use square brackets.
- Start each bold label on a new line with a blank line between parts. No romaji. Use only the bold labels shown: no headings, tables, preamble ("Sure!") or closing remarks.
- At most 110 words in total.
```

### New prompt — N1 (n1-vocab-5-1 獲物)

```text
You are an experienced Japanese teacher. Write a short usage note on one word for an adult learner preparing for JLPT N1. The card already shows the word, its reading and English meaning, so do not restate them.

WORD (JLPT N1, Lesson 5)
- Word: 獲物（えもの）
- Meaning: game, spoils, trophy

WRITE these parts (leave out "Watch out" if there is no real, common pitfall):
**Usage:** 1–2 sentences — the situations it is used in, its register (casual, polite, written) and, if one exists, how it differs from a near-synonym the learner is likely to know (name it).
**Collocations:** 2–3 frequent combinations with their particle, each with a short English gloss, e.g. 道に迷う（みちにまよう）— get lost.
**Watch out:** one common learner mistake — wrong particle, transitive/intransitive partner, a sense the English gloss suggests but the Japanese word does not have — as ✗ → ✓.
**Example:** one new natural sentence using the word, then its English translation on the next line.

LEVEL
- Level ceiling (JLPT N1): Use grammar and vocabulary at N1 or below; no specialist jargon beyond what an educated reader knows.

FORMAT (rendered as Markdown)
- Explanations in English. Japanese only for patterns, words and example sentences; Japanese sentences at JLPT N1 level or below.
- Readings: when you quote a Japanese word or phrase in the English text, put its hiragana reading in full-width parentheses right after it — words with kanji beyond N3 only: 道に迷う（みちにまよう）. Full example sentences carry no readings. Never use square brackets.
- Start each bold label on a new line with a blank line between parts. No romaji. Use only the bold labels shown: no headings, tables, preamble ("Sure!") or closing remarks.
- At most 110 words in total.
```

(An N3 row with a bracket note, `取る [ノートを〜]`, is sent as `Word: 取る（とる）` + `Typical use: ノートを〜`; see the tests.)

## 4. AI: Create Mnemonic Story (`getKanjiMnemonicPrompt`)

### Old prompt

```text
Create a vivid, easy-to-remember mnemonic story or visual breakdown for the JLPT ${level} Kanji "${kanji}" (Meaning: "${meaning}", ${readings}). Radical: "${radical || 'none'}". Keep the mnemonic hook to 2-3 engaging, memorable sentences.
```

### Issues

- **K1 False etymology.** Without a rule, models say "this kanji originally depicted…" for kanji whose real history is different or disputed. Learners then repeat it as fact.
- **K2 Invented components.** Models split a kanji into characters it does not contain (e.g. reading 盤's 舟 as 月). The prompt never said to use only real, visible parts.
- **K3 Readings unused.** The prompt listed readings but did not ask for a reading hook. The meaning stuck while the reading, which is what the JLPT tests, did not. The data's compounds (`休み`, `昼休み`, `基盤`…), the natural hooks, were not sent.
- **K4 No look-alike contrast.** 待/持/特 and 未/末 are classic confusions, and a mnemonic is the right place to separate them.
- **K5 Inconsistent reading separators** across levels (`やす.む` at N5, `かな・しい` at N3) went in unexplained, and `Radical: "none"` was printed when the radical was missing. No Markdown or furigana contract (G1, G4).

### Decision

- Fixed parts:
  - **Parts**: real components only, starting with the given radical; describe a shape rather than naming a character that is not there.
  - **Story**: 2–3 sentences linking the parts to the meaning.
  - **Reading hook**: one sentence tying the most useful reading to a data compound, using **listed readings only**, with English sound-alikes allowed if labelled.
  - **Don't confuse**: one look-alike and the distinguishing part, omitted if there is none.
- An explicit **ACCURACY** block: "This is a memory aid, not history", no claims about what the kanji originally depicted except for well-known pictographs (山, 日, 木, 人), and no invented readings.
- `formatKanjiReadings()` unifies okurigana separators to `.` and the prompt explains them. Up to 4 data compounds are sent with their readings (affix rows like `〜時` and notes like `[な]` are dropped), plus the stroke count. The radical line is omitted when the data has none.

### New prompt — N5 (n5-kanji-4-7 休)

```text
You are an experienced Japanese teacher. Write a mnemonic for one kanji for an adult learner preparing for JLPT N5.

KANJI (JLPT N5): 休
- Meaning: to take a break, rest, day off
- Readings: On: キュウ | Kun: やす.む (a dot separates the kanji from its okurigana; "-" marks a prefix or suffix)
- Radical: 人 (person)
- Strokes: 6
- Words with this kanji the learner meets: 休み（やすみ）break, rest, day off; 昼休み（ひるやすみ）lunch time, lunch break; 春休み（はるやすみ）spring vacation; 夏休み（なつやすみ）summer vacation

WRITE these parts (leave out "Don't confuse" if there is no common look-alike):
**Parts:** the components you can actually see in 休, starting with the radical given above. Name only real components; if a part is not a standard component, describe its shape ("a roof on top") instead of naming a character it is not.
**Story:** 2–3 vivid sentences that link those parts to the meaning "to take a break, rest, day off".
**Reading hook:** one sentence that ties the most useful reading to one of the words above (or another common word at this level), e.g. 時間（じかん）. Use only the readings listed. An English sound-alike is fine if marked as a sound hook.
**Don't confuse:** one common look-alike kanji and the part that tells them apart, e.g. 待 vs 持: 彳 "going" vs 扌 "hand".

ACCURACY
- This is a memory aid, not history. Do not claim what the kanji "originally" depicted or meant, or how it evolved, unless it is a well-known pictograph (山, 日, 木, 人), and never present the story itself as its origin.
- Do not invent readings or meanings; use the ones listed.

FORMAT (rendered as Markdown)
- Explanations in English. Japanese only for patterns, words and example sentences; Japanese sentences at JLPT N5 level or below.
- Readings: when you quote a Japanese word or phrase in the English text, put its hiragana reading in full-width parentheses right after it — every Japanese word or phrase with kanji: 道に迷う（みちにまよう）. Full example sentences carry no readings. Never use square brackets.
- Start each bold label on a new line with a blank line between parts. No romaji. Use only the bold labels shown: no headings, tables, preamble ("Sure!") or closing remarks.
- At most 100 words in total.
```

### New prompt — N1 (n1-kanji-5-1 盤)

```text
You are an experienced Japanese teacher. Write a mnemonic for one kanji for an adult learner preparing for JLPT N1.

KANJI (JLPT N1): 盤
- Meaning: tray, shallow bowl, platter, tub
- Readings: On: バン (a dot separates the kanji from its okurigana; "-" marks a prefix or suffix)
- Radical: 皿 (dish)
- Strokes: 15
- Words with this kanji the learner meets: 碁盤（ごばん）Go board; 基盤（きばん）foundation, basis; 地盤（じばん）(the) ground; 算盤（そろばん）abacus

WRITE these parts (leave out "Don't confuse" if there is no common look-alike):
**Parts:** the components you can actually see in 盤, starting with the radical given above. Name only real components; if a part is not a standard component, describe its shape ("a roof on top") instead of naming a character it is not.
**Story:** 2–3 vivid sentences that link those parts to the meaning "tray, shallow bowl, platter, tub".
**Reading hook:** one sentence that ties the most useful reading to one of the words above (or another common word at this level), e.g. 時間（じかん）. Use only the readings listed. An English sound-alike is fine if marked as a sound hook.
**Don't confuse:** one common look-alike kanji and the part that tells them apart, e.g. 待 vs 持: 彳 "going" vs 扌 "hand".

ACCURACY
- This is a memory aid, not history. Do not claim what the kanji "originally" depicted or meant, or how it evolved, unless it is a well-known pictograph (山, 日, 木, 人), and never present the story itself as its origin.
- Do not invent readings or meanings; use the ones listed.

FORMAT (rendered as Markdown)
- Explanations in English. Japanese only for patterns, words and example sentences; Japanese sentences at JLPT N1 level or below.
- Readings: when you quote a Japanese word or phrase in the English text, put its hiragana reading in full-width parentheses right after it — words with kanji beyond N3 only: 道に迷う（みちにまよう）. Full example sentences carry no readings. Never use square brackets.
- Start each bold label on a new line with a blank line between parts. No romaji. Use only the bold labels shown: no headings, tables, preamble ("Sure!") or closing remarks.
- At most 100 words in total.
```

## 5. Code changes

- `prompts.ts`: rewrote the four study-item prompts. Added `STUDY_LEVEL_RULES`, `learnerScope()` and `GRAMMAR_EXAMPLE_COUNT`, and moved `N5_FORM_MILESTONES` and `firstClause` here from `promptBuilder.ts` so both prompt families share them. The reading prompt is unchanged.
- `studyItems.ts` (new, pure):
  - `grammarExamplesPromptFor`, `grammarNuancePromptFor`, `vocabHelpPromptFor` and `kanjiMnemonicPromptFor` build a prompt from a data row;
  - `relatedGrammarTitles`, `splitVocabHeadword` and `formatKanjiReadings` prepare the context;
  - `parseGrammarExamples` and `cleanMarkdownNote` clean the reply.
- `registry.ts`: the `generate*` functions keep their names and return types. Two parameters were added, both optional: `previous` on `generateGrammarExamples` and `lessonItems` on `generateGrammarNuance`. `GrammarExampleSentence` is re-exported (the store imports it from here).
- `features/grammar/useGrammar.ts`: passes `previous` and `lessonItems`. No UI change.
- Tests: `services/ai/__tests__/studyItemPrompts.test.ts` (28 tests). It covers:
  - the key rules per prompt at N5 and N1 (plus N3/N4 cases), all built from real rows;
  - a smoke test that every level builds prompts without `undefined`;
  - the parser and note cleaner;
  - registry wiring with `fetch` stubbed (no provider reached).

## 6. Suggested UI follow-ups (not done here)

- The modal button "Ask AI: Explain Nuance & Give Practice Sentences" now gets minimal pairs and a ✗ → ✓ pair, but no free practice sentences. Rename it to "Ask AI: Explain Nuance & Compare", or keep it as is, since the minimal pairs are sentences.
- The grammar card disables "Explain Nuances" after one answer, while the modal offers "Regenerate". That inconsistency is harmless but worth aligning.
- If readings in example cards become desirable, render `ex.jp` with `FuriganaText` and switch the examples contract to bracket notation (with the reading prompt's `FURIGANA_NOTATION_RULES`). Today the data's own examples have no furigana, so the AI ones match them.
- The cached notes from the old prompts stay in `ai-generation-cache`. They are still valid text, just in the old style, so no migration is needed.

## 7. Residual risks (depend on the model)

- **Level drift.** Ceilings are instructions, not checks. Expect occasional N4 words in N5 examples, or a て-form in an early-N5 note, especially from cheap models. A code-side kanji check against the N5/N4 kanji lists (as suggested for Reading) would catch most of it deterministically.
- **Confusable choice and accuracy.** "Compared with" and "Watch out" are only as good as the model's grasp of Japanese. Small models may invent a distinction or a "mistake" learners do not make. "Usually" and "do not invent restrictions" reduce this but do not remove it.
- **Mnemonic components.** Models still misidentify parts of less common N2/N1 kanji. Only the radical is given from data. Adding a component decomposition (e.g. from KRADFILE) to the kanji data would remove most of this risk.
- **Etymology leaks.** The rule is explicit, but some models still slip in "originally…". The "memory aid" framing at least sets the learner's expectation.
- **Readings in （）.** Models may over- or under-annotate, and the N2/N1 "beyond N3" judgment is the model's. Wrong readings are not checked.
- **Word and character caps** are approximate. LLMs count Japanese characters poorly (±25%).
- **Dedup is exact-match.** It ignores punctuation and spaces only, so a lightly reworded repeat still gets through. The prompt asks the model not to do that.
