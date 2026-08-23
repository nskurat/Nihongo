import { AiProvider, AiPromptOptions } from '../../../types/ai';

export const anthropicProvider: AiProvider = {
  id: 'anthropic',
  name: 'Anthropic Claude',
  description: 'Deep analytical linguistic reasoning and nuanced natural phrasing.',
  website: 'https://console.anthropic.com/settings/keys',
  requiresKey: true,
  models: [
    { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', isDefault: true },
    { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' },
  ],

  async executePrompt(prompt: string, options: AiPromptOptions = {}): Promise<string> {
    const { apiKey, model = 'claude-sonnet-5' } = options;

    if (!apiKey) {
      throw new Error('MISSING_KEY');
    }

    const payload = {
      model,
      max_tokens: 1500,
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
