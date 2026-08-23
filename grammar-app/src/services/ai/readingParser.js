/**
 * Parse bracketed furigana syntax (e.g. 漢字[かんじ] or [漢字](かんじ)) into tokens.
 * Tokens are either { type: 'text', content: '...' } or { type: 'ruby', base: '...', ruby: '...' }
 */
export function parseFuriganaTokens(text = '') {
  if (!text) return [];

  // Match Kanji/Base followed by [furigana] or {base|ruby} or [base](ruby)
  // Standard format: 漢字[かんじ]
  const regex = /([\u4E00-\u9FAF\u3400-\u4DBF々ヶ]+)\[([^\s\]]+)\]|\[([\u4E00-\u9FAF\u3400-\u4DBF々ヶ\w\s]+)\]\(([^)]+)\)|\{([^|]+)\|([^}]+)\}/g;

  const tokens = [];
  let lastIndex = 0;
  let match;

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
 * Clean and extract JSON string from raw LLM output.
 * Handles code fences (```json ... ```), preambles, and trailing commas.
 */
export function cleanJsonString(rawText = '') {
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

/**
 * Validate and normalize reading practice JSON schema.
 */
export function parseReadingResponse(rawResponse) {
  let parsed;

  if (typeof rawResponse === 'object' && rawResponse !== null) {
    parsed = rawResponse;
  } else {
    const cleanedJson = cleanJsonString(rawResponse);
    try {
      parsed = JSON.parse(cleanedJson);
    } catch (err) {
      throw new Error(`Failed to parse AI JSON response: ${err.message}`);
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

  const validatedQuestions = parsed.questions.slice(0, 5).map((q, idx) => {
    if (!q.question || typeof q.question !== 'string') {
      throw new Error(`Question #${idx + 1} is missing a question prompt.`);
    }

    if (!q.options || !Array.isArray(q.options) || q.options.length < 2) {
      throw new Error(`Question #${idx + 1} must have at least 2 multiple-choice options.`);
    }

    let correctIndex = Number(q.correctIndex);
    if (isNaN(correctIndex) || correctIndex < 0 || correctIndex >= q.options.length) {
      // Fallback to 0 if out of bounds
      correctIndex = 0;
    }

    return {
      id: q.id || idx + 1,
      question: q.question.trim(),
      questionEn: q.questionEn ? q.questionEn.trim() : '',
      options: q.options.map((opt) => String(opt).trim()),
      correctIndex: correctIndex,
      explanation: q.explanation ? String(q.explanation).trim() : 'No explanation provided.',
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
