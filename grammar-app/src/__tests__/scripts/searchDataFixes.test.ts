import { describe, expect, it } from 'vitest';
import {
  applyKunFixes,
  applyVocabFixes,
  type FixReport,
  type LessonFile,
} from '../../../../scripts/lib/searchDataFixes';

const report = (): FixReport => ({ changed: [], skipped: [] });
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

// Small hand-written rows shaped like the real files - no src/data import.
const vocab = (): LessonFile => ({
  23: [{ uid: 'n3-vocab-23-124', word: '言う', reading: 'ゆう', meaning: 'to say' }],
  9: [
    { uid: 'n4-vocab-9-2', word: '気が付きます', reading: 'きつきます', romaji: 'kitsukimasu', meaning: 'to notice' },
    { uid: 'n4-vocab-9-5', word: '細い（ほそい）／太い', reading: 'ふとい', romaji: 'futoi', meaning: 'thin / thick' },
  ],
  1: [{ uid: 'n4-vocab-1-1', word: '学生', reading: 'がくせい', meaning: 'student' }],
});

describe('applyVocabFixes', () => {
  it('fixes a wrong reading, and the romaji only where the row has one', () => {
    const file = vocab();
    const r = report();
    applyVocabFixes(file, r);
    expect(file[23][0].reading).toBe('いう');
    expect(file[23][0]).not.toHaveProperty('romaji');
    expect(file[9][0]).toMatchObject({ reading: 'きがつきます', romaji: 'kigatsukimasu' });
    expect(r.skipped).toEqual([]);
  });

  it('splits a slash pair so word and reading pair up part by part', () => {
    const file = vocab();
    applyVocabFixes(file, report());
    expect(file[9][1]).toMatchObject({ word: '細い／太い', reading: 'ほそい／ふとい', romaji: 'hosoi / futoi' });
  });

  it('never touches uids or rows it has no fix for', () => {
    const file = vocab();
    const before = clone(file);
    applyVocabFixes(file, report());
    expect(Object.values(file).flat().map((r) => r.uid)).toEqual(Object.values(before).flat().map((r) => r.uid));
    expect(file[1]).toEqual(before[1]);
  });

  it('is idempotent: a second run changes and skips nothing', () => {
    const file = vocab();
    applyVocabFixes(file, report());
    const once = clone(file);
    const r = report();
    applyVocabFixes(file, r);
    expect(file).toEqual(once);
    expect(r).toEqual({ changed: [], skipped: [] });
  });

  it('skips, and reports, a row whose content no longer matches the guard', () => {
    const file: LessonFile = { 23: [{ uid: 'n3-vocab-23-124', word: '言う', reading: 'いいう' }] };
    const r = report();
    applyVocabFixes(file, r);
    expect(file[23][0].reading).toBe('いいう');
    expect(r.changed).toEqual([]);
    expect(r.skipped).toEqual(['n3-vocab-23-124: expected 言う【ゆう】, found 言う【いいう】']);
  });
});

describe('applyKunFixes', () => {
  const kanji = (): LessonFile => ({
    1: [
      { uid: 'n5-kanji-1-1', kanji: '分', kunyomi: ['わ'] },
      { uid: 'n5-kanji-1-2', kanji: '行', kunyomi: ['い', 'おこな', 'い'] },
      { uid: 'n5-kanji-1-3', kanji: '日', kunyomi: ['ひ', 'か'] },
      { uid: 'n5-kanji-1-4', kanji: '生', kunyomi: ['い', 'き'] },
    ],
  });

  it('expands bare stems to full readings, keeping order and dropping repeats', () => {
    const file = kanji();
    const r = report();
    applyKunFixes(file, r);
    expect(file[1][0].kunyomi).toEqual(['わ・かる', 'わ・ける']);
    expect(file[1][1].kunyomi).toEqual(['い・く', 'おこな・う']);
    expect(r.changed).toHaveLength(3);
  });

  it('leaves stems that are real readings (生 き) and unlisted kanji (日) alone', () => {
    const file = kanji();
    applyKunFixes(file, report());
    expect(file[1][2].kunyomi).toEqual(['ひ', 'か']);
    expect(file[1][3].kunyomi).toEqual(['い・きる', 'き']);
  });

  it('is idempotent', () => {
    const file = kanji();
    applyKunFixes(file, report());
    const r = report();
    applyKunFixes(file, r);
    expect(r.changed).toEqual([]);
  });
});
