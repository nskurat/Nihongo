import { describe, expect, it } from 'vitest';
import type { SearchResponse } from '../../../services/search/types';
import { shouldRequeryOnReady } from '../useSearch';

const response = (status: SearchResponse['status']) => ({ status }) as SearchResponse;

describe('shouldRequeryOnReady', () => {
  it('re-runs a partial answer once the index is ready', () => {
    expect(shouldRequeryOnReady('ready', response('partial'))).toBe(true);
  });
  it('leaves complete answers, other statuses and empty state alone', () => {
    expect(shouldRequeryOnReady('ready', response('ready'))).toBe(false);
    expect(shouldRequeryOnReady('partial', response('partial'))).toBe(false);
    expect(shouldRequeryOnReady('loading', response('partial'))).toBe(false);
    expect(shouldRequeryOnReady('ready', undefined)).toBe(false);
  });
});
