import { describe, it, expect } from 'vitest';
import { remapCacheToIds } from '../uid';

describe('remapCacheToIds', () => {
  const items = [
    { id: '1-1', uid: 'n5-grammar-1-1' },
    { id: '1-2', uid: 'n5-grammar-1-2' },
  ];

  it("maps store entries back onto each item's own id, via its uid", () => {
    const store = {
      'n5-grammar-1-1': 'n5 explanation',
      'n3-grammar-1-1': 'n3 explanation',
    };
    expect(remapCacheToIds(items, store)).toEqual({
      '1-1': 'n5 explanation',
    });
  });

  it("does not leak another level's entry for the same raw id", () => {
    // n3-grammar-1-1 collides on raw id ("1-1") with n5's item above, but not on uid.
    const store = { 'n3-grammar-1-1': 'n3 explanation' };
    expect(remapCacheToIds(items, store)).toEqual({});
  });

  it('omits items with no cache entry', () => {
    expect(remapCacheToIds(items, {})).toEqual({});
  });

  it('skips items with no id, since there is no legacy key to attach the value to', () => {
    const store = { 'n5-grammar-1-3': 'orphaned explanation' };
    expect(remapCacheToIds([{ uid: 'n5-grammar-1-3' }], store)).toEqual({});
  });
});
