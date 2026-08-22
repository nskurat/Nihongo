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

export async function generateGrammarExamples({ grammar, level }) {
  const prompt = `Generate 2 new, natural Japanese example sentences for the JLPT ${level} grammar point: "${grammar.title}" (Meaning: ${grammar.meaning}). Structure: ${grammar.structure}.

CRITICAL: Return ONLY a valid JSON array of objects with "jp" and "en" keys. Do NOT include markdown code fences or conversational text.
Example format:
[
  {"jp": "...", "en": "..."},
  {"jp": "...", "en": "..."}
]`;

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
  const prompt = `Act as an expert Japanese linguist. Briefly explain subtle nuances, typical conversational contexts, and common learner traps for "${grammar.title}" (${grammar.meaning}) at ${level} level. Keep it to one clear, insightful paragraph.`;

  return await executeAiPrompt(prompt, { responseFormat: 'text' });
}

export async function generateVocabHelp({ vocab, level }) {
  const prompt = `Explain practical usage, common collocations, or register nuances for the Japanese word "${vocab.word}" (${vocab.reading}, meaning: "${vocab.meaning}") for a JLPT ${level} learner. Keep it to 1-2 concise sentences with 1 extra natural sample sentence.`;

  return await executeAiPrompt(prompt, { responseFormat: 'text' });
}

export async function generateKanjiMnemonic({ kanji, level }) {
  const readings = [
    kanji.onyomi?.length ? `On: ${kanji.onyomi.join(', ')}` : '',
    kanji.kunyomi?.length ? `Kun: ${kanji.kunyomi.join(', ')}` : '',
  ].filter(Boolean).join(' | ');

  const prompt = `Create a vivid, easy-to-remember mnemonic story or visual breakdown for the JLPT ${level} Kanji "${kanji.kanji}" (Meaning: "${kanji.meaning}", ${readings}). Radical: "${kanji.radical || 'none'}". Keep the mnemonic hook to 2-3 engaging, memorable sentences.`;

  return await executeAiPrompt(prompt, { responseFormat: 'text' });
}
