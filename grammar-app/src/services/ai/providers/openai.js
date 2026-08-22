/**
 * OpenAI Provider
 */
export const openaiProvider = {
  id: 'openai',
  name: 'OpenAI (ChatGPT)',
  badge: 'Industry Standard',
  description: 'GPT-4o and GPT-4o-mini models via OpenAI official API.',
  models: [
    { id: 'gpt-4o-mini', name: 'GPT-4o mini (Fast & Affordable)' },
    { id: 'gpt-4o', name: 'GPT-4o (Flagship Model)' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
  ],
  defaultModel: 'gpt-4o-mini',
  keyPlaceholder: 'sk-proj-...',
  helpUrl: 'https://platform.openai.com/api-keys',
  requiresKey: true,

  async generateText({ prompt, apiKey, model = 'gpt-4o-mini', responseFormat = 'text' }) {
    if (!apiKey) throw new Error('MISSING_KEY');

    const apiUrl = 'https://api.openai.com/v1/chat/completions';

    const bodyPayload = {
      model: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    };

    if (responseFormat === 'json') {
      bodyPayload.response_format = { type: 'json_object' };
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(bodyPayload),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      const msg = data.error?.message || `OpenAI API Error (${response.status})`;
      throw new Error(msg);
    }

    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('No content returned from OpenAI.');

    return text;
  },
};
