import { describe, expect, it } from 'vitest';
import { applyN4CompoundFixes, N4_COMPOUND_FIXES, type LessonFile } from '../../../../scripts/lib/n4CompoundFixes';

const file = (): LessonFile => ({
  2: [
    { uid: 'n4-kanji-2-8', kanji: '夢', compounds: [{ word: '夢を見ます dream a', reading: null, meaning: 'dream' }] },
    { uid: 'n4-kanji-2-1', kanji: '他', compounds: [{ word: '他', reading: 'ほか', meaning: 'other' }] },
  ],
});

describe('applyN4CompoundFixes', () => {
  it('cleans the word and fills reading and meaning; untouched rows stay as they are', () => {
    const f = file();
    const report = { changed: [] as string[], skipped: [] as string[] };
    applyN4CompoundFixes(f, report);
    expect((f[2][0].compounds as unknown[])[0]).toEqual({ word: '夢を見ます', reading: 'ゆめをみます', meaning: 'have a dream' });
    expect((f[2][1].compounds as unknown[])[0]).toEqual({ word: '他', reading: 'ほか', meaning: 'other' });
    expect(report.changed).toHaveLength(1);
  });

  it('is idempotent', () => {
    const f = file();
    applyN4CompoundFixes(f, { changed: [], skipped: [] });
    const again = { changed: [] as string[], skipped: [] as string[] };
    applyN4CompoundFixes(f, again);
    expect(again.changed).toEqual([]);
  });

  it('every fix has a hiragana/katakana reading, an English meaning and no Latin left in the word', () => {
    for (const fx of N4_COMPOUND_FIXES) {
      expect(fx.reading).toMatch(/^[ぁ-ゖァ-ヺー]+$/);
      expect(fx.meaning).toMatch(/[a-z]/i);
      expect(fx.word).not.toMatch(/[A-Za-z]/);
    }
  });
});
