import { LevelType } from './japanese';

export type AiProviderId = 'gemini' | 'openai' | 'anthropic';

export interface AiModelOption {
  id: string;
  name: string;
  isDefault?: boolean;
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

export interface SaveHistoryParams {
  reading: ReadingPracticeData;
  level?: LevelType;
  lesson?: number | null;
  topic?: string;
  maxItems?: number;
}
