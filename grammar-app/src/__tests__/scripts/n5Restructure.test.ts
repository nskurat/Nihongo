import { describe, expect, it } from 'vitest';
import {
  applyVocabExamples,
  buildGrammar,
  packUidMap,
  parseAssignments,
  placeKanji,
  regroup,
  type GrammarSpec,
  type Row,
} from '../../../../scripts/lib/n5Restructure';

const row = (uid: string, extra: Record<string, unknown> = {}): Row => ({ uid, lesson: Number(uid.split('-')[2]), ...extra });
const spec = (replaces: string[], title = 'T'): GrammarSpec => ({
  replaces,
  title,
  structure: title,
  meaning: 'm',
  explanation: 'e',
  summary: 's',
  details: 'd',
  tags: [],
  examples: [{ jp: 'あ。', en: 'a' }],
});

describe('parseAssignments', () => {
  it('reads "position:lesson" pairs per old lesson', () => {
    const m = parseAssignments('n5', 'vocab', { '1': '1:3 2:1', '2': '1:25' });
    expect([...m]).toEqual([
      ['n5-vocab-1-1', 3],
      ['n5-vocab-1-2', 1],
      ['n5-vocab-2-1', 25],
    ]);
  });

  it('rejects lessons outside 1–25 and duplicates', () => {
    expect(() => parseAssignments('n5', 'vocab', { '1': '1:26' })).toThrow(/bad assignment/);
    expect(() => parseAssignments('n5', 'vocab', { '1': '1:2 1:3' })).toThrow(/twice/);
  });
});

describe('regroup', () => {
  it('renumbers per new lesson, preferred rows first, then old order', () => {
    const rows = [row('n5-vocab-1-1'), row('n5-vocab-1-2', { exampleJp: 'x' }), row('n5-vocab-2-1')];
    const lessons: Record<string, number> = { 'n5-vocab-1-1': 2, 'n5-vocab-1-2': 2, 'n5-vocab-2-1': 1 };
    const { file, map } = regroup(rows, (r) => lessons[r.uid], 'n5-vocab', (r) => Boolean(r.exampleJp));
    expect(file[2].map((r) => r.uid)).toEqual(['n5-vocab-2-1', 'n5-vocab-2-2']);
    expect(file[2][0]).toMatchObject({ exampleJp: 'x', lesson: 2 });
    expect(map).toEqual({ 'n5-vocab-1-2': 'n5-vocab-2-1', 'n5-vocab-1-1': 'n5-vocab-2-2', 'n5-vocab-2-1': 'n5-vocab-1-1' });
    expect(file[25]).toEqual([]);
  });
});

describe('placeKanji', () => {
  const vocab = { 1: [{ uid: 'v', lesson: 1, word: '日本 [国]' }], 3: [{ uid: 'w', lesson: 3, word: '日曜日' }, { uid: 'x', lesson: 3, word: '本' }] };

  it('puts a kanji in the first lesson whose words use it', () => {
    const out = placeKanji([row('n5-kanji-9-1', { kanji: '本' }), row('n5-kanji-9-2', { kanji: '曜' })], vocab, 5);
    expect(out.get('n5-kanji-9-1')).toBe(1);
    expect(out.get('n5-kanji-9-2')).toBe(3);
  });

  it('moves on to a later used lesson, or the emptiest later one, when full', () => {
    const out = placeKanji([row('n5-kanji-1-1', { kanji: '日' }), row('n5-kanji-1-2', { kanji: '本' })], vocab, 1);
    expect(out.get('n5-kanji-1-1')).toBe(1);
    expect(out.get('n5-kanji-1-2')).toBe(3);
  });

  it('places an unused kanji in the emptiest lesson', () => {
    const out = placeKanji([row('n5-kanji-1-1', { kanji: '火' })], vocab, 5);
    expect(out.get('n5-kanji-1-1')).toBe(1);
  });
});

describe('buildGrammar', () => {
  it('numbers points per lesson and maps every old uid', () => {
    const { file, map } = buildGrammar({ 1: [spec(['n5-grammar-2-1']), spec(['n5-grammar-1-1', 'n5-grammar-1-2'], 'merged')] }, [
      'n5-grammar-1-1',
      'n5-grammar-1-2',
      'n5-grammar-2-1',
    ]);
    expect(file[1].map((r) => [r.uid, r.title])).toEqual([
      ['n5-grammar-1-1', 'T'],
      ['n5-grammar-1-2', 'merged'],
    ]);
    expect(map).toEqual({ 'n5-grammar-2-1': 'n5-grammar-1-1', 'n5-grammar-1-1': 'n5-grammar-1-2', 'n5-grammar-1-2': 'n5-grammar-1-2' });
    expect(file[1][0]).not.toHaveProperty('replaces');
  });

  it('refuses a missing, unknown or doubly replaced old uid', () => {
    expect(() => buildGrammar({ 1: [spec([])] }, ['n5-grammar-1-1'])).toThrow(/missing n5-grammar-1-1/);
    expect(() => buildGrammar({ 1: [spec(['n5-grammar-9-9'])] }, [])).toThrow(/unknown n5-grammar-9-9/);
    expect(() => buildGrammar({ 1: [spec(['n5-grammar-1-1']), spec(['n5-grammar-1-1'])] }, ['n5-grammar-1-1'])).toThrow(/twice/);
  });
});

describe('packUidMap', () => {
  it('drops the prefix and unchanged uids', () => {
    expect(packUidMap({ 'n5-vocab-1-1': 'n5-vocab-2-1', 'n5-vocab-1-2': 'n5-vocab-1-2' }, 'n5-vocab-')).toBe('1-1>2-1');
    expect(() => packUidMap({ 'n4-vocab-1-1': 'n4-vocab-1-2' }, 'n5-vocab-')).toThrow(/lacks/);
  });
});

describe('applyVocabExamples', () => {
  const file = () => ({ 1: [row('n5-vocab-1-1', { word: 'わたし', exampleJp: 'old', exampleEn: 'old' }), row('n5-vocab-1-2', { word: 'あなた' })] });

  it('rewrites only the examples, and is idempotent', () => {
    const f = file();
    expect(applyVocabExamples(f, { 'n5-vocab-1-1': ['わたし', 'わたしはアンナです。', "I'm Anna."] })).toBe(1);
    expect(f[1][0]).toMatchObject({ word: 'わたし', exampleJp: 'わたしはアンナです。', exampleEn: "I'm Anna." });
    expect(applyVocabExamples(f, { 'n5-vocab-1-1': ['わたし', 'わたしはアンナです。', "I'm Anna."] })).toBe(0);
  });

  it('refuses a missing row or a different word', () => {
    expect(() => applyVocabExamples(file(), { 'n5-vocab-9-9': ['x', 'a', 'b'] })).toThrow(/no such row/);
    expect(() => applyVocabExamples(file(), { 'n5-vocab-1-2': ['わたし', 'a', 'b'] })).toThrow(/expected わたし/);
  });
});
