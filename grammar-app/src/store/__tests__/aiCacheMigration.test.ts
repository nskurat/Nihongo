import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { V5_REPLACED_KANJI_UIDS, withoutKeys } from '../aiCacheMigration';

describe('withoutKeys', () => {
  it('drops only the listed keys', () => {
    expect(withoutKeys({ a: 1, b: 2, c: 3 }, ['b', 'x'])).toEqual({ a: 1, c: 3 });
  });
});

describe('V5_REPLACED_KANJI_UIDS', () => {
  it('names real N3 kanji slots', () => {
    const data: Record<string, { uid: string }[]> = JSON.parse(
      readFileSync(resolve(__dirname, '../../data/n3/kanji.json'), 'utf-8')
    );
    const uids = new Set(Object.values(data).flat().map((k) => k.uid));
    for (const uid of V5_REPLACED_KANJI_UIDS) expect(uids.has(uid)).toBe(true);
  });
});

import { withoutShiftedUids } from '../aiCacheMigration';

describe('withoutShiftedUids', () => {
  it('drops uids at or after the first shifted position of their lesson only', () => {
    const notes = { 'n5-vocab-7-26': 'a', 'n5-vocab-7-27': 'b', 'n5-vocab-7-40': 'c', 'n5-vocab-8-30': 'd', 'n5-kanji-7-30': 'e' };
    expect(withoutShiftedUids(notes, ['n5-vocab-7-27'])).toEqual({ 'n5-vocab-7-26': 'a', 'n5-vocab-8-30': 'd', 'n5-kanji-7-30': 'e' });
  });
});
