import { describe, expect, it } from 'vitest';
import {
  buildCoverageIndex,
  buildSourceIndex,
  byFrequency,
  cleanKunyomi,
  cleanOnyomi,
  displayMeaning,
  glossesOverlap,
  isWordCovered,
  kanjiOf,
  masuForms,
  pickCompounds,
  pickLesson,
  refreshAppendedRow,
  stripAnnotation,
  strokeOrderLink,
  tidyGloss,
  type SourceKanji,
  type SourceWord,
} from '../../../../scripts/lib/jlptContent';

describe('stripAnnotation', () => {
  it('removes bracketed usage notes', () => {
    expect(stripAnnotation('迷う [道に〜]')).toBe('迷う');
    expect(stripAnnotation('明るい［性格が〜］')).toBe('明るい');
    expect(stripAnnotation('取る (写真を〜)')).toBe('取る');
    expect(stripAnnotation('先輩')).toBe('先輩');
  });
});

describe('kanjiOf', () => {
  it('keeps only kanji', () => {
    expect(kanjiOf('取り扱う')).toEqual(['取', '扱']);
    expect(kanjiOf('人々')).toEqual(['人']);
    expect(kanjiOf('まるで')).toEqual([]);
  });
});

describe('displayMeaning / cleanKunyomi / strokeOrderLink', () => {
  it('formats source fields', () => {
    expect(displayMeaning(['a', 'b', 'c', 'd', 'e'])).toBe('a, b, c, d');
    expect(displayMeaning(['branch', 'support', 'branch radical (no. 65)'])).toBe('branch, support');
    expect(cleanKunyomi(['ひ', '-び', 'こ-', 'まよ・う'])).toEqual(['ひ', 'まよ・う']);
    expect(strokeOrderLink('迷')).toBe('https://jisho.org/search/%E8%BF%B7%23kanji');
  });
});

describe('pickCompounds', () => {
  it('keeps order, skips non-matching and duplicate words, caps the count', () => {
    const c = (word: string) => ({ word, reading: '', meaning: '' });
    const out = pickCompounds('湖', [c('湖'), c('海'), c('湖'), c('湖水'), c('湖畔'), c('湖面')], 3);
    expect(out.map((x) => x.word)).toEqual(['湖', '湖水', '湖畔']);
  });
});

describe('pickLesson', () => {
  it('uses the first preferred lesson under the cap', () => {
    expect(pickLesson({ 1: 5, 2: 3, 3: 9 }, [3, 2], 6)).toBe(2);
  });
  it('falls back to the emptiest lesson, lowest number on ties', () => {
    expect(pickLesson({ 1: 5, 2: 3, 3: 3 }, [1], 5)).toBe(2);
    expect(pickLesson({ 1: 5, 2: 3, 3: 3 }, [], 5)).toBe(2);
  });
});

describe('isWordCovered', () => {
  const index = buildCoverageIndex([
    { word: '先輩', meaning: 'senior' },
    { word: 'ちょうど', meaning: 'just, exactly' },
    { word: 'それ', meaning: 'that one' },
    { word: 'はい', meaning: 'yes' },
    { word: '書きます', meaning: 'to write' },
    { word: '迷う [道に〜]', meaning: 'to get lost' },
  ]);
  const w = (kanji: string, kana: string, meaning = '') => ({ level: 'N3' as const, jmdictSeq: 1, kanji, kana, meaning });
  it('matches the written form, annotations stripped', () => {
    expect(isWordCovered(w('先輩', 'せんぱい'), index)).toBe(true);
    expect(isWordCovered(w('迷う', 'まよう'), index)).toBe(true);
    expect(isWordCovered(w('後輩', 'こうはい'), index)).toBe(false);
    expect(isWordCovered(w('', 'ちょうど'), index)).toBe(true);
  });
  it('matches a dictionary-form verb taught as a -ます form', () => {
    expect(isWordCovered(w('書く', 'かく', 'to write'), index)).toBe(true);
  });
  it('matches a kanji spelling of a kana-written word only when the glosses agree', () => {
    expect(isWordCovered(w('丁度', 'ちょうど', 'exactly, precisely'), index)).toBe(true);
    expect(isWordCovered(w('其れ', 'それ', 'it, that'), index)).toBe(true);
    expect(isWordCovered(w('肺', 'はい', 'lung'), index)).toBe(false);
  });
});

describe('glossesOverlap', () => {
  it('ignores stopwords and usage notes, matches simple stems', () => {
    expect(glossesOverlap('to be drowned', 'drown')).toBe(true);
    expect(glossesOverlap('to injure', 'injury')).toBe(true);
    expect(glossesOverlap('someone', 'somebody')).toBe(true);
    expect(glossesOverlap('lung', 'yes')).toBe(false);
    expect(glossesOverlap('nucleus, kernel', 'work up [a sweat]')).toBe(false);
    expect(glossesOverlap('to be (polite)', '(hon.) to be')).toBe(false);
  });
});

describe('masuForms', () => {
  it('builds the possible polite forms', () => {
    expect(masuForms('書く')).toEqual(['書きます']);
    expect(masuForms('泳ぐ')).toEqual(['泳ぎます']);
    expect(masuForms('見る')).toEqual(['見ます', '見ります']);
    expect(masuForms('勉強する')).toEqual(['勉強します']);
    expect(masuForms('来る')).toEqual(['来ます']);
    expect(masuForms('本')).toEqual([]);
  });
});

describe('cleanOnyomi / cleanKunyomi', () => {
  it('drops affix forms and KANJIDIC unit readings, normalises okurigana marks', () => {
    expect(cleanOnyomi(['オウ', 'ヨウ', '-ノウ'])).toEqual(['オウ', 'ヨウ']);
    expect(cleanKunyomi(['たか.い', 'たか', '-だか', 'たか・い'])).toEqual(['たか・い', 'たか']);
    expect(cleanKunyomi(['デシメートル', 'こ', 'こな'])).toEqual(['こ', 'こな']);
  });
});

describe('tidyGloss', () => {
  it('drops empty comma parts', () => {
    expect(tidyGloss(',for (10 days),next (year)')).toBe('for (10 days), next (year)');
    expect(tidyGloss('year end,')).toBe('year end');
    expect(tidyGloss('dull (e.g., a knife)')).toBe('dull (e.g., a knife)');
  });
});

describe('refreshAppendedRow', () => {
  const src: SourceWord[] = [
    { level: 'N3', jmdictSeq: 1, kanji: '', kana: 'いつも', meaning: 'always', listKanji: '何時も' },
    { level: 'N3', jmdictSeq: 2, kanji: '後', kana: 'うしろ', meaning: 'back, behind' },
  ];
  const index = buildSourceIndex(src);
  it('follows the list spelling and gloss for appended rows', () => {
    expect(refreshAppendedRow({ level: 'N3', word: '何時も', reading: 'いつも', meaning: 'always' }, index)).toEqual({
      word: 'いつも',
      meaning: 'always',
    });
    expect(refreshAppendedRow({ level: 'N3', word: '後', reading: 'うしろ', meaning: 'afterwards' }, index)).toEqual({
      word: '後',
      meaning: 'back, behind',
    });
  });
  it('leaves textbook rows, current rows and other levels alone', () => {
    expect(refreshAppendedRow({ level: 'N3', word: '後', reading: 'うしろ', meaning: 'x', exampleJp: '後ろ' }, index)).toBeNull();
    expect(refreshAppendedRow({ level: 'N3', word: '後', reading: 'うしろ', meaning: 'back, behind' }, index)).toBeNull();
    expect(refreshAppendedRow({ level: 'N5', word: '何時も', reading: 'いつも', meaning: 'always' }, index)).toBeNull();
  });
});

describe('byFrequency', () => {
  const k = (freq: number | null, strokes: number): SourceKanji => ({
    level: 'N3', strokes, freq, radical: '', onyomi: [], kunyomi: [], meanings: [],
  });
  it('orders by frequency, unranked last, then strokes', () => {
    const items: [string, SourceKanji][] = [['a', k(null, 3)], ['b', k(10, 5)], ['c', k(10, 2)], ['d', k(1, 9)]];
    expect(items.sort(byFrequency).map(([c]) => c)).toEqual(['d', 'c', 'b', 'a']);
  });
});
