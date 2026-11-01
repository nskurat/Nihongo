// Typed AI errors and the single retry. fetch is stubbed per test: nothing reaches a provider.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiError, aiErrorFromStatus, aiErrorMessage, isMissingKey, toAiError, type AiErrorKind } from '../errors';
import { executeAiPrompt, generateGrammarExamples, retryPolicy, setStoredApiKey } from '../registry';
import { geminiProvider } from '../providers/gemini';
import type { GrammarItem } from '../../../types/japanese';

const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    length: 0,
  } as Storage;
};

const ok = (text: string) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) });
const fail = (status: number, message?: string) => ({
  ok: false,
  status,
  json: async () => (message ? { error: { message } } : {}),
});

/** fetch answers with each response in turn. */
function fetchSequence(...responses: Array<object | Error>) {
  const queue = [...responses];
  const fetchMock = vi.fn(async () => {
    const next = queue.shift();
    if (next instanceof Error) throw next;
    return next;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  setStoredApiKey('gemini', 'test-key-not-real');
  retryPolicy.delayMs = 0;
});

describe('aiErrorFromStatus', () => {
  it.each<[number, AiErrorKind, boolean]>([
    [401, 'auth', false],
    [403, 'auth', false],
    [429, 'rate-limit', true],
    [500, 'provider', true],
    [503, 'provider', true],
    [400, 'provider', false],
  ])('%i → %s (retryable: %s)', (status, kind, retryable) => {
    const err = aiErrorFromStatus('Gemini', status);
    expect(err).toMatchObject({ kind, status, retryable });
    expect(err.message).toBe(`Gemini API returned status ${status}`);
  });

  it("keeps the provider's own message when it sends one", () => {
    expect(aiErrorFromStatus('Gemini', 400, 'model not found').message).toBe('model not found');
  });
});

describe('providers throw AiError', () => {
  it('a fetch failure is a retryable network error', async () => {
    fetchSequence(new TypeError('Failed to fetch'));
    await expect(geminiProvider.executePrompt('p', { apiKey: 'k' })).rejects.toMatchObject({
      kind: 'network',
      retryable: true,
    });
  });

  it('no key is missing-key, recognised by isMissingKey', async () => {
    const err = await geminiProvider.executePrompt('p', {}).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(isMissingKey(err)).toBe(true);
  });
});

describe('executeAiPrompt retries once', () => {
  it('a 500 then a 200 returns the result', async () => {
    const fetchMock = fetchSequence(fail(500), ok('こんにちは'));
    await expect(executeAiPrompt('p')).resolves.toBe('こんにちは');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('a 429 then a network error reports the second failure', async () => {
    const fetchMock = fetchSequence(fail(429), new TypeError('offline'));
    await expect(executeAiPrompt('p')).rejects.toMatchObject({ kind: 'network' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('a 401 is not retried', async () => {
    const fetchMock = fetchSequence(fail(401, 'API key not valid'));
    await expect(executeAiPrompt('p')).rejects.toMatchObject({ kind: 'auth', message: 'API key not valid' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('unusable replies are bad-response', () => {
  const grammar: GrammarItem = {
    uid: 'n5-grammar-1-1',
    level: 'N5',
    section: 'grammar',
    lesson: 1,
    title: 'です',
    meaning: 'to be',
    structure: 'N + です',
    explanation: '...',
  };

  it('JSON with no usable examples', async () => {
    fetchSequence(ok('{"examples": [{"jp": "", "en": ""}]}'));
    await expect(generateGrammarExamples({ grammar, level: 'N5' })).rejects.toMatchObject({ kind: 'bad-response' });
  });

  it('a reply that is not JSON at all', async () => {
    fetchSequence(ok('Sorry, I cannot help with that.'));
    await expect(generateGrammarExamples({ grammar, level: 'N5' })).rejects.toMatchObject({ kind: 'bad-response' });
  });
});

describe('aiErrorMessage', () => {
  it('gives one actionable line per kind', () => {
    expect(aiErrorMessage(new AiError('auth', 'x'))).toMatch(/key was rejected/);
    expect(aiErrorMessage(new AiError('rate-limit', 'x'))).toMatch(/limiting requests/);
    expect(aiErrorMessage(new AiError('network', 'x'))).toMatch(/connection/);
    expect(aiErrorMessage(new AiError('bad-response', 'x'))).toMatch(/couldn't be used/);
    expect(aiErrorMessage(aiErrorFromStatus('Gemini', 503))).toBe('The AI provider returned an error (503). Try again later.');
    expect(aiErrorMessage(new Error('MISSING_KEY'))).toMatch(/Add an API key/);
  });

  it('toAiError wraps unknown throws as non-retryable provider errors', () => {
    expect(toAiError('boom')).toMatchObject({ kind: 'provider', retryable: false, message: 'boom' });
  });
});
