import { describe, it, expect, vi } from 'vitest';
import {
  buildListModelsRequest,
  extractModelIds,
  interpretFetchFailure,
  interpretListModelsResponse,
} from '../modelListing';
import { BaseKeyChecker, FetchKeyChecker, FetchLike, getKeyChecker, setKeyChecker } from '../keyChecker';

describe('buildListModelsRequest', () => {
  it('Anthropic: x-api-key, version and the direct-browser header', () => {
    const req = buildListModelsRequest('anthropic', ' sk-ant-test ');
    expect(req.url).toBe('https://api.anthropic.com/v1/models?limit=1000');
    expect(req.headers).toEqual({
      'x-api-key': 'sk-ant-test',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    });
  });

  it('Gemini: key in x-goog-api-key, never in the URL, and no Authorization header', () => {
    const req = buildListModelsRequest('gemini', 'AIza-test');
    expect(req.url.startsWith('https://generativelanguage.googleapis.com/v1beta/models')).toBe(true);
    expect(req.url).not.toContain('AIza-test');
    expect(req.url).not.toContain('key=');
    expect(req.headers).toEqual({ 'x-goog-api-key': 'AIza-test' });
  });

  it('OpenAI: Bearer token', () => {
    expect(buildListModelsRequest('openai', 'sk-test')).toEqual({
      url: 'https://api.openai.com/v1/models',
      headers: { Authorization: 'Bearer sk-test' },
    });
  });
});

describe('extractModelIds', () => {
  it('reads data[].id for Anthropic and OpenAI', () => {
    expect(extractModelIds('anthropic', { data: [{ id: 'claude-sonnet-5-5' }, { id: 'claude-haiku-5-5' }] })).toEqual([
      'claude-sonnet-5-5',
      'claude-haiku-5-5',
    ]);
    expect(extractModelIds('openai', { object: 'list', data: [{ id: 'gpt-4.1' }, { nope: 1 }] })).toEqual(['gpt-4.1']);
  });

  it('reads models[].name for Gemini and strips the models/ prefix', () => {
    expect(extractModelIds('gemini', { models: [{ name: 'models/gemini-flash-latest' }] })).toEqual([
      'gemini-flash-latest',
    ]);
  });

  it('tolerates malformed bodies', () => {
    expect(extractModelIds('openai', null)).toEqual([]);
    expect(extractModelIds('gemini', { models: 'x' })).toEqual([]);
  });
});

describe('interpretListModelsResponse', () => {
  it('2xx is OK with the model ids', () => {
    expect(interpretListModelsResponse('openai', 200, { data: [{ id: 'gpt-4.1' }] })).toEqual({
      status: 'ok',
      modelIds: ['gpt-4.1'],
    });
  });

  it('401 and 403 are an invalid key, using the provider message when present', () => {
    expect(
      interpretListModelsResponse('anthropic', 401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } })
    ).toEqual({ status: 'invalid-key', message: 'invalid x-api-key' });
    expect(interpretListModelsResponse('openai', 403, null)).toEqual({
      status: 'invalid-key',
      message: 'Key rejected (HTTP 403).',
    });
  });

  it("Gemini's 400 API_KEY_INVALID is an invalid key, other 400s are not", () => {
    const badKey = {
      error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] },
    };
    expect(interpretListModelsResponse('gemini', 400, badKey).status).toBe('invalid-key');
    expect(interpretListModelsResponse('gemini', 400, { error: { message: 'Bad pageSize' } }).status).toBe('error');
  });

  it('429 and 5xx are generic errors', () => {
    expect(interpretListModelsResponse('openai', 429, {})).toMatchObject({ status: 'error' });
    expect(interpretListModelsResponse('anthropic', 529, {})).toEqual({ status: 'error', message: 'Provider returned HTTP 529.' });
  });

  it('a rejected fetch is a network/CORS failure', () => {
    expect(interpretFetchFailure(new TypeError('Failed to fetch'))).toMatchObject({ status: 'network' });
  });
});

describe('FetchKeyChecker', () => {
  const okFetch = (status: number, body: unknown): FetchLike => vi.fn(async () => ({ status, json: async () => body }));

  it('calls only the list endpoint with GET and the built headers', async () => {
    const fetchImpl = okFetch(200, { data: [{ id: 'claude-sonnet-5-5' }] });
    const result = await new FetchKeyChecker(fetchImpl).check('anthropic', 'sk-ant-test');
    expect(result).toEqual({ status: 'ok', modelIds: ['claude-sonnet-5-5'] });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith('https://api.anthropic.com/v1/models?limit=1000', {
      method: 'GET',
      headers: expect.objectContaining({ 'x-api-key': 'sk-ant-test' }),
    });
  });

  it('maps a thrown fetch to network', async () => {
    const fetchImpl: FetchLike = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect((await new FetchKeyChecker(fetchImpl).check('openai', 'sk-test')).status).toBe('network');
  });

  it('survives a non-JSON error body', async () => {
    const fetchImpl: FetchLike = vi.fn(async () => ({
      status: 401,
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
    }));
    expect(await new FetchKeyChecker(fetchImpl).check('gemini', 'bad')).toEqual({
      status: 'invalid-key',
      message: 'Key rejected (HTTP 401).',
    });
  });

  it('does not call out without a key', async () => {
    const fetchImpl = okFetch(200, {});
    expect((await new FetchKeyChecker(fetchImpl).check('openai', '  ')).status).toBe('invalid-key');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('the singleton can be swapped for another adapter', async () => {
    const original = getKeyChecker();
    class StubChecker extends BaseKeyChecker {
      async check() {
        return { status: 'ok' as const, modelIds: ['stub'] };
      }
    }
    setKeyChecker(new StubChecker());
    expect(await getKeyChecker().check('gemini', 'k')).toEqual({ status: 'ok', modelIds: ['stub'] });
    expect(() => setKeyChecker({} as BaseKeyChecker)).toThrow();
    setKeyChecker(original);
  });
});
