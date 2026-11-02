import { describe, expect, it } from 'vitest';
import {
  candidateEntries,
  chooseSense,
  indexEntries,
  lookupForm,
  mapSenseTags,
  matchRow,
  posCode,
  type JmdictEntry,
} from '../../../../scripts/lib/jmdictPos';
import { isPosValue } from '../../../../scripts/lib/vocabPos';

const entry = (seq: number, k: string[], r: string[], ...s: [string[], string][]): JmdictEntry => ({
  seq,
  k,
  r,
  s: s.map(([p, g]) => ({ p, g })),
});

const ENTRIES: JmdictEntry[] = [
  entry(1, ['吹く'], ['ふく'], [['v5k', 'vi'], 'to blow (of the wind)'], [['v5k', 'vt'], 'to play (a wind instrument); to whistle']),
  entry(2, ['掛ける'], ['かける'], [['v1', 'vt'], 'to hang up; to put on']),
  entry(3, ['駆ける'], ['かける'], [['v1', 'vi'], 'to run; to dash']),
  entry(4, ['欠ける'], ['かける'], [['v1', 'vi'], 'to be chipped; to be lacking']),
  entry(5, [], ['かける'], [['v5r'], 'to bet']),
  entry(6, ['帰国'], ['きこく'], [['n', 'vs', 'vi'], 'return to one’s country']),
  entry(7, ['温暖'], ['おんだん'], [['adj-na', 'n'], 'warm; mild']),
  entry(8, ['今日'], ['きょう'], [['n', 'adv'], 'today; this day']),
  entry(9, ['再'], ['さい'], [['pref'], 're-; again']),
  entry(10, ['信ずる'], ['しんずる'], [['vz', 'vt'], 'to believe']),
  entry(11, ['何時'], ['いつ'], [['pn'], 'when; how soon']),
  entry(12, ['入る'], ['はいる'], [['v5r', 'vi'], 'to enter']),
  entry(13, ['出る'], ['でる'], [['v1', 'vi'], 'to leave; to exit']),
  entry(14, ['何時も'], ['いつも'], [['adv', 'n'], 'always']),
  entry(15, ['可愛い'], ['かわいい'], [['adj-i'], 'cute']),
];
const INDEX = indexEntries(ENTRIES);
const row = (word: string, reading: string, meaning: string) => ({ word, reading, meaning });

describe('JMdict pos codes', () => {
  it('maps jamdict descriptions to JMdict codes and refuses unknown ones', () => {
    expect(posCode('noun (common) (futsuumeishi)')).toBe('n');
    expect(posCode("Godan verb with 'ku' ending")).toBe('v5k');
    expect(posCode('adjectival nouns or quasi-adjectives (keiyodoshi)')).toBe('adj-na');
    expect(posCode("Yodan verb with 'ru' ending (archaic)")).toBe('v4');
    expect(() => posCode('verb of mystery')).toThrow();
  });
});

describe('JMdict tags → closed pos set', () => {
  it('maps conjugation classes', () => {
    expect(mapSenseTags(['v5k', 'vt'])).toBe('verb-godan');
    expect(mapSenseTags(['v5k-s'])).toBe('verb-godan');
    expect(mapSenseTags(['v1'])).toBe('verb-ichidan');
    expect(mapSenseTags(['vs-i'])).toBe('verb-irregular');
    expect(mapSenseTags(['vk'])).toBe('verb-irregular');
    expect(mapSenseTags(['adj-i'])).toBe('i-adjective');
    expect(mapSenseTags(['adj-ix'])).toBe('i-adjective');
  });

  it('ranks na-adjective over noun over adverb, whatever order JMdict lists them in', () => {
    expect(mapSenseTags(['n', 'adj-na'])).toBe('na-adjective');
    expect(mapSenseTags(['adv', 'n'])).toBe('noun');
    expect(mapSenseTags(['adv', 'adv-to', 'vs'])).toBe('adverb');
    expect(mapSenseTags(['n', 'vs'])).toBe('noun');
  });

  it('maps function words, expressions and affixes', () => {
    expect(mapSenseTags(['adj-pn'])).toBe('determiner');
    expect(mapSenseTags(['pn'])).toBe('pronoun');
    expect(mapSenseTags(['prt'])).toBe('particle');
    expect(mapSenseTags(['conj'])).toBe('conjunction');
    expect(mapSenseTags(['int'])).toBe('interjection');
    expect(mapSenseTags(['exp', 'n'])).toBe('expression');
    expect(mapSenseTags(['n-suf'])).toBe('suffix');
    expect(mapSenseTags(['ctr'])).toBe('suffix');
  });

  it('labels prefixes, and a noun that is also a prefix as a noun', () => {
    expect(mapSenseTags(['pref'])).toBe('prefix');
    expect(mapSenseTags(['n-pref'])).toBe('prefix');
    expect(mapSenseTags(['n', 'pref'])).toBe('noun');
  });

  it('has no value for auxiliaries or archaic verb classes', () => {
    expect(mapSenseTags(['aux-v'])).toBeNull();
    expect(mapSenseTags(['vz', 'vt'])).toBeNull();
    expect(mapSenseTags(['v4'])).toBeNull();
    expect(mapSenseTags(['adj-f'])).toBeNull();
    expect(mapSenseTags([])).toBeNull();
  });
});

describe('row lookup', () => {
  it('labels a prefix row', () => {
    expect(matchRow(row('再', 'さい', 're-'), INDEX)).toMatchObject({ status: 'matched', pos: 'prefix' });
  });

  it('prefers the sense sharing a whole word over a shared stem (キロ "Kilogram" is a noun)', () => {
    const kilo = entry(20, [], ['キロ'], [['pref'], 'kilo-; 1000'], [['n'], 'kilogram; kilogramme']);
    expect(chooseSense(kilo, 'Kilogram')?.p).toEqual(['n']);
    expect(chooseSense(kilo, 'kilo-')?.p).toEqual(['pref']);
  });

  it('strips usage notes, 〜 and trailing punctuation', () => {
    expect(lookupForm('迷う [道に〜]')).toBe('迷う');
    expect(lookupForm('〜先')).toBe('先');
    expect(lookupForm('お先にどうぞ。')).toBe('お先にどうぞ');
  });

  it('finds kanji spellings by reading and kana words by reading', () => {
    expect(candidateEntries('吹く', 'ふく', INDEX).map((e) => e.seq)).toEqual([1]);
    expect(candidateEntries('かける', 'かける', INDEX).map((e) => e.seq)).toEqual([2, 3, 4, 5]);
    expect(candidateEntries('吹く', 'すう', INDEX)).toEqual([]);
  });

  it('lets a JLPT-list id pick the entry, also for a respelled word', () => {
    expect(candidateEntries('かける', 'かける', INDEX, [3]).map((e) => e.seq)).toEqual([3]);
    expect(candidateEntries('いつも', 'いつも', INDEX, [14]).map((e) => e.seq)).toEqual([14]);
  });

  it('picks the sense whose glosses fit the row, else the first', () => {
    expect(chooseSense(ENTRIES[0], 'to play (a flute)')?.p).toEqual(['v5k', 'vt']);
    expect(chooseSense(ENTRIES[0], 'zzz')?.p).toEqual(['v5k', 'vi']);
  });
});

describe('matchRow', () => {
  it('labels a plain word', () => {
    expect(matchRow(row('吹く', 'ふく', 'to blow'), INDEX)).toMatchObject({ status: 'matched', pos: 'verb-godan' });
    expect(matchRow(row('今日', 'きょう', 'today'), INDEX)).toMatchObject({ status: 'matched', pos: 'noun' });
  });

  it('settles homographs by gloss, and reports them when glosses do not', () => {
    expect(matchRow(row('かける', 'かける', 'to bet'), INDEX)).toMatchObject({ status: 'matched', pos: 'verb-godan' });
    expect(matchRow(row('かける', 'かける', 'to hang'), INDEX)).toMatchObject({ status: 'matched', pos: 'verb-ichidan' });
    expect(matchRow(row('かける', 'かける', 'speak to'), INDEX)).toEqual({
      status: 'ambiguous',
      options: ['verb-godan', 'verb-ichidan'],
      seqs: [2, 3, 4, 5],
    });
  });

  it('derives する verbs and な adjectives from their JMdict stem', () => {
    expect(matchRow(row('帰国する', 'きこくする', 'return home'), INDEX)).toMatchObject({ status: 'matched', pos: 'verb-irregular' });
    expect(matchRow(row('温暖な', 'おんだんな', 'mild'), INDEX)).toMatchObject({ status: 'matched', pos: 'na-adjective' });
    expect(matchRow(row('今日な', 'きょうな', 'x'), INDEX).status).toBe('unmatched');
  });

  it('labels question words as interrogative only when the row asks a question', () => {
    expect(matchRow(row('何時', 'いつ', 'when'), INDEX)).toMatchObject({ status: 'matched', pos: 'interrogative' });
  });

  it('labels each part of a ／ pair', () => {
    expect(matchRow(row('入る／出る', 'はいる／でる', 'to enter / to leave'), INDEX)).toMatchObject({
      status: 'matched',
      pos: 'verb-godan / verb-ichidan',
    });
    expect(matchRow(row('掛ける／欠ける', 'かける／かける', 'to hang'), INDEX)).toMatchObject({ pos: 'verb-ichidan' });
  });

  it('never guesses', () => {
    expect(matchRow(row('信ずる', 'しんずる', 'to believe'), INDEX)).toMatchObject({ status: 'unmatched' });
    expect(matchRow(row('宇宙列車', 'うちゅうれっしゃ', 'space train'), INDEX)).toMatchObject({
      status: 'unmatched',
      reason: 'no JMdict entry',
    });
  });

  it('only produces values the content validator accepts', () => {
    for (const r of [row('吹く', 'ふく', 'x'), row('入る／出る', 'はいる／でる', 'x'), row('温暖な', 'おんだんな', 'mild')]) {
      const m = matchRow(r, INDEX);
      if (m.status === 'matched') expect(isPosValue(m.pos)).toBe(true);
    }
    expect(mapSenseTags(['n'])).not.toBeNull();
    expect(isPosValue(String(mapSenseTags(['adj-pn'])))).toBe(true);
  });
});
