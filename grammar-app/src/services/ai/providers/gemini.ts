import { AiProvider, AiPromptOptions } from '../../../types/ai';

export const geminiProvider: AiProvider = {
  id: 'gemini',
  name: 'Google Gemini',
  description: 'Fast, high-quality reasoning and bilingual generation powered by Google Flash models.',
  website: 'https://aistudio.google.com/app/apikey',
  requiresKey: true,
  models: [
    { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash (Fast & Advanced)', isDefault: true },
    { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash' },
  ],

  async executePrompt(prompt: string, options: AiPromptOptions = {}): Promise<string> {
    const { apiKey, model = 'gemini-3.7-flash' } = options;

    if (!apiKey) {
      throw new Error('MISSING_KEY');
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const payload: Record<string, unknown> = {
      contents: [{ parts: [{ text: prompt }] }],
    };

    if (options.responseFormat === 'json') {
      payload.generationConfig = { responseMimeType: 'application/json' };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
