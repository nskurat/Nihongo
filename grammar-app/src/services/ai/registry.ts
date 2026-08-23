import { AiProvider, AiProviderId, AiPromptOptions, ReadingPracticeData } from '../../types/ai';
import { GrammarItem, VocabItem, KanjiItem, LevelType } from '../../types/japanese';
import { geminiProvider } from './providers/gemini';
import { openaiProvider } from './providers/openai';
import { anthropicProvider } from './providers/anthropic';
import {
  getGrammarExamplesPrompt,
  getGrammarNuancePrompt,
  getVocabHelpPrompt,
  getKanjiMnemonicPrompt,
} from './prompts';
import { buildReadingPracticePrompt, BuildReadingPromptParams } from './promptBuilder';
import { parseReadingResponse } from './readingParser';

// Provider Registry Storage
const providers: Record<AiProviderId, AiProvider> = {
  gemini: geminiProvider,
  openai: openaiProvider,
  anthropic: anthropicProvider,
};

const STORAGE_ACTIVE_PROVIDER = 'nihongo_ai_active_provider';
const STORAGE_KEY_PREFIX = 'nihongo_ai_key_';
const STORAGE_MODEL_PREFIX = 'nihongo_ai_model_';

export function getRegisteredProviders(): AiProvider[] {
  return Object.values(providers);
}

export function getProvider(id: AiProviderId = 'gemini'): AiProvider {
  return providers[id] || providers.gemini;
}

export function getActiveProviderId(): AiProviderId {
  try {
    const saved = localStorage.getItem(STORAGE_ACTIVE_PROVIDER) as AiProviderId;
    if (saved && providers[saved]) {
      return saved;
    }
  } catch {
    // ignore
  }
  return 'gemini';
}

export function setActiveProviderId(id: AiProviderId): void {
  if (providers[id]) {
    localStorage.setItem(STORAGE_ACTIVE_PROVIDER, id);
  }
}

export function getStoredApiKey(providerId: AiProviderId): string {
  try {
    if (providerId === 'gemini') {
      const legacyKey = localStorage.getItem('gemini_api_key');
      if (legacyKey) return legacyKey;
    }
    return localStorage.getItem(`${STORAGE_KEY_PREFIX}${providerId}`) || '';
  } catch {
    return '';
  }
}

export function setStoredApiKey(providerId: AiProviderId, key: string): void {
  try {
    if (key.trim()) {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${providerId}`, key.trim());
      if (providerId === 'gemini') {
        localStorage.setItem('gemini_api_key', key.trim());
      }
    } else {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${providerId}`);
      if (providerId === 'gemini') {
        localStorage.removeItem('gemini_api_key');
      }
    }
  } catch {
    // ignore
  }
}

export function getStoredModel(providerId: AiProviderId): string {
  const provider = getProvider(providerId);
  const defaultModel = provider.models.find((m) => m.isDefault)?.id || provider.models[0]?.id || '';
  try {
    return localStorage.getItem(`${STORAGE_MODEL_PREFIX}${providerId}`) || defaultModel;
  } catch {
    return defaultModel;
  }
}

export function setStoredModel(providerId: AiProviderId, modelId: string): void {
  try {
    localStorage.setItem(`${STORAGE_MODEL_PREFIX}${providerId}`, modelId);
  } catch {
    // ignore
  }
}

export async function executeAiPrompt(prompt: string, options: AiPromptOptions = {}): Promise<string> {
  const activeId = getActiveProviderId();
  const provider = getProvider(activeId);

  const apiKey = options.apiKey || getStoredApiKey(activeId);
  const model = options.model || getStoredModel(activeId);

  if (provider.requiresKey && !apiKey) {
    throw new Error('MISSING_KEY');
  }

  return await provider.executePrompt(prompt, {
    ...options,
    apiKey,
    model,
  });
}

// -------------------------------------------------------------
// High-Level Domain Services
// -------------------------------------------------------------

export interface GrammarExampleSentence {
  jp: string;
  en: string;
}

export async function generateGrammarExamples({
  grammar,
  level,
}: {
  grammar: GrammarItem;
  level: LevelType;
}): Promise<GrammarExampleSentence[]> {
  const prompt = getGrammarExamplesPrompt({
    title: grammar.title,
    meaning: grammar.meaning,
    structure: grammar.structure,
    level,
  });

  const text = await executeAiPrompt(prompt, { responseFormat: 'json' });
  const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleaned);

  if (Array.isArray(parsed)) return parsed as GrammarExampleSentence[];
  if (parsed.examples && Array.isArray(parsed.examples)) return parsed.examples as GrammarExampleSentence[];
  return [];
}

export async function generateGrammarNuance({
  grammar,
  level,
}: {
  grammar: GrammarItem;
  level: LevelType;
}): Promise<string> {
  const prompt = getGrammarNuancePrompt({
    title: grammar.title,
    meaning: grammar.meaning,
    level,
  });

  return await executeAiPrompt(prompt, { responseFormat: 'text' });
}

export async function generateVocabHelp({
  vocab,
  level,
}: {
  vocab: VocabItem;
  level: LevelType;
}): Promise<string> {
  const prompt = getVocabHelpPrompt({
    word: vocab.word,
    reading: vocab.reading,
    meaning: vocab.meaning,
    level,
  });

  return await executeAiPrompt(prompt, { responseFormat: 'text' });
}

export async function generateKanjiMnemonic({
  kanji,
  level,
}: {
  kanji: KanjiItem;
  level: LevelType;
}): Promise<string> {
  const readings = [
    kanji.onyomi?.length ? `On: ${kanji.onyomi.join(', ')}` : '',
    kanji.kunyomi?.length ? `Kun: ${kanji.kunyomi.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join(' | ');

  const prompt = getKanjiMnemonicPrompt({
    kanji: kanji.kanji,
    meaning: kanji.meaning,
    radical: kanji.radical,
    readings,
    level,
  });

  return await executeAiPrompt(prompt, { responseFormat: 'text' });
}

export async function generateReadingPractice({
  level = 'N4',
  lesson = null,
  topic = 'Daily Life & Culture',
  grammarList = [],
  vocabList = [],
}: BuildReadingPromptParams): Promise<ReadingPracticeData> {
  const prompt = buildReadingPracticePrompt({
    level,
    lesson,
    topic,
    grammarList,
    vocabList,
  });

  const rawText = await executeAiPrompt(prompt, { responseFormat: 'json' });
  return parseReadingResponse(rawText);
}
