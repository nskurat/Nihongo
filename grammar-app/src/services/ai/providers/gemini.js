/**
 * Google Gemini Provider
 */
export const geminiProvider = {
  id: 'gemini',
  name: 'Google Gemini',
  badge: 'Free Tier Available',
  description: 'Fast, multimodal models by Google DeepMind with high rate limits on AI Studio free tier.',
  models: [
    { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash' },
    { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash' },
  ],
  defaultModel: 'gemini-3.7-flash',
  keyPlaceholder: 'AIzaSy...',
  helpUrl: 'https://aistudio.google.com/app/apikey',
  requiresKey: true,

  async generateText({ prompt, apiKey, model = 'gemini-3.7-flash', responseFormat = 'text' }) {
    if (!apiKey) throw new Error('MISSING_KEY');

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const bodyPayload = {
      contents: [{ parts: [{ text: prompt }] }],
    };

    if (responseFormat === 'json') {
      bodyPayload.generationConfig = {
        responseMimeType: 'application/json',
      };
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      const msg = data.error?.message || `Gemini API Error (${response.status})`;
      throw new Error(msg);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('No content returned from Gemini.');

    return text;
  },
};
