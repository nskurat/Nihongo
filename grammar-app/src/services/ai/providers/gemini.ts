import { AiProvider, AiPromptOptions } from '../../../types/ai';
import { missingKeyError, requestJson } from '../errors';
import { MODEL_CATALOG, getDefaultModelId, toModelOptions } from '../modelCatalog';

/** The part of a generateContent reply this app reads. */
type ProviderReply = { candidates?: { content?: { parts?: { text?: string }[] } }[] };

// The floating alias never goes stale: Google moves it to the newest stable Flash.
const models = toModelOptions(MODEL_CATALOG.providers.gemini, 'gemini-flash-latest');
const DEFAULT_MODEL = getDefaultModelId(models);

export const geminiProvider: AiProvider = {
  id: 'gemini',
  name: 'Google Gemini',
  description: 'Fast, high-quality reasoning and bilingual generation powered by Google Flash models.',
  website: 'https://aistudio.google.com/app/apikey',
  requiresKey: true,
  models,

  async executePrompt(prompt: string, options: AiPromptOptions = {}): Promise<string> {
    const { apiKey, model = DEFAULT_MODEL } = options;

    if (!apiKey) {
      throw missingKeyError();
    }

    // The key travels in a header, not the query string, so it stays out of URLs and logs.
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

    const payload: Record<string, unknown> = {
      contents: [{ parts: [{ text: prompt }] }],
    };

    if (options.responseFormat === 'json') {
      payload.generationConfig = { responseMimeType: 'application/json' };
    }

    const data = (await requestJson('Gemini', endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(payload),
    })) as ProviderReply;
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  },
};
