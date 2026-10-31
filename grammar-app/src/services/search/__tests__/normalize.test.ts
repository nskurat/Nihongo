import { describe, expect, it } from 'vitest';
import { findKeyRanges, foldLong, hasKanji, isKana, kanjiChars, kataToHira, key, norm } from '../normalize';
import { romajiToKana, isLatin } from '../romaji';

describe('norm / key', () => {
  it('folds katakana, full-width and tildes', () => {
    expect(kataToHira('タクシー')).toBe('たくしー');
    expect(norm('ＡＢＣ　ﾀｸｼｰ')).toBe('abc たくしー');
    for (const s of ['〜ばかりか', '~ばかりか', '～ばかりか', 'ばかりか']) expect(key(s)).toBe('ばかりか');
    expect(key('まよ・う')).toBe('まよう');
    expect(key('連れて 行きます')).toBe('連れて行きます');
  });

  it('classifies scripts', () => {
    expect(isKana('たくしー')).toBe(true);
    expect(isKana('食べる')).toBe(false);
    expect(hasKanji('食べる')).toBe(true);
    expect(kanjiChars('迷惑々を')).toEqual(['迷', '惑']);
  });
});

describe('foldLong', () => {
  it('drops long-vowel marks after the matching row', () => {
    expect(foldLong('きょうしつ')).toBe('きょしつ');
    expect(foldLong('きょしつ')).toBe('きょしつ');
    expect(foldLong('とうきょう')).toBe(foldLong('ときょ'));
    expect(foldLong('とおきょお')).toBe(foldLong('とうきょう'));
    expect(foldLong('せんせい')).toBe('せんせ');
    expect(foldLong('らーめん')).toBe('らめん');
    expect(foldLong('おばあさん')).toBe('おばさん');
    // A word-final い/あ is an ending, not a long vowel (teacher F10).
    expect(foldLong('いい')).toBe('いい');
    expect(foldLong('おおきい')).toBe('おきい');
    expect(foldLong('おにいさん')).toBe('おにさん');
  });
});

describe('findKeyRanges', () => {
  it('maps key offsets back to the display string', () => {
    expect(findKeyRanges('〜ばかりか', 'ばかりか')).toEqual([[1, 5]]);
    expect(findKeyRanges('迷う [道に〜]', '迷う')).toEqual([[0, 2]]);
    expect(findKeyRanges('かける [迷惑を〜]', '迷惑')).toEqual([[5, 7]]);
    expect(findKeyRanges('タクシー', 'たくしー')).toEqual([[0, 4]]);
    expect(findKeyRanges('連れて 行きます', 'て行')).toEqual([[2, 5]]);
    expect(findKeyRanges('abc', '')).toEqual([]);
  });
});

describe('romajiToKana', () => {
  const cases: [string, string][] = [
    ['kyoushitsu', 'きょうしつ'],
    ['kyousitu', 'きょうしつ'],
    ['kyōshitsu', 'きょうしつ'],
    ['kyoshitsu', 'きょしつ'],
    ["kan'i", 'かんい'],
    ['kani', 'かに'],
    ['kanni', 'かんに'],
    ['konnichiwa', 'こんにちわ'],
    ['konnnichiha', 'こんにちは'],
    ['minna', 'みんな'],
    ['onna', 'おんな'],
    ['sannen', 'さんねん'],
    ['honn', 'ほん'],
    ['shinbun', 'しんぶん'],
    ['shimbun', 'しんぶん'],
    ['kitte', 'きって'],
    ['matcha', 'まっちゃ'],
    ['maccha', 'まっちゃ'],
    ['jouzu', 'じょうず'],
    ['zyouzu', 'じょうず'],
    ['jya', 'じゃ'],
    ['sya', 'しゃ'],
    ['tya', 'ちゃ'],
    ['fu', 'ふ'],
    ['hu', 'ふ'],
    ['xtu', 'っ'],
    ['ltsu', 'っ'],
    ['wo', 'を'],
    ['ha', 'は'],
    ['tohkyoh', 'とうきょう'],
    ['ra-men', 'らーめん'],
    ['hon', 'ほん'],
    ['taberu', 'たべる'],
    ['arigatou', 'ありがとう'],
  ];
  it.each(cases)('%s → %s', (input, out) => {
    expect(romajiToKana(input)).toBe(out);
  });

  it('leaves English that is not romaji unconverted', () => {
    expect(isKana(romajiToKana('lost'))).toBe(false);
    expect(isKana(romajiToKana('although'))).toBe(false);
    expect(isKana(romajiToKana('comparison'))).toBe(false);
  });

  it('detects Latin queries', () => {
    expect(isLatin(norm('degree/extent'))).toBe(true);
    expect(isLatin(norm("kan'i"))).toBe(true);
    expect(isLatin(norm('ばかり'))).toBe(false);
    expect(isLatin(norm('123'))).toBe(false);
  });
});
