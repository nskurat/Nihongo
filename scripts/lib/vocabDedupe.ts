import { glossesOverlap, stripAnnotation } from './jlptContent';

/**
 * Pure rules for removing redundant vocab rows (scripts/dedupe-vocab.ts).
 * Unit-tested in grammar-app/src/utils/__tests__/vocabDedupe.test.ts.
 */

export interface DedupeRow {
  level: string; // 'N5'..'N1'
  lesson: number;
  index: number; // 0-based position in its lesson
  word: string;
  reading: string;
  meaning: string;
  exampleJp?: string;
}

/** Lemma lookup for ます rows (the search index's masuToDict, injected to keep this pure). */
export type MasuLemmaFn = (word: string, reading: string) => { lemma: string; lemmaReading: string } | null;

/**
 * Rows that look like a duplicate by form but teach a different word or sense; reviewed by
 * hand. Keyed by `${level}:${word}` of the row that would otherwise be removed.
 */
export const KEEP_DISTINCT = new Set<string>([
  'N3:ある', // 連体詞 "a certain…", not あります "to have"
  'N5:やる', // "to do", vs textbook やります "to give (to a junior)"
  'N3:吹く', // "to play (an instrument)", vs textbook 吹きます "(wind) blows"
]);

const LEVEL_ORDER = ['N5', 'N4', 'N3', 'N2', 'N1'];

const notes = (word: string): string => (word.match(/[[［(（][^\]］)）]*[\]］)）]/g) ?? []).join('');
const bare = (s: string): string => stripAnnotation(s).replace(/\s/g, '');

/** Identity of a lexeme + usage: dictionary form | reading | 〜 affix marker | bracket notes. */
export function lexemeKey(row: Pick<DedupeRow, 'word' | 'reading'>, masuLemma: MasuLemmaFn): string {
  const w = bare(row.word);
  const affix = /^[〜～]|[〜～]$/.test(w) ? '〜' : '';
  const surface = w.replace(/[〜～]/g, '');
  const reading = bare(row.reading).replace(/[〜～]/g, '');
  const m = surface.endsWith('ます') ? masuLemma(surface, reading) : null;
  return `${m ? m.lemma : surface}|${m ? m.lemmaReading : reading}|${affix}|${notes(row.word)}`;
}

const order = (a: DedupeRow, b: DedupeRow): number =>
  LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) || a.lesson - b.lesson || a.index - b.index;

export interface Removal {
  row: DedupeRow;
  keptBy: DedupeRow;
}

/**
 * Within each lexeme group keep the first textbook row (it has an example sentence),
 * else the first row; remove
 *  - list-derived rows (no example) of the same lexeme, unless listed in KEEP_DISTINCT;
 *  - textbook rows that repeat the kept row's exact word with an overlapping meaning
 *    (かけます "call" vs かけます "put on glasses" both stay).
 */
export function findRedundant(rows: DedupeRow[], masuLemma: MasuLemmaFn): Removal[] {
  const groups = new Map<string, DedupeRow[]>();
  for (const r of rows) {
    const k = lexemeKey(r, masuLemma);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const out: Removal[] = [];
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    g.sort(order);
    const keep = g.find((r) => r.exampleJp) ?? g[0];
    for (const r of g) {
      if (r === keep) continue;
      const listRow = !r.exampleJp;
      if (listRow && !KEEP_DISTINCT.has(`${r.level}:${bare(r.word)}`)) out.push({ row: r, keptBy: keep });
      else if (!listRow && r.word.trim() === keep.word.trim() && glossesOverlap(r.meaning, keep.meaning)) {
        out.push({ row: r, keptBy: keep });
      }
    }
  }
  return out.sort((a, b) => order(a.row, b.row));
}
