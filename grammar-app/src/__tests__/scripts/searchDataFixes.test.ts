import { describe, expect, it } from 'vitest';
import {
  applyKunFixes,
  applyMeaningMarkerFixes,
  stripPosMarkers,
  applyTitleTildeFixes,
  applyVocabFixes,
  type FixReport,
  type LessonFile,
} from '../../../../scripts/lib/searchDataFixes';

const report = (): FixReport => ({ changed: [], skipped: [] });
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

// Small hand-written rows shaped like the real files - no src/data import.
const vocab = (): LessonFile => ({
  9: [
    { uid: 'n4-vocab-9-2', word: '気が付きます', reading: 'きつきます', romaji: 'kitsukimasu', meaning: 'to notice' },
    { uid: 'n4-vocab-9-5', word: '細い（ほそい）／太い', reading: 'ふとい', romaji: 'futoi', meaning: 'thin / thick' },
  ],
  1: [{ uid: 'n4-vocab-1-1', word: '学生', reading: 'がくせい', meaning: 'student' }],
});

describe('applyVocabFixes', () => {
  it('fixes a wrong reading and its romaji', () => {
    const file = vocab();
    const r = report();
    applyVocabFixes(file, r);
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
    const file: LessonFile = { 9: [{ uid: 'n4-vocab-9-2', word: '気付く', reading: 'きづく' }] };
    const r = report();
    applyVocabFixes(file, r);
    expect(file[9][0].reading).toBe('きづく');
    expect(r.changed).toEqual([]);
    expect(r.skipped).toEqual(['n4-vocab-9-2: expected 気が付きます【きつきます】, found 気付く【きづく】']);
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

describe('applyTitleTildeFixes', () => {
  it('turns ASCII and full-width tildes in titles into 〜, once', () => {
    const file: LessonFile = {
      1: [
        { uid: 'n5-grammar-1-6', title: '~さん' },
        { uid: 'n5-grammar-1-7', title: '～ちゃん' },
        { uid: 'n5-grammar-1-8', title: '〜は〜です' },
      ],
    };
    const r = report();
    applyTitleTildeFixes(file, r);
    expect(file[1].map((row) => row.title)).toEqual(['〜さん', '〜ちゃん', '〜は〜です']);
    expect(r.changed).toEqual(['n5-grammar-1-6 ~さん → 〜さん', 'n5-grammar-1-7 ～ちゃん → 〜ちゃん']);
    const again = report();
    applyTitleTildeFixes(file, again);
    expect(again.changed).toEqual([]);
  });
});

describe('stripPosMarkers / applyMeaningMarkerFixes (regression R16)', () => {
  it('drops JMdict part-of-speech markers and empty language tags, keeps senses and usage notes', () => {
    expect(stripPosMarkers('(n) (a) joy, (a) delight')).toBe('joy, delight');
    expect(stripPosMarkers('(1) holiday, rest, (2) (exp) Good night')).toBe('(1) holiday, rest, (2) Good night');
    expect(stripPosMarkers('(pt:) (n) playing cards (pt: carta)')).toBe('playing cards (pt: carta)');
    expect(stripPosMarkers('(male) (vulg.) to eat')).toBe('(male) (vulg.) to eat');
    expect(stripPosMarkers('minute(s)')).toBe('minute(s)');
  });

  it('rewrites meanings in place and is idempotent', () => {
    const file: LessonFile = { 1: [{ uid: 'n2-vocab-1-24', word: '小便', meaning: '(col) urine' }] };
    const r = report();
    applyMeaningMarkerFixes(file, r);
    expect(file[1][0].meaning).toBe('urine');
    const again = report();
    applyMeaningMarkerFixes(file, again);
    expect(again.changed).toEqual([]);
  });
});

describe('VOCAB_EXAMPLE_FIXES', () => {
  it('replaces an example that only repeats the word, once', () => {
    const file: LessonFile = { 17: [{ uid: 'n5-vocab-17-10', word: 'お大事に', exampleJp: 'お大事に。', exampleEn: 'Take care of yourself.' }] };
    const r = report();
    applyVocabFixes(file, r);
    expect(file[17][0]).toMatchObject({ exampleJp: 'かぜですか。どうぞ お大事に。', exampleEn: 'A cold? Please take care of yourself.' });
    const again = report();
    applyVocabFixes(file, again);
    expect(again.changed).toEqual([]);
  });
});

describe('N5_KUN_ADDITIONS', () => {
  it('adds the counting form once, after the existing readings', () => {
    const file: LessonFile = { 1: [{ uid: 'n5-kanji-1-9', kanji: '一', kunyomi: ['ひと'] }] };
    applyKunFixes(file, report());
    expect(file[1][0].kunyomi).toEqual(['ひと', 'ひと・つ']);
    const again = report();
    applyKunFixes(file, again);
    expect(again.changed).toEqual([]);
  });
});
