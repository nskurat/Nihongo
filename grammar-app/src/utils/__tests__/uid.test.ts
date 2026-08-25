import { describe, it, expect } from 'vitest';
import { buildUid, remapCacheToIds } from '../uid';

describe('buildUid', () => {
  it('lowercases the level and joins level-section-lesson-n', () => {
    expect(buildUid('N5', 'grammar', 1, 1)).toBe('n5-grammar-1-1');
    expect(buildUid('N3', 'grammar', 1, 1)).toBe('n3-grammar-1-1');
  });
});

describe('remapCacheToIds', () => {
  const items = [
    { id: '1-1' },
    { id: '1-2' },
  ];

  it('maps store entries back onto each item\'s own id', () => {
    const store = {
      'n5-grammar-1-1': 'n5 explanation',
      'n3-grammar-1-1': 'n3 explanation',
    };
    expect(remapCacheToIds(items, 'N5', 'grammar', 1, store)).toEqual({
      '1-1': 'n5 explanation',
    });
  });

  it('does not leak another level\'s entry for the same raw id', () => {
    const store = { 'n3-grammar-1-1': 'n3 explanation' };
    expect(remapCacheToIds(items, 'N5', 'grammar', 1, store)).toEqual({});
  });

  it('omits items with no cache entry', () => {
    expect(remapCacheToIds(items, 'N5', 'grammar', 1, {})).toEqual({});
  });
});
