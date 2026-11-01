import { afterEach, beforeEach, vi } from 'vitest';

/**
 * No test may reach the network: AI providers cost the user money, and a test
 * that silently depends on the network is flaky. `fetch` is replaced by a stub
 * that throws, so a missed mock fails loudly instead of calling a provider.
 * Tests that exercise HTTP code inject their own fetch (see keyChecker) or
 * mock at the provider boundary (see src/test/mockAi.ts).
 */
export const NETWORK_BLOCKED = 'Network access is blocked in tests - mock the call instead.';

export const blockedFetch = vi.fn((input: unknown) => {
  throw new Error(`${NETWORK_BLOCKED} (fetch ${String(input)})`);
});

beforeEach(() => {
  vi.stubGlobal('fetch', blockedFetch);
  if (globalThis.fetch !== blockedFetch) {
    throw new Error('fetch guard is not installed - refusing to run a test that could hit the network');
  }
});

afterEach(() => {
  blockedFetch.mockClear();
  vi.unstubAllGlobals();
});
