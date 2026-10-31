// Regression: on the OpenAI tab, the old "Test Connection" sent the typed OpenAI key and
// model to the last SAVED provider (Anthropic), which answered "invalid x-api-key".
// fetch and localStorage are stubbed: nothing here reaches a provider.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeAiPrompt } from '../registry';
import { FetchKeyChecker } from '../keyChecker';

function memoryStorage(initial: Record<string, string>) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    snapshot: () => Object.fromEntries(map),
  };
}

let storage: ReturnType<typeof memoryStorage>;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // The saved active provider is Anthropic, with its own key and model.
  storage = memoryStorage({
    nihongo_ai_active_provider: 'anthropic',
    nihongo_ai_key_anthropic: 'sk-ant-saved',
    nihongo_ai_model_anthropic: 'claude-sonnet-5-5',
  });
  vi.stubGlobal('localStorage', storage);
  fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ data: [{ id: 'gpt-4.1' }], choices: [{ message: { content: 'ok' } }] }),
  }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function calls(): { url: string; headers: Record<string, string> }[] {
  return fetchMock.mock.calls.map((c) => {
    const [url, init] = c as unknown as [string, { headers: Record<string, string> }];
    return { url, headers: init.headers };
  });
}

function expectOnlyOpenAi(openAiKey: string) {
  expect(calls().length).toBeGreaterThan(0);
  for (const { url, headers } of calls()) {
    expect(url.startsWith('https://api.openai.com/')).toBe(true);
    expect(url).not.toContain('anthropic');
    expect(headers.Authorization).toBe(`Bearer ${openAiKey}`);
    expect(headers).not.toHaveProperty('x-api-key');
  }
}

describe('provider routing when the open tab differs from the saved provider', () => {
  it('Check key on the OpenAI tab goes to api.openai.com with Bearer, never to Anthropic', async () => {
    const result = await new FetchKeyChecker().check('openai', 'sk-openai-typed');
    expect(result).toEqual({ status: 'ok', modelIds: ['gpt-4.1'] });
    expectOnlyOpenAi('sk-openai-typed');
  });

  it('executeAiPrompt with an explicit providerId uses that provider for endpoint, key and model', async () => {
    await executeAiPrompt('p', { providerId: 'openai', apiKey: 'sk-openai-typed', model: 'gpt-4.1' });
    expectOnlyOpenAi('sk-openai-typed');
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    expect(JSON.parse(init.body).model).toBe('gpt-4.1');
  });

  it("never falls back to another provider's stored key or model", async () => {
    storage.setItem('nihongo_ai_key_openai', 'sk-openai-saved');
    await executeAiPrompt('p', { providerId: 'openai' });
    expectOnlyOpenAi('sk-openai-saved');
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    expect(JSON.parse(init.body).model).not.toMatch(/^claude/);
  });

  it('without a stored OpenAI key it fails with MISSING_KEY instead of borrowing the Anthropic one', async () => {
    await expect(executeAiPrompt('p', { providerId: 'openai' })).rejects.toThrow('MISSING_KEY');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('checking a key writes nothing to storage', async () => {
    const before = storage.snapshot();
    await new FetchKeyChecker().check('openai', 'sk-openai-typed');
    expect(storage.snapshot()).toEqual(before);
  });

  it('without providerId it still uses the saved active provider', async () => {
    await executeAiPrompt('p');
    expect(calls()[0].url).toBe('https://api.anthropic.com/v1/messages');
    expect(calls()[0].headers['x-api-key']).toBe('sk-ant-saved');
  });
});
