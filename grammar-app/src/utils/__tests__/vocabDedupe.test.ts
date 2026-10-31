import { describe, expect, it } from 'vitest';
import { findRedundant, lexemeKey, type DedupeRow } from '../../../../scripts/lib/vocabDedupe';

const masu = (w: string, r: string) =>
  w === '食べます' ? { lemma: '食べる', lemmaReading: r.replace('ます', 'る') }
  : w === 'あります' ? { lemma: 'ある', lemmaReading: 'ある' }
  : w === 'かけます' ? { lemma: 'かける', lemmaReading: 'かける' }
  : null;
let n = 0;
const row = (level: string, lesson: number, word: string, reading: string, meaning: string, ex = false): DedupeRow => ({
  level, lesson, index: n++, word, reading, meaning, ...(ex ? { exampleJp: '例' } : {}),
});

describe('lexemeKey', () => {
  it('maps ます rows to their dictionary form and separates 〜 affixes and notes', () => {
    expect(lexemeKey({ word: '食べます', reading: 'たべます' }, masu)).toBe(lexemeKey({ word: '食べる', reading: 'たべる' }, masu));
    expect(lexemeKey({ word: '〜先', reading: 'さき' }, masu)).not.toBe(lexemeKey({ word: '先', reading: 'さき' }, masu));
    expect(lexemeKey({ word: '取る [写真を〜]', reading: 'とる' }, masu)).not.toBe(lexemeKey({ word: '取る [時間を〜]', reading: 'とる' }, masu));
  });
});

describe('findRedundant', () => {
  it('removes a list row taught elsewhere, keeping the textbook row even if later', () => {
    const rows = [row('N5', 7, '食べる', 'たべる', 'to eat'), row('N5', 6, '食べます', 'たべます', 'eat', true)];
    expect(findRedundant(rows, masu).map((r) => r.row.word)).toEqual(['食べる']);
  });
  it('keeps reviewed distinct senses and textbook homographs with different meanings', () => {
    const rows = [
      row('N5', 9, 'あります', 'あります', 'have', true),
      row('N3', 12, 'ある', 'ある', 'a certain...'),
      row('N5', 7, 'かけます', 'かけます', 'make [a telephone call]', true),
      row('N5', 22, 'かけます', 'かけます', 'put on [glasses]', true),
    ];
    expect(findRedundant(rows, masu)).toEqual([]);
  });
  it('removes an identical textbook repeat with the same meaning', () => {
    const rows = [row('N4', 15, '必要', 'ひつよう', 'necessary', true), row('N3', 2, '必要', 'ひつよう', 'necessity', true)];
    expect(findRedundant(rows, masu).map((r) => `${r.row.level}:${r.row.word}`)).toEqual(['N3:必要']);
  });
});
