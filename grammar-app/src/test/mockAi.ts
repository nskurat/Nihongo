import { vi } from 'vitest';
import { getRegisteredProviders, setStoredApiKey } from '../services/ai/registry';
import type { AiProvider } from '../types/ai';

/**
 * Mocks the AI boundary: every provider's `executePrompt`, the one call
 * `executeAiPrompt` makes after resolving key and model. Everything above it
 * (prompt building, key lookup, response parsing) runs for real; nothing
 * below it (fetch) can run at all. A fake key is stored so the MISSING_KEY
 * check passes.
 *
 * Returns the spies so a test can assert on the prompt that was sent.
 */
export function mockAi(...responses: string[]) {
  setStoredApiKey('gemini', 'test-key-not-real');
  const queue = [...responses];
  const respond = vi.fn<(prompt: string) => Promise<string>>(async () => {
    if (queue.length === 0) throw new Error('mockAi: no response left for this call');
    return queue.length > 1 ? queue.shift()! : queue[0];
  });
  const spies = getRegisteredProviders().map((p: AiProvider) =>
    vi.spyOn(p, 'executePrompt').mockImplementation(respond)
  );
  return { respond, spies };
}
