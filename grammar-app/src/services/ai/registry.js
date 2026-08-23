import { geminiProvider } from './providers/gemini';
import { openaiProvider } from './providers/openai';
import { anthropicProvider } from './providers/anthropic';

/**
 * Provider Registry Map
 */
const providers = new Map();

export function registerProvider(provider) {
  if (!provider || !provider.id) {
    throw new Error('Provider must have an "id" property');
  }
  providers.set(provider.id, provider);
}

// Register built-in core providers
registerProvider(geminiProvider);
registerProvider(openaiProvider);
registerProvider(anthropicProvider);

export function getProviders() {
  return Array.from(providers.values());
}

export function getProvider(id) {
  return providers.get(id) || geminiProvider;
}

// -------------------------------------------------------------
// Local Storage Persistence Helpers
// -------------------------------------------------------------
const STORAGE_KEYS = {
  ACTIVE_PROVIDER: 'ai_active_provider',
  KEYS: 'ai_provider_keys',
  MODELS: 'ai_provider_models',
  LEGACY_GEMINI_KEY: 'gemini_api_key',
};

export function getActiveProviderId() {
  try {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_PROVIDER) || 'gemini';
  } catch {
    return 'gemini';
  }
}

export function setActiveProviderId(providerId) {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_PROVIDER, providerId);
  } catch (e) {
    console.error('Failed to save active provider:', e);
  }
}

export function getStoredApiKey(providerId) {
  try {
    const rawKeys = localStorage.getItem(STORAGE_KEYS.KEYS);
    const keys = rawKeys ? JSON.parse(rawKeys) : {};
    
    // Backwards compatibility with gemini_api_key or env var
    if (providerId === 'gemini' && !keys.gemini) {
      const legacyKey = localStorage.getItem(STORAGE_KEYS.LEGACY_GEMINI_KEY) || 
        (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) || '';
      if (legacyKey) return legacyKey;
    }

    return keys[providerId] || '';
  } catch {
    return '';
  }
}

export function setStoredApiKey(providerId, key) {
  try {
    const rawKeys = localStorage.getItem(STORAGE_KEYS.KEYS);
    const keys = rawKeys ? JSON.parse(rawKeys) : {};

    const trimmed = (key || '').trim();
    if (trimmed) {
      keys[providerId] = trimmed;
    } else {
      delete keys[providerId];
    }

    localStorage.setItem(STORAGE_KEYS.KEYS, JSON.stringify(keys));

    // Also sync legacy key if gemini
    if (providerId === 'gemini') {
      if (trimmed) {
        localStorage.setItem(STORAGE_KEYS.LEGACY_GEMINI_KEY, trimmed);
      } else {
        localStorage.removeItem(STORAGE_KEYS.LEGACY_GEMINI_KEY);
      }
    }
  } catch (e) {
    console.error('Failed to save API key:', e);
  }
}

export function getStoredModel(providerId) {
  try {
    const rawModels = localStorage.getItem(STORAGE_KEYS.MODELS);
    const models = rawModels ? JSON.parse(rawModels) : {};
    return models[providerId] || getProvider(providerId).defaultModel;
  } catch {
    return getProvider(providerId).defaultModel;
  }
}

export function setStoredModel(providerId, model) {
  try {
    const rawModels = localStorage.getItem(STORAGE_KEYS.MODELS);
    const models = rawModels ? JSON.parse(rawModels) : {};
    models[providerId] = model;
    localStorage.setItem(STORAGE_KEYS.MODELS, JSON.stringify(models));
  } catch (e) {
    console.error('Failed to save model:', e);
  }
}

// -------------------------------------------------------------
// Unified Execution Service
// -------------------------------------------------------------

export async function executeAiPrompt(prompt, options = {}) {
  const providerId = options.providerId || getActiveProviderId();
  const provider = getProvider(providerId);

  const apiKey = options.apiKey !== undefined ? options.apiKey : getStoredApiKey(providerId);
  const model = options.model || getStoredModel(providerId);

  if (provider.requiresKey && !apiKey) {
    const err = new Error('MISSING_KEY');
    err.provider = provider;
    throw err;
  }

  return await provider.generateText({
    prompt,
    apiKey,
    model,
    responseFormat: options.responseFormat || 'text',
  });
}

// -------------------------------------------------------------
// High-Level Domain Prompts
// -------------------------------------------------------------
import {
  getGrammarExamplesPrompt,
  getGrammarNuancePrompt,
  getVocabHelpPrompt,
  getKanjiMnemonicPrompt,
} from './prompts';
import { buildReadingPracticePrompt } from './promptBuilder';
import { parseReadingResponse } from './readingParser';

export async function generateGrammarExamples({ grammar, level }) {
  const prompt = getGrammarExamplesPrompt({
    title: grammar.title,
    meaning: grammar.meaning,
    structure: grammar.structure,
    level,
  });

  const text = await executeAiPrompt(prompt, { responseFormat: 'json' });

  // Clean and parse JSON response safely
  const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleaned);

  // Handle both array responses or object wrapped { examples: [...] }
  if (Array.isArray(parsed)) return parsed;
  if (parsed.examples && Array.isArray(parsed.examples)) return parsed.examples;
  return [];
}

export async function generateGrammarNuance({ grammar, level }) {
  const prompt = getGrammarNuancePrompt({
    title: grammar.title,
    meaning: grammar.meaning,
    level,
  });

  return await executeAiPrompt(prompt, { responseFormat: 'text' });
}

export async function generateVocabHelp({ vocab, level }) {
  const prompt = getVocabHelpPrompt({
    word: vocab.word,
    reading: vocab.reading,
    meaning: vocab.meaning,
    level,
  });

  return await executeAiPrompt(prompt, { responseFormat: 'text' });
}

export async function generateKanjiMnemonic({ kanji, level }) {
  const readings = [
    kanji.onyomi?.length ? `On: ${kanji.onyomi.join(', ')}` : '',
    kanji.kunyomi?.length ? `Kun: ${kanji.kunyomi.join(', ')}` : '',
  ].filter(Boolean).join(' | ');

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
}) {
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

