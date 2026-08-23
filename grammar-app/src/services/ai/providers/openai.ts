import { AiProvider, AiPromptOptions } from '../../../types/ai';

export const openaiProvider: AiProvider = {
  id: 'openai',
  name: 'OpenAI (ChatGPT)',
  description: 'Industry-standard language models with structured JSON and nuanced Japanese output.',
  website: 'https://platform.openai.com/api-keys',
  requiresKey: true,
  models: [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fast & Affordable)', isDefault: true },
    { id: 'gpt-4o', name: 'GPT-4o (High Intelligence)' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
  ],

  async executePrompt(prompt: string, options: AiPromptOptions = {}): Promise<string> {
    const { apiKey, model = 'gpt-4o-mini', temperature = 0.7 } = options;

    if (!apiKey) {
      throw new Error('MISSING_KEY');
    }

    const payload: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: 'You are an expert Japanese educator.' },
        { role: 'user', content: prompt },
      ],
      temperature,
    };

    if (options.responseFormat === 'json') {
      payload.response_format = { type: 'json_object' };
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || `OpenAI API returned status ${res.status}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  },
};
