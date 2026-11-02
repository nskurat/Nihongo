import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Guard for the textbook rewrite (docs/content/n5-restructure.md): grammar rewritten in our
 * own words must not drift back to Minna no Nihongo's text. Two checks per guarded level:
 *
 *  - no example sentence equals a numbered example from the book's grammar notes. The book
 *    sentences are stored only as truncated SHA-256 hashes of their normalised text, so the
 *    repo does not republish them; add hashes as more pages are checked;
 *  - no grammar row and no vocab example uses the book's cast or its fictional places.
 *
 * Add a level here once its grammar has been rewritten (N4, N3 are next; backlog §4).
 */
const GUARDED_LEVELS = ['n5'] as const;

/** Book II grammar notes, Lessons 27 and 35 (spot-checked 2026-11-02). */
const BOOK_SENTENCE_HASHES = new Set([
  '89c79dba1c2a1964', 'c3d92a73c638e634', '356795f9038e4966', '75dfbe26283cea09', '0a94ef7928276eef',
  'cd9195a7195f9525', 'f6323d8d103e10a3', 'df2a054e4e389c47', '03da393a6fbfc3a3', '62a02bbb6daf19f5',
  '836df4ec40181f6d', '9d03637b71b37fcf', '467a9df7598fee6a', 'd224044bd164f9ed', '166488ea47f9359a',
  'd5149572a4b2386a', '1281eff82b192d6d', '34f4289f6224a088', '677e1cd7e140c9af', '4752148c3b472b07',
  'c730f06e7afee5ad', '383290d9d905e9bf', 'f3286efea77ac5e4', '40060c2efffa694b', '24f201aa2e7918be',
  '556c138841daec5d', 'c0a4448385202088',
]);

/** The book's recurring characters, companies and schools. Common Japanese surnames are not listed. */
const BOOK_CAST = [
  'ミラー', 'サントス', 'ワット', 'カリナ', 'シュミット', 'グプタ', 'タワポン', 'イー・ジンジュ', 'ワン・シュエ',
  'テレーザ', 'IMC', 'パワー電気', 'さくら大学', '富士大学', 'アップル銀行', '神戸病院', 'ブラジルエアー',
];

const normalise = (s: string) => s.normalize('NFKC').replace(/[\s\u3000、。,.…！？!?「」]/g, '');
const sentenceHash = (s: string) => createHash('sha256').update(normalise(s)).digest('hex').slice(0, 16);

interface GrammarRow {
  uid: string;
  title: string;
  structure: string;
  meaning: string;
  explanation: string;
  summary?: string;
  details?: string;
  note?: string;
  examples?: { jp: string; en: string }[];
}

const vocabExamples = (level: string): { uid: string; text: string }[] =>
  Object.values(
    JSON.parse(readFileSync(resolve(__dirname, `../data/${level}/vocab.json`), 'utf-8')) as Record<
      string,
      { uid: string; exampleJp?: string; exampleEn?: string }[]
    >
  )
    .flat()
    .map((r) => ({ uid: r.uid, text: `${r.exampleJp ?? ''} ${r.exampleEn ?? ''}` }));

const grammar = (level: string): GrammarRow[] =>
  Object.values(
    JSON.parse(readFileSync(resolve(__dirname, `../data/${level}/grammar.json`), 'utf-8')) as Record<string, GrammarRow[]>
  ).flat();

/** Each example split into its sentences (dialogue examples hold two). */
const sentences = (row: GrammarRow) => (row.examples ?? []).flatMap((e) => e.jp.split(/[。…]+/)).filter((s) => s.trim());

describe('textbook guard', () => {
  it('hashes a sentence the way the stored hashes were made', () => {
    expect(sentenceHash('わたしは日本語が話せます。')).toBe('c3d92a73c638e634');
    expect(sentenceHash('わたしは 日本語が 話せます')).toBe('c3d92a73c638e634');
  });

  for (const level of GUARDED_LEVELS) {
    it(`${level}: no example sentence is one of the book's`, () => {
      const hits = grammar(level).flatMap((row) => sentences(row).filter((s) => BOOK_SENTENCE_HASHES.has(sentenceHash(s))).map((s) => `${row.uid}: ${s}`));
      expect(hits).toEqual([]);
    });

    it(`${level}: no grammar row uses the book's cast or places`, () => {
      const hits = grammar(level).flatMap((row) => {
        const text = [row.title, row.structure, row.meaning, row.explanation, row.summary, row.details, row.note, ...sentences(row)].join(' ');
        return BOOK_CAST.filter((name) => text.includes(name)).map((name) => `${row.uid}: ${name}`);
      });
      expect(hits).toEqual([]);
    });

    it(`${level}: no vocab example uses the book's cast or places`, () => {
      const hits = vocabExamples(level).flatMap((r) => BOOK_CAST.filter((name) => r.text.includes(name)).map((name) => `${r.uid}: ${name}`));
      expect(hits).toEqual([]);
    });
  }
});
