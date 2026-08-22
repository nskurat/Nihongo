/**
 * Anthropic Claude Provider
 */
export const anthropicProvider = {
  id: 'anthropic',
  name: 'Anthropic Claude',
  badge: 'High Linguistic Nuance',
  description: 'Claude 3.5 Sonnet and Haiku with deep reasoning and natural Japanese expression.',
  models: [
    { id: 'claude-sonnet-5', name: 'Claude Sonnet 5' },
    { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' },
  ],
  defaultModel: 'claude-sonnet-5',
  keyPlaceholder: 'sk-ant-...',
  helpUrl: 'https://console.anthropic.com/settings/keys',
  requiresKey: true,

  async generateText({ prompt, apiKey, model = 'claude-sonnet-5' }) {
    if (!apiKey) throw new Error('MISSING_KEY');

    const apiUrl = 'https://api.anthropic.com/v1/messages';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      const msg = data.error?.message || `Anthropic API Error (${response.status})`;
      throw new Error(msg);
    }

    const text = data.content?.[0]?.text;
    if (!text) throw new Error('No content returned from Claude.');

    return text;
  },
};
