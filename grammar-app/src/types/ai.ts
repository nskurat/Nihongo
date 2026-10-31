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

/** A level's current Reading Studio passage, with the answers given so far. */
export interface ActiveReading {
  level: LevelType;
  lesson: number | null;
  topic: string;
  data: ReadingPracticeData;
  /** questionId -> chosen option index. Answers are final once given. */
  answers: Record<number, number>;
}

/** Each level keeps its own current passage; switching level never relabels one. */
export type ActiveReadings = Partial<Record<LevelType, ActiveReading>>;

export interface SaveHistoryParams {
  reading: ReadingPracticeData;
  level?: LevelType;
  lesson?: number | null;
  topic?: string;
  maxItems?: number;
}
