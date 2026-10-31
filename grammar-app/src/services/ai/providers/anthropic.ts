import { AiProvider, AiPromptOptions } from '../../../types/ai';
import { MODEL_CATALOG, getDefaultModelId, toModelOptions } from '../modelCatalog';

const models = toModelOptions(MODEL_CATALOG.providers.anthropic, 'claude-sonnet-5-5');
const DEFAULT_MODEL = getDefaultModelId(models);

export const anthropicProvider: AiProvider = {
  id: 'anthropic',
  name: 'Anthropic Claude',
  description: 'Deep analytical linguistic reasoning and nuanced natural phrasing.',
  website: 'https://console.anthropic.com/settings/keys',
  requiresKey: true,
  models,

  async executePrompt(prompt: string, options: AiPromptOptions = {}): Promise<string> {
    const { apiKey, model = DEFAULT_MODEL } = options;

    if (!apiKey) {
      throw new Error('MISSING_KEY');
    }

    const payload = {
      model,
      // A reading set (passage + translation + 5 explained questions) runs to
      // 3–5k output tokens at N2/N1; 1500 truncated the JSON mid-string.
      // Only tokens actually generated are billed.
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    };

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Anthropic API returned status ${res.status}`);
    }

    const data = await res.json();
    return data.content?.[0]?.text || '';
  },
};
