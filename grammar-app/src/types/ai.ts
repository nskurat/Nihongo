import { LevelType } from './japanese';

export type AiProviderId = 'gemini' | 'openai' | 'anthropic';

export interface AiModelOption {
  id: string;
  name: string;
  isDefault?: boolean;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  /** Set when the provider retires the model within ~90 days (YYYY-MM-DD). */
  deprecationDate?: string;
  /** Reasoning-class model; OpenAI rejects sampling params such as temperature for these. */
  reasoning?: boolean;
}

export interface AiPromptOptions {
  model?: string;
  apiKey?: string;
  temperature?: number;
  responseFormat?: 'text' | 'json';
}

export interface AiProvider {
  id: AiProviderId;
  name: string;
  description: string;
  website: string;
  requiresKey: boolean;
  models: AiModelOption[];
  executePrompt: (prompt: string, options?: AiPromptOptions) => Promise<string>;
}

export interface ReadingQuestion {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanationJp: string;
  explanationEn?: string;
  explanation?: string;
}

export interface ReadingVocabEntry {
  word: string;
  reading: string;
  meaning: string;
}

export interface ReadingGrammarNote {
  pattern: string;
  note: string;
}

export interface ReadingPracticeData {
  title: string;
  titleEn?: string;
  japaneseText: string;
  englishTranslation?: string;
  vocabulary?: ReadingVocabEntry[];
  grammarUsed?: ReadingGrammarNote[];
  questions: ReadingQuestion[];
}

export interface ReadingHistoryEntry {
  id: string;
  timestamp: string;
  level: LevelType;
  lesson: number | null;
  topic: string;
  data: ReadingPracticeData;
}

/** A level's current Reading Studio passage. Its answers live in `ReadingProgress`. */
export interface ActiveReading {
  /**
   * The story this passage is: its saved-library entry id (every generated
   * passage is saved there under the id it was given). Keys `ReadingProgress`.
   */
  storyId: string;
  level: LevelType;
  lesson: number | null;
  topic: string;
  data: ReadingPracticeData;
}

/** Each level keeps its own current passage; switching level never relabels one. */
export type ActiveReadings = Partial<Record<LevelType, ActiveReading>>;

/** questionId -> chosen option index. Answers are final once given. */
export type StoryAnswers = Record<number, number>;

/** Answers per story (keyed by story id), so reopening a story restores where you left off. */
export type ReadingProgress = Record<string, StoryAnswers>;

export interface SaveHistoryParams {
  reading: ReadingPracticeData;
  /** Id for the new entry; pass the id the passage is already open under. */
  id?: string;
  level?: LevelType;
  lesson?: number | null;
  topic?: string;
  maxItems?: number;
}
