import { AiProvider, AiPromptOptions } from '../../../types/ai';
import { missingKeyError, requestJson } from '../errors';
import { MODEL_CATALOG, getDefaultModelId, toModelOptions } from '../modelCatalog';

/** The part of a messages reply this app reads. */
type ProviderReply = { content?: { text?: string }[] };

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
      throw missingKeyError();
    }

    const payload = {
      model,
      // A reading set (passage + translation + 5 explained questions) runs to
      // 3–5k output tokens at N2/N1; 1500 truncated the JSON mid-string.
      // Only tokens actually generated are billed.
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    };

    const data = (await requestJson('Anthropic', 'https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(payload),
    })) as ProviderReply;
    return data.content?.[0]?.text || '';
  },
};
