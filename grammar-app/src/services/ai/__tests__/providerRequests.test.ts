// Request-shape tests. fetch is stubbed: nothing here reaches a provider.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { geminiProvider } from '../providers/gemini';
import { openaiProvider } from '../providers/openai';

function stubFetch(body: unknown) {
  const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => body }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function sentRequest(fetchMock: ReturnType<typeof stubFetch>): { url: string; init: RequestInit; body: Record<string, unknown> } {
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  return { url, init, body: JSON.parse(String(init.body)) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Gemini request', () => {
  it('sends the key in x-goog-api-key, not in the URL', async () => {
    const fetchMock = stubFetch({ candidates: [{ content: { parts: [{ text: 'hi' }] } }] });
    const text = await geminiProvider.executePrompt('p', { apiKey: 'AIza-test', model: 'gemini-flash-latest' });
    expect(text).toBe('hi');
    const { url, init } = sentRequest(fetchMock);
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent');
    expect(url).not.toContain('AIza-test');
    expect(init.headers).toMatchObject({ 'x-goog-api-key': 'AIza-test' });
  });

  it('defaults to the floating Flash alias', async () => {
    const fetchMock = stubFetch({});
    await geminiProvider.executePrompt('p', { apiKey: 'k' });
    expect(sentRequest(fetchMock).url).toContain('/models/gemini-flash-latest:generateContent');
  });
});

describe('OpenAI request', () => {
  const reply = { choices: [{ message: { content: 'ok' } }] };

  it('sends temperature to a non-reasoning model', async () => {
    const fetchMock = stubFetch(reply);
    await openaiProvider.executePrompt('p', { apiKey: 'sk', model: 'gpt-4.1', temperature: 0.5 });
    expect(sentRequest(fetchMock).body.temperature).toBe(0.5);
  });

  it('omits temperature for reasoning models (catalog flag or name pattern)', async () => {
    for (const model of ['gpt-5.5', 'o3', 'o4-mini', 'gpt-5.2-unknown']) {
      const fetchMock = stubFetch(reply);
      await openaiProvider.executePrompt('p', { apiKey: 'sk', model, responseFormat: 'json' });
      const { body } = sentRequest(fetchMock);
      expect(body).not.toHaveProperty('temperature');
      expect(body.response_format).toEqual({ type: 'json_object' });
      vi.unstubAllGlobals();
    }
  });
});
