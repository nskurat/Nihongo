import { LevelType, GrammarItem, VocabItem } from '../../types/japanese';
import {
  READING_PRACTICE_SYSTEM_PROMPT,
  READING_PRACTICE_SCHEMA_TEMPLATE,
  getReadingPracticeRules,
} from './prompts';

/** Random source in [0, 1). Injected so tests are deterministic. */
export type RandomSource = () => number;

export const MAX_TARGET_GRAMMAR = 5;
export const MAX_TARGET_VOCAB = 10;

/**
 * N5 (lessons 1–25) and N4 (lessons 1–25) follow the Minna no Nihongo sequence
 * (N4 Lesson n = Minna Lesson 25 + n). Early N5 lessons have not met the verb
 * forms a model reaches for by default, so lesson-targeted prompts name them.
 */
const N5_FORM_MILESTONES: Array<{ lesson: number; form: string }> = [
  { lesson: 9, form: 'reason clauses with から' },
  { lesson: 14, form: 'て-form' },
  { lesson: 17, form: 'ない-form' },
  { lesson: 18, form: 'dictionary form' },
  { lesson: 19, form: 'た-form' },
  { lesson: 20, form: 'plain style (だ / plain verb endings outside quotes)' },
  { lesson: 22, form: 'noun-modifying clauses (きのう買った本)' },
];

function shuffle<T>(items: T[], rng: RandomSource): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Picks up to `max` items at random but keeps them in lesson order. */
function sampleInOrder<T>(items: T[], max: number, rng: RandomSource): T[] {
  if (items.length <= max) return items;
  const keep = new Set(shuffle(items.map((_, i) => i), rng).slice(0, max));
  return items.filter((_, i) => keep.has(i));
}

/**
 * Five 0-based answer positions in which every position 0–3 appears at least
 * once, in random order. Models left to themselves over-pick one index.
 */
export function buildAnswerKey(rng: RandomSource = Math.random): number[] {
  const extra = Math.floor(rng() * 4);
  return shuffle([0, 1, 2, 3, extra], rng);
}

const BRACKET_NOTE = /\s*[[［]([^\]］]*)[\]］]\s*/g;

/**
 * Vocab rows carry usage notes in square brackets (`迷う [道に〜]`, `[お]花見`,
 * `平凡 [な]`). Square brackets mean furigana in this prompt, so the notes are
 * moved out of the headword. Phrases, affixes and ／-pairs are dropped: they are
 * not words a passage can "use".
 */
export function formatTargetVocab(v: VocabItem): string | null {
  const notes: string[] = [];
  const word = v.word
    .replace(BRACKET_NOTE, (_, note: string) => {
      if (note.includes('〜') || note.includes('～')) notes.push(note);
      return '';
    })
    .trim();
  if (!word || /^[〜～]|[〜～]$|[／/、。]/.test(word)) return null;

  const reading = v.reading.replace(BRACKET_NOTE, '').trim();
  const meaning = v.meaning.replace(/\[/g, '(').replace(/\]/g, ')');
  const usage = notes.length ? `; as in ${notes.join(', ')}` : '';
  const readingPart = reading && reading !== word ? `${reading}: ` : '';
  return `${word} (${readingPart}${meaning}${usage})`;
}

function firstClause(text: string, max = 80): string {
  // Split at a real sentence end, not inside an ellipsis ("Not... anywhere").
  const sentence = text.split(/(?<=[\p{L}\d)"'][.;])\s+/u)[0].trim();
  return sentence.length > max ? `${sentence.slice(0, max - 1).trimEnd()}…` : sentence;
}

function lessonCeiling(level: LevelType, lesson: number): string[] {
  if (level === 'N5') {
    const lines = [
      `- The learner has studied N5 Lessons 1–${lesson} only (Minna no Nihongo Lessons 1–${lesson}). Do not use grammar from later lessons.`,
    ];
    const notYet = N5_FORM_MILESTONES.filter((m) => m.lesson > lesson);
    if (notYet.length) {
      lines.push(
        `- Not taught yet, so do not use them in the passage or the options: ${notYet
          .map((m) => `${m.form} (Lesson ${m.lesson})`)
          .join('; ')}. Questions and explanations may use the standard short JLPT N5 phrasing, but keep them as simple as possible.`
      );
    }
    return lines;
  }
  if (level === 'N4') {
    return [
      `- The learner knows all of N5 and N4 Lessons 1–${lesson} (Minna no Nihongo Lessons 26–${25 + lesson}). Do not use N4 grammar from later lessons.`,
    ];
  }
  if (level === 'N1') return [];
  return [`- Grammar outside the targets must come from ${level} or lower levels.`];
}

/**
 * Builds the contextual instruction section for a specific lesson or general level.
 */
function buildContextBlock(
  level: LevelType,
  lesson: number | null,
  grammarList: GrammarItem[],
  vocabList: VocabItem[],
  rng: RandomSource
): string {
  if (!lesson) {
    return `TARGET LEVEL: JLPT ${level} General Reading Practice\n- Keep sentence structures, vocabulary and kanji within JLPT ${level} and below.`;
  }

  const grammar = sampleInOrder(grammarList, MAX_TARGET_GRAMMAR, rng);
  const vocab = shuffle(
    vocabList.map(formatTargetVocab).filter((v): v is string => v !== null),
    rng
  ).slice(0, MAX_TARGET_VOCAB);

  const lines = [`TARGET LESSON: Lesson ${lesson} (JLPT ${level})`];

  if (grammar.length) {
    const need = Math.min(3, grammar.length);
    lines.push(
      `- Target grammar — use at least ${need} of these naturally in the passage, and list the ones you used in "grammarUsed":`,
      ...grammar.map((g) => `  • ${g.title} — ${firstClause(g.meaning)}`)
    );
  } else {
    lines.push(`- Target grammar: the key patterns of ${level} Lesson ${lesson}.`);
  }

  if (vocab.length) {
    const need = Math.min(5, vocab.length);
    lines.push(
      `- Target vocabulary — use at least ${need} of these words (any natural inflection):`,
      `  ${vocab.join(', ')}`
    );
  }

  lines.push(...lessonCeiling(level, lesson));
  return lines.join('\n');
}

export interface BuildReadingPromptParams {
  level?: LevelType;
  lesson?: number | null;
  topic?: string;
  grammarList?: GrammarItem[];
  vocabList?: VocabItem[];
  /** Kanji the learner is expected to know (N5/N4: the portal's kanji lists). */
  allowedKanji?: string;
  /** Random source for the target sample and answer key; defaults to Math.random. */
  rng?: RandomSource;
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
  allowedKanji = '',
  rng = Math.random,
}: BuildReadingPromptParams): string {
  const context = buildContextBlock(level, lesson, grammarList, vocabList, rng);
  const kanji = [...new Set(allowedKanji)].join('');

  const parts = [READING_PRACTICE_SYSTEM_PROMPT, '', context];
  if (kanji) {
    parts.push(
      `- Kanji ceiling: use only these kanji (target vocabulary may keep its usual spelling); write any other word in hiragana, loanwords in katakana:\n  ${kanji}`
    );
  }
  parts.push(
    `THEME / TOPIC: "${topic}"`,
    '',
    'REQUIREMENTS',
    getReadingPracticeRules(level, buildAnswerKey(rng)),
    '',
    'JSON SCHEMA',
    READING_PRACTICE_SCHEMA_TEMPLATE
  );
  return parts.join('\n');
}
