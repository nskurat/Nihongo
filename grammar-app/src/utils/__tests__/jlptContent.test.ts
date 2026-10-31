import { describe, expect, it } from 'vitest';
import {
  byFrequency,
  cleanKunyomi,
  displayMeaning,
  isWordCovered,
  kanjiOf,
  pickCompounds,
  pickLesson,
  stripAnnotation,
  strokeOrderLink,
  type SourceKanji,
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
  const forms = new Set(['先輩', 'ちょうど']);
  const w = (kanji: string, kana: string) => ({ level: 'N3' as const, jmdictSeq: 1, kanji, kana, meaning: '' });
  it('matches the written form or a kana spelling', () => {
    expect(isWordCovered(w('先輩', 'せんぱい'), forms)).toBe(true);
    expect(isWordCovered(w('丁度', 'ちょうど'), forms)).toBe(true);
    expect(isWordCovered(w('後輩', 'こうはい'), forms)).toBe(false);
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
