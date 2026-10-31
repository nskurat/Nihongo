import { describe, it, expect } from 'vitest';
import {
  type SourceKanji,
  type SourceWord,
  assignVocabLessons,
  buildCoveredWordIndex,
  buildKanjiItem,
  buildVocabItem,
  cleanKunyomi,
  compareKanjiForTeaching,
  compareWordsByKana,
  groupByLesson,
  hasUsableGloss,
  isWordCovered,
  kanjiMeaning,
  normalizeVocabForms,
  pickCompounds,
  splitEvenly,
  strokeOrderLink,
} from '../../../../scripts/lib/n1-kanji-vocab';

const kanji = (over: Partial<SourceKanji> = {}): SourceKanji => ({
  level: 'N1',
  strokes: 10,
  freq: 100,
  radical: '一 (one)',
  onyomi: [],
  kunyomi: [],
  meanings: ['m'],
  ...over,
});

let seq = 0;
const word = (kanjiForm: string, kana: string, level: SourceWord['level'] = 'N1', meaning = 'gloss'): SourceWord => ({
  level,
  jmdictSeq: (seq += 1),
  kanji: kanjiForm,
  kana,
  meaning,
});

describe('normalizeVocabForms', () => {
  it('strips annotations, splits pairs and drops 〜', () => {
    expect(normalizeVocabForms('迷う [道に〜]')).toEqual(['迷う']);
    expect(normalizeVocabForms('[お]花見')).toEqual(['花見']);
    expect(normalizeVocabForms('近い／遠い')).toEqual(['近い', '遠い']);
    expect(normalizeVocabForms('〜ぐらい')).toEqual(['ぐらい']);
    expect(normalizeVocabForms('本社（ほんしゃ）／支店')).toEqual(['本社', '支店']);
    expect(normalizeVocabForms('親切[な]')).toEqual(['親切']);
  });
});

describe('coverage by lower-level vocab', () => {
  const index = buildCoveredWordIndex([
    { word: '迷う [道に〜]', reading: 'まよう' },
    { word: 'あっさり', reading: 'あっさり' },
    { word: '箸', reading: 'はし' },
  ]);

  it('matches kanji words on their form', () => {
    expect(isWordCovered(word('迷う', 'まよう'), index)).toBe(true);
    expect(isWordCovered(word('迷子', 'まいご'), index)).toBe(false);
  });

  it('matches kana-only words on form or a kana row reading, never a kanji row reading', () => {
    expect(isWordCovered(word('', 'あっさり'), index)).toBe(true);
    expect(isWordCovered(word('', 'はし'), index)).toBe(false);
  });
});

describe('kanji fields', () => {
  it('joins four meanings when short, else three, skipping radical names', () => {
    expect(kanjiMeaning(['one', 'one radical (no. 1)', 'two', 'three', 'four'])).toBe('one, two, three, four');
    expect(kanjiMeaning(['family name', 'surname', 'clan', 'a much longer fourth meaning'])).toBe(
      'family name, surname, clan'
    );
  });

  it('drops prefix and suffix kunyomi', () => {
    expect(cleanKunyomi(['ひと-', 'ひと・つ', '-がわ', 'また'])).toEqual(['ひと・つ', 'また']);
  });

  it('links to the jisho kanji page', () => {
    expect(strokeOrderLink('迷')).toBe('https://jisho.org/search/%E8%BF%B7%23kanji');
  });

  it('builds a positional uid and omits empty compounds', () => {
    const item = buildKanjiItem('迷', kanji({ kunyomi: ['まよ・う', 'まよ-'] }), 3, 2, []);
    expect(item.uid).toBe('n1-kanji-3-2');
    expect(item.kunyomi).toEqual(['まよ・う']);
    expect('compounds' in item).toBe(false);
  });
});

describe('ordering and splitting', () => {
  it('orders by frequency, unranked last, then strokes, then codepoint', () => {
    const entries: Array<[string, SourceKanji]> = [
      ['乙', kanji({ freq: null, strokes: 1 })],
      ['丙', kanji({ freq: 5, strokes: 5 })],
      ['乃', kanji({ freq: 5, strokes: 2 })],
      ['丁', kanji({ freq: 1 })],
      ['乂', kanji({ freq: null, strokes: 1 })],
    ];
    expect(entries.sort(compareKanjiForTeaching).map(([ch]) => ch)).toEqual(['丁', '乃', '丙', '乂', '乙']);
  });

  it('splits into groups differing by at most one, larger first', () => {
    expect(splitEvenly([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([[1, 2, 3], [4, 5], [6, 7]]);
    expect(splitEvenly([1], 2)).toEqual([[1], []]);
  });

  it('sorts words by kana', () => {
    const words = [word('亜', 'い'), word('', 'あ')];
    expect(words.sort(compareWordsByKana).map((w) => w.kana)).toEqual(['あ', 'い']);
  });
});

describe('pickCompounds', () => {
  const words = [
    word('迷う', 'まよう', 'N3'),
    word('迷子', 'まいご', 'N2'),
    word('迷惑', 'めいわく', 'N4'),
    word('迷信', 'めいしん', 'N1'),
    word('低迷', 'ていめい', 'N1'),
    word('混迷', 'こんめい', 'N1', '#NAME?'),
    word('', 'まよい', 'N1'),
  ];

  it('prefers N1 words, then N2..N5, skipping kana-only and unglossed rows', () => {
    expect(pickCompounds('迷', words).map((c) => c.word)).toEqual(['低迷', '迷信', '迷子', '迷う']);
  });

  it('returns nothing when no list word uses the kanji', () => {
    expect(pickCompounds('麟', words)).toEqual([]);
  });

  it('flags broken glosses', () => {
    expect(hasUsableGloss(word('歳', 'さい', 'N1', '#NAME?'))).toBe(false);
    expect(hasUsableGloss(word('', 'はあ', 'N3', ''))).toBe(false);
    expect(hasUsableGloss(word('迷信', 'めいしん'))).toBe(true);
  });
});

describe('assignVocabLessons', () => {
  const kanjiLesson = new Map([
    ['甲', 1],
    ['乙', 2],
  ]);

  it('anchors to the earliest-taught kanji and fills the emptiest lesson otherwise', () => {
    const words = [word('乙甲', 'a'), word('乙', 'b'), word('山', 'c'), word('', 'd')];
    expect(assignVocabLessons(words, kanjiLesson, { lessonCount: 3, cap: 10 })).toEqual([1, 2, 3, 1]);
  });

  it('spills past the cap to the next kanji lesson, then the emptiest later lesson', () => {
    const words = [word('甲', 'a'), word('甲乙', 'b'), word('甲', 'c')];
    expect(assignVocabLessons(words, kanjiLesson, { lessonCount: 3, cap: 1 })).toEqual([1, 2, 3]);
  });

  it('groups into lesson-keyed arrays and builds positional vocab uids', () => {
    const words = [word('甲', 'a'), word('', 'b')];
    const grouped = groupByLesson(words, [2, 2], 2);
    expect(Object.keys(grouped)).toEqual(['1', '2']);
    expect(grouped['1']).toEqual([]);
    expect(buildVocabItem(grouped['2'][1], 2, 2)).toEqual({
      uid: 'n1-vocab-2-2',
      level: 'N1',
      section: 'vocab',
      lesson: 2,
      word: 'b',
      reading: 'b',
      meaning: 'gloss',
    });
  });
});
