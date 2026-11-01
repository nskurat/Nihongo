import { AiProvider, AiProviderId, AiPromptOptions, ReadingPracticeData } from '../../types/ai';
import { GrammarItem, VocabItem, KanjiItem, LevelType } from '../../types/japanese';
import { geminiProvider } from './providers/gemini';
import { openaiProvider } from './providers/openai';
import { anthropicProvider } from './providers/anthropic';
import { buildReadingPracticePrompt, BuildReadingPromptParams } from './promptBuilder';
import { parseReadingResponse } from './readingParser';
import { AiError, missingKeyError, parseReply, toAiError } from './errors';
import {
  GrammarExampleSentence,
  cleanMarkdownNote,
  grammarExamplesPromptFor,
  grammarNuancePromptFor,
  kanjiMnemonicPromptFor,
  parseGrammarExamples,
  vocabHelpPromptFor,
} from './studyItems';

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

export interface ExecuteAiPromptOptions extends AiPromptOptions {
  /**
   * Provider to call. Defaults to the saved active provider. Pass it whenever `apiKey` or
   * `model` belong to a provider other than the saved one: key, model and endpoint are all
   * resolved from this one id, so one provider's key is never sent to another.
   */
  providerId?: AiProviderId;
}

export async function executeAiPrompt(prompt: string, options: ExecuteAiPromptOptions = {}): Promise<string> {
  const { providerId, ...promptOptions } = options;
  const id = providerId ?? getActiveProviderId();
  const provider = getProvider(id);

  const apiKey = promptOptions.apiKey || getStoredApiKey(id);
  const model = promptOptions.model || getStoredModel(id);

  if (provider.requiresKey && !apiKey) {
    throw missingKeyError();
  }

  const call = () => provider.executePrompt(prompt, { ...promptOptions, apiKey, model });
  try {
    return await call();
  } catch (first) {
    const err = toAiError(first);
    // One retry for failures that may pass on their own (429, 5xx, network); a second
    // failure is reported. Auth and bad replies would only fail - and bill - again.
    if (!err.retryable) throw err;
    await new Promise((resolve) => setTimeout(resolve, retryPolicy.delayMs));
    try {
      return await call();
    } catch (second) {
      throw toAiError(second);
    }
  }
}

/** Wait before the single retry. Tests set it to 0. */
export const retryPolicy = { delayMs: 1500 };

// -------------------------------------------------------------
// High-Level Domain Services
// -------------------------------------------------------------

export type { GrammarExampleSentence };

export async function generateGrammarExamples({
  grammar,
  level,
  previous = [],
}: {
  grammar: GrammarItem;
  level: LevelType;
  /** Examples the learner already has (earlier AI presses), so they are not repeated. */
  previous?: GrammarExampleSentence[];
}): Promise<GrammarExampleSentence[]> {
  const { prompt, known } = grammarExamplesPromptFor(grammar, level, previous);
  const text = await executeAiPrompt(prompt, { responseFormat: 'json' });
  const examples = parseReply(() => parseGrammarExamples(text, known));
  if (examples.length === 0) {
    // Paid for but nothing to show: say so rather than silently adding nothing.
    throw new AiError('bad-response', 'The reply had no usable example sentences.');
  }
  return examples;
}

export async function generateGrammarNuance({
  grammar,
  level,
  lessonItems = [],
}: {
  grammar: GrammarItem;
  level: LevelType;
  /** The other grammar points of the lesson; same-function ones are offered as comparisons. */
  lessonItems?: GrammarItem[];
}): Promise<string> {
  const prompt = grammarNuancePromptFor(grammar, level, lessonItems);
  return cleanMarkdownNote(await executeAiPrompt(prompt, { responseFormat: 'text' }));
}

export async function generateVocabHelp({
  vocab,
  level,
}: {
  vocab: VocabItem;
  level: LevelType;
}): Promise<string> {
  const prompt = vocabHelpPromptFor(vocab, level);
  return cleanMarkdownNote(await executeAiPrompt(prompt, { responseFormat: 'text' }));
}

export async function generateKanjiMnemonic({
  kanji,
  level,
}: {
  kanji: KanjiItem;
  level: LevelType;
}): Promise<string> {
  const prompt = kanjiMnemonicPromptFor(kanji, level);
  return cleanMarkdownNote(await executeAiPrompt(prompt, { responseFormat: 'text' }));
}

export async function generateReadingPractice(params: BuildReadingPromptParams): Promise<ReadingPracticeData> {
  const prompt = buildReadingPracticePrompt(params);
  const rawText = await executeAiPrompt(prompt, { responseFormat: 'json' });
  return parseReply(() => parseReadingResponse(rawText));
}
