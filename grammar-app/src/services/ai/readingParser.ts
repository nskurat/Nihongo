import { FuriganaToken } from '../../types/japanese';
import { ReadingPracticeData, ReadingQuestion } from '../../types/ai';

/**
 * Parse bracketed furigana syntax (e.g. 漢字[かんじ] or [漢字](かんじ)) into tokens.
 * Tokens are either { type: 'text', content: '...' } or { type: 'ruby', base: '...', ruby: '...' }
 */
export function parseFuriganaTokens(text = ''): FuriganaToken[] {
  if (!text) return [];

  // Match Kanji/Base followed by [furigana] or {base|ruby} or [base](ruby)
  // Standard format: 漢字[かんじ]
  const regex = /([\u4E00-\u9FAF\u3400-\u4DBF々ヶ]+)\[([^\s\]]+)\]|\[([\u4E00-\u9FAF\u3400-\u4DBF々ヶ\w\s]+)\]\(([^)]+)\)|\{([^|]+)\|([^}]+)\}/g;

  const tokens: FuriganaToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Leading plain text
    if (match.index > lastIndex) {
      tokens.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      });
    }

    if (match[1] && match[2]) {
      // 漢字[かんじ]
      tokens.push({ type: 'ruby', base: match[1], ruby: match[2] });
    } else if (match[3] && match[4]) {
      // [漢字](かんじ)
      tokens.push({ type: 'ruby', base: match[3], ruby: match[4] });
    } else if (match[5] && match[6]) {
      // {漢字|かんじ}
      tokens.push({ type: 'ruby', base: match[5], ruby: match[6] });
    }

    lastIndex = regex.lastIndex;
  }

  // Trailing plain text
  if (lastIndex < text.length) {
    tokens.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return tokens;
}

/**
 * Strips bracketed furigana annotations to return clean Japanese text.
 * E.g. 朝[あさ]の習慣[しゅうかん] -> 朝の習慣
 */
export function stripFurigana(text = ''): string {
  if (!text) return '';
  return text
    .replace(/([\u4E00-\u9FAF\u3400-\u4DBF々ヶ]+)\[([^\s\]]+)\]/g, '$1')
    .replace(/\[([\u4E00-\u9FAF\u3400-\u4DBF々ヶ\w\s]+)\]\(([^)]+)\)/g, '$1')
    .replace(/\{([^|]+)\|([^}]+)\}/g, '$1');
}

/**
 * Clean and extract JSON string from raw LLM output.
 * Handles code fences (```json ... ```), preambles, and trailing commas.
 */
export function cleanJsonString(rawText: string = ''): string {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Empty or invalid response from AI model');
  }

  let text = rawText.trim();

  // Strip markdown code fences if present
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    text = codeBlockMatch[1].trim();
  }

  // Find outermost JSON object { ... }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }

  // Remove illegal trailing commas before closing braces/brackets (common LLM error)
  text = text.replace(/,\s*([}\]])/g, '$1');

  return text;
}

interface RawQuestion {
  id?: number;
  question?: string;
  options?: string[];
  correctIndex?: number | string;
  explanationJp?: string;
  explanationEn?: string;
  explanation?: string;
}

interface RawReadingResponse {
  title?: string;
  titleEn?: string;
  japaneseText?: string;
  englishTranslation?: string;
  vocabulary?: Array<{ word: string; reading: string; meaning: string }>;
  grammarUsed?: Array<{ pattern: string; note: string }>;
  questions?: RawQuestion[];
}

/**
 * Validate and normalize reading practice JSON schema.
 */
export function parseReadingResponse(rawResponse: string | RawReadingResponse): ReadingPracticeData {
  let parsed: RawReadingResponse;

  if (typeof rawResponse === 'object' && rawResponse !== null) {
    parsed = rawResponse as RawReadingResponse;
  } else {
    const cleanedJson = cleanJsonString(rawResponse);
    try {
      parsed = JSON.parse(cleanedJson);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to parse AI JSON response: ${message}`);
    }
  }

  // 1. Validate Japanese Text
  if (!parsed.japaneseText || typeof parsed.japaneseText !== 'string' || parsed.japaneseText.trim().length < 20) {
    throw new Error('Invalid reading material: "japaneseText" is missing or too short.');
  }

  // 2. Validate Questions
  if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new Error('Invalid reading material: "questions" array is missing or empty.');
  }

  const validatedQuestions: ReadingQuestion[] = parsed.questions.slice(0, 5).map((q, idx) => {
    if (!q.question || typeof q.question !== 'string') {
      throw new Error(`Question #${idx + 1} is missing a question prompt.`);
    }

    if (!q.options || !Array.isArray(q.options) || q.options.length < 2) {
      throw new Error(`Question #${idx + 1} must have at least 2 multiple-choice options.`);
    }

    let correctIndex = Number(q.correctIndex);
    if (isNaN(correctIndex) || correctIndex < 0 || correctIndex >= q.options.length) {
      correctIndex = 0;
    }

    const rawExplanation = q.explanation ? String(q.explanation).trim() : '';
    const explanationJp = q.explanationJp ? String(q.explanationJp).trim() : rawExplanation;
    const explanationEn = q.explanationEn ? String(q.explanationEn).trim() : '';

    return {
      id: q.id || idx + 1,
      question: q.question.trim(),
      options: q.options.map((opt) => String(opt).trim()),
      correctIndex: correctIndex,
      explanationJp: explanationJp || '解説がありません。',
      explanationEn: explanationEn,
      explanation: rawExplanation || explanationJp,
    };
  });

  return {
    title: parsed.title ? String(parsed.title).trim() : '日本語の読解練習 (Reading Practice)',
    titleEn: parsed.titleEn ? String(parsed.titleEn).trim() : '',
    japaneseText: parsed.japaneseText.trim(),
    englishTranslation: parsed.englishTranslation ? parsed.englishTranslation.trim() : '',
    vocabulary: Array.isArray(parsed.vocabulary) ? parsed.vocabulary : [],
    grammarUsed: Array.isArray(parsed.grammarUsed) ? parsed.grammarUsed : [],
    questions: validatedQuestions,
  };
}
