import { AiProvider, AiPromptOptions } from '../../../types/ai';
import { MODEL_CATALOG, getDefaultModelId, toModelOptions } from '../modelCatalog';

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
      throw new Error('MISSING_KEY');
    }

    // The key travels in a header, not the query string, so it stays out of URLs and logs.
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

    const payload: Record<string, unknown> = {
      contents: [{ parts: [{ text: prompt }] }],
    };

    if (options.responseFormat === 'json') {
      payload.generationConfig = { responseMimeType: 'application/json' };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Gemini API returned status ${res.status}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  },
};
