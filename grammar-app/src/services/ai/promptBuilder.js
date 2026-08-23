import {
  READING_PRACTICE_SYSTEM_PROMPT,
  READING_PRACTICE_RULES,
  READING_PRACTICE_SCHEMA_TEMPLATE,
} from './prompts';

/**
 * Builds the contextual instruction section for a specific lesson or general level.
 */
function buildContextBlock(level, lesson, grammarList, vocabList) {
  if (!lesson) {
    return `TARGET LEVEL: JLPT ${level} General Reading Practice\n- Keep sentence structures, vocabulary, and kanji aligned with JLPT ${level} proficiency.`;
  }

  const grammarSnippets = grammarList
    .slice(0, 4)
    .map((g) => `• ${g.title} (${g.meaning})`)
    .join('\n');

  const vocabSnippets = vocabList
    .slice(0, 8)
    .map((v) => `${v.word} (${v.reading}: ${v.meaning})`)
    .join(', ');

  return [
    `TARGET LESSON: Minna no Nihongo Lesson ${lesson} (JLPT ${level})`,
    `- Target Grammar to incorporate naturally:\n${grammarSnippets || `Key patterns from Lesson ${lesson}`}`,
    `- Target Vocabulary:\n${vocabSnippets || `Key words from Lesson ${lesson}`}`,
  ].join('\n');
}

/**
 * Assembles the full structured prompt for reading practice generation.
 */
export function buildReadingPracticePrompt({
  level = 'N4',
  lesson = null,
  topic = 'Daily Life & Culture',
  grammarList = [],
  vocabList = [],
}) {
  const context = buildContextBlock(level, lesson, grammarList, vocabList);

  return [
    READING_PRACTICE_SYSTEM_PROMPT,
    '',
    context,
    `THEME / TOPIC: "${topic}"`,
    '',
    'REQUIREMENTS:',
    READING_PRACTICE_RULES,
    '',
    'CRITICAL: Return ONLY a valid JSON object matching the exact schema below. Do NOT wrap in conversational text or markdown code fences.',
    '',
    READING_PRACTICE_SCHEMA_TEMPLATE,
  ].join('\n');
}
