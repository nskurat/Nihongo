import { describe, expect, it, vi } from 'vitest';
import { blockedFetch, NETWORK_BLOCKED } from '../setup.node';
import { executeAiPrompt, setStoredApiKey } from '../../services/ai/registry';

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

describe('network guard', () => {
  it('replaces fetch with a stub that throws', () => {
    expect(globalThis.fetch).toBe(blockedFetch);
    expect(() => fetch('https://example.com')).toThrow(NETWORK_BLOCKED);
  });

  it('stops an unmocked provider call before it leaves the machine', async () => {
    // A real key and provider, no mockAi(): exactly the mistake the guard exists for.
    vi.stubGlobal('localStorage', memoryStorage());
    setStoredApiKey('gemini', 'test-key-not-real');

    await expect(executeAiPrompt('こんにちは')).rejects.toThrow();
    expect(blockedFetch).toHaveBeenCalledTimes(1);
    expect(String(blockedFetch.mock.calls[0][0])).toContain('generativelanguage.googleapis.com');
    expect(blockedFetch.mock.results[0].type).toBe('throw');
  });
});
