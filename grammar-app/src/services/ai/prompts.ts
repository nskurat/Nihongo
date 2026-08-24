import { LevelType } from '../../types/japanese';

/**
 * Static Prompt Templates and JSON Schemas for AI Services
 */

export const READING_PRACTICE_SYSTEM_PROMPT = `You are an expert Japanese language educator specializing in JLPT N5, N4, and N3 reading comprehension.

Generate a captivating, natural Japanese reading passage and a 5-question multiple choice reading comprehension test.`;

export const READING_PRACTICE_SCHEMA_TEMPLATE = `{
  "title": "Title in Japanese with brackets, e.g. 新幹線[しんかんせん]で富士山[ふじさん]を見[み]る",
  "titleEn": "English Title",
  "japaneseText": "Full Japanese reading passage with bracketed furigana for all kanji, e.g. 先週[せんしゅう]、わたしは...",
  "englishTranslation": "Full English translation of the passage.",
  "vocabulary": [
    { "word": "漢字", "reading": "かんじ", "meaning": "English meaning" }
  ],
  "grammarUsed": [
    { "pattern": "〜てみる", "note": "Brief usage explanation" }
  ],
  "questions": [
    {
      "id": 1,
      "question": "Pure Japanese question with bracketed furigana for kanji",
      "options": [
        "Option 1 in Japanese",
        "Option 2 in Japanese",
        "Option 3 in Japanese",
        "Option 4 in Japanese"
      ],
      "correctIndex": 1,
      "explanationJp": "Japanese explanation with bracketed furigana for kanji, citing passage evidence.",
      "explanationEn": "Clear English translation explaining why this answer is correct."
    }
  ]
}`;

export const READING_PRACTICE_RULES = [
  '1. Passage Length: Around 150 words (approx. 250–350 Japanese characters).',
  '2. Furigana Notation: For all Kanji, write the reading in brackets directly after the kanji, like this: 漢字[かんじ] or 京都[きょうと]へ行[い]きました. Do not add brackets to pure Hiragana/Katakana words.',
  '3. Comprehension Questions: Exactly 5 multiple-choice questions testing reading comprehension, main idea, and specific details. Questions and options must be strictly in Japanese with NO English translations (true immersion).',
  '4. Each question must have exactly 4 options (A, B, C, D) and specify the 0-based "correctIndex" (0, 1, 2, or 3).',
  '5. Explanations: Provide a Japanese explanation with bracketed furigana in "explanationJp", and its clear English translation in "explanationEn".',
].join('\n');

/**
 * Grammar Example Sentences Prompt Template
 */
export function getGrammarExamplesPrompt({
  title,
  meaning,
  structure,
  level,
}: {
  title: string;
  meaning: string;
  structure: string;
  level: LevelType;
}) {
  return `Generate 2 new, natural Japanese example sentences for the JLPT ${level} grammar point: "${title}" (Meaning: ${meaning}). Structure: ${structure}.

CRITICAL: Return ONLY a valid JSON array of objects with "jp" and "en" keys. Do NOT include markdown code fences or conversational text.
Example format:
[
  {"jp": "...", "en": "..."},
  {"jp": "...", "en": "..."}
]`;
}

/**
 * Grammar Nuance Explanation Prompt Template
 */
export function getGrammarNuancePrompt({
  title,
  meaning,
  level,
}: {
  title: string;
  meaning: string;
  level: LevelType;
}) {
  return `Act as an expert Japanese linguist. Briefly explain subtle nuances, typical conversational contexts, and common learner traps for "${title}" (${meaning}) at ${level} level. Keep it to one clear, insightful paragraph.`;
}

/**
 * Vocabulary Usage Help Prompt Template
 */
export function getVocabHelpPrompt({
  word,
  reading,
  meaning,
  level,
}: {
  word: string;
  reading: string;
  meaning: string;
  level: LevelType;
}) {
  return `Explain practical usage, common collocations, or register nuances for the Japanese word "${word}" (${reading}, meaning: "${meaning}") for a JLPT ${level} learner. Keep it to 1-2 concise sentences with 1 extra natural sample sentence.`;
}

/**
 * Kanji Mnemonic Story Prompt Template
 */
export function getKanjiMnemonicPrompt({
  kanji,
  meaning,
  radical,
  readings,
  level,
}: {
  kanji: string;
  meaning: string;
  radical?: string;
  readings: string;
  level: LevelType;
}) {
  return `Create a vivid, easy-to-remember mnemonic story or visual breakdown for the JLPT ${level} Kanji "${kanji}" (Meaning: "${meaning}", ${readings}). Radical: "${radical || 'none'}". Keep the mnemonic hook to 2-3 engaging, memorable sentences.`;
}
