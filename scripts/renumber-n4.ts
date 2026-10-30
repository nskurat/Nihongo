import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * One-time migration: N4 lessons were numbered 26-50 (continuing from N5's
 * 1-25); this renumbers them 1-25 so every level is independently 1-based.
 *
 * Rewrites, in n4/{grammar,vocab,kanji}.json: lesson keys, `lesson` and `uid`.
 * Rewrites, in grammar.json text only: cross-references to lessons, e.g.
 * "Lesson 35-4", "(L41)", bare "37-2". In N4 text a number 1-25 used to mean an
 * N5 lesson (unambiguous because N4 started at 26) - those get an explicit "N5"
 * prefix, since a bare "Lesson 23" now means N4's lesson 23.
 *
 * Not idempotent; refuses to run if N4 is already renumbered.
 */

const OFFSET = 25;
const DATA_DIR = 'grammar-app/src/data';

type Item = Record<string, unknown>;
type Chunk = Record<string, Item[]>;

const read = (path: string): Chunk => JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf-8'));
const write = (path: string, data: Chunk): void =>
  writeFileSync(resolve(process.cwd(), path), `${JSON.stringify(data, null, 2)}\n`, 'utf-8');

const isN4Lesson = (n: number): boolean => n >= 26 && n <= 50;
const shift = (n: number): number => (isN4Lesson(n) ? n - OFFSET : n);

// Irregular references that the patterns below can't handle, fixed by hand first.
const N4_LITERALS: Array<[string, string]> = [
  // "Book I" is MNN-specific wording; these are N5 lessons.
  ['same principle as Lessons 10 & 17 in Book I', 'same principle as N5 Lessons 10 & 17'],
  ['rule from Book I (Lessons 10 & 17)', 'rule from N5 Lessons 10 & 17'],
  // Mixed N5 + N4 span.
  ['used in Lessons 19 and 44-3', 'used in N5 Lesson 19 and N4 Lesson 19-3'],
  // Pre-existing error: ために is taught in 42 (see n4-grammar-42-1), not 32.
  ['Unlike 〜ために (Lesson 32)', 'Unlike 〜ために (Lesson 42)'],
];

const N3_N5_LITERALS: Array<[string, string]> = [
  // N5 -> N4 range, which the single-number pattern below would half-convert.
  ['N4 Lessons 49-50', 'N4 Lessons 24-25'],
  // Dangling pointer: N4 never had a Lesson 1-1, and no N4 item covers てくる/ていく.
  [
    ' — the same pattern as N4 Lesson 1-1, applied here to abstract/temporal change rather than physical direction.',
    ', applied here to abstract/temporal change rather than physical direction.',
  ],
  [
    "See N4 Lesson 1-1's details table for the fuller spatial/temporal breakdown of てくる vs ていく.\n\n",
    '',
  ],
  // Reversed word order ("Lesson 26 in N4"), not matched by the "N4 Lesson" pattern.
  ['Lesson 26 in N4', 'Lesson 1 in N4'],
  ['Lesson 43/47 in the N4 grammar set', 'Lesson 18/22 in the N4 grammar set'],
];

function applyLiterals(text: string, literals: Array<[string, string]>): string {
  let out = text;
  for (const [from, to] of literals) out = out.split(from).join(to);
  return out;
}

// "Lesson 35-4", "Lessons 43 and 47", "L31-2", "L41"; the number list may chain.
const NUM = String.raw`\d+(?:-\d+)?`;
const LESSON_SPAN = String.raw`(?<!N[45] )(?<![\w])(Lessons?|L)(\s?)(${NUM}(?:\s?(?:/|&|and|,)\s?${NUM})*)(?![\d])`;
// Bare "37-2" style references to an N4 grammar point.
const BARE = String.raw`(?<![\w\-.])((?:2[6-9]|3\d|4\d|50)-\d{1,2})(?![\d\w-])`;
const N4_REF = new RegExp(`${LESSON_SPAN}|${BARE}`, 'g');

function rewriteN4Text(text: string): string {
  return applyLiterals(text, N4_LITERALS).replace(
    N4_REF,
    (match, word: string | undefined, space: string, list: string | undefined, bare: string | undefined) => {
      if (bare !== undefined) {
        const [lesson, point] = bare.split('-');
        return `${shift(Number(lesson))}-${point}`;
      }
      const firsts = list!.match(/\d+(?:-\d+)?/g)!.map((token) => Number(token.split('-')[0]));
      if (firsts.every((n) => n <= 25)) return `N5 ${word}${space}${list}`;
      if (firsts.some((n) => n <= 25)) throw new Error(`Mixed N4/N5 lesson list needs a manual literal: "${match}"`);
      return `${word}${space}${list!.replace(/\d+/, (n) => String(shift(Number(n)))).replace(
        /(\/|&|and|,)(\s?)(\d+)/g,
        (_m, sep: string, sp: string, n: string) => `${sep}${sp}${shift(Number(n))}`
      )}`;
    }
  );
}

// "N4 Lesson 35-4", "N4 Lessons 26 and 35" inside N3/N5 text; only the lesson
// number (not the point after the hyphen) can shift. N3's own refs are untouched.
const N4_FROM_OTHER = new RegExp(
  String.raw`(N4 Lessons? )(\d+)((?:-\d+)?)((?:\s(?:and|&)\s)(\d+)((?:-\d+)?))?`,
  'g'
);

function rewriteOtherLevelText(text: string): string {
  return applyLiterals(text, N3_N5_LITERALS).replace(
    N4_FROM_OTHER,
    (_m, head: string, a: string, aPoint: string, tail: string | undefined, b: string | undefined, bPoint: string | undefined) => {
      const first = `${head}${shift(Number(a))}${aPoint}`;
      return tail ? `${first}${tail.replace(/\d+(?:-\d+)?$/, `${shift(Number(b))}${bPoint}`)}` : first;
    }
  );
}

function mapStrings(value: unknown, fn: (s: string) => string, skipKeys: string[] = []): unknown {
  if (typeof value === 'string') return fn(value);
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn, skipKeys));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, skipKeys.includes(k) ? v : mapStrings(v, fn, skipKeys)])
    );
  }
  return value;
}

function renumberN4(section: 'grammar' | 'vocab' | 'kanji', rewriteText: boolean): void {
  const path = `${DATA_DIR}/n4/${section}.json`;
  const data = read(path);
  if (Object.keys(data)[0] !== '26') throw new Error(`${path} does not start at lesson 26; already migrated?`);

  const out: Chunk = {};
  for (const key of Object.keys(data)) {
    const lesson = Number(key) - OFFSET;
    out[String(lesson)] = data[key].map((item, index) => {
      const next = rewriteText ? (mapStrings(item, rewriteN4Text, ['uid', 'level', 'section']) as Item) : item;
      return { ...next, uid: `n4-${section}-${lesson}-${index + 1}`, lesson };
    });
  }
  write(path, out);
  console.log(`Renumbered ${path}`);
}

function rewriteOtherLevel(level: 'n3' | 'n5'): void {
  const path = `${DATA_DIR}/${level}/grammar.json`;
  const data = read(path);
  const out: Chunk = {};
  for (const key of Object.keys(data)) {
    out[key] = data[key].map((item) => mapStrings(item, rewriteOtherLevelText, ['uid', 'level', 'section']) as Item);
  }
  write(path, out);
  console.log(`Rewrote N4 references in ${path}`);
}

renumberN4('grammar', true);
renumberN4('vocab', false);
renumberN4('kanji', false);
rewriteOtherLevel('n3');
rewriteOtherLevel('n5');
