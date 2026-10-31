import { readFileSync, writeFileSync } from 'node:fs';
import { masuToDict } from '../grammar-app/src/services/search/keys/masuToDict';
import { stripAnnotation } from './lib/jlptContent';
import { findRedundant, type DedupeRow } from './lib/vocabDedupe';

/**
 * Removes redundant vocab rows across N5–N1 — the same word taught twice, typically a
 * textbook ます form (食べます, with an example) plus a list-derived dictionary form
 * (食べる, no example). Rules: scripts/lib/vocabDedupe.ts.
 *
 *   npx tsx scripts/dedupe-vocab.ts [--dry-run]
 *
 * Removing a row shifts the positional uids after it in that lesson; they are renumbered,
 * and the first shifted position per lesson is printed so the AI-cache migration
 * (store/aiCacheMigration.ts) can drop notes cached under shifted uids.
 * Kept rows still cover every removed word, so the other content scripts don't re-add them.
 */

interface Vocab extends Record<string, unknown> {
  uid: string;
  lesson: number;
  word: string;
  reading: string;
  meaning: string;
  pos?: string;
  exampleJp?: string;
}

const DRY = process.argv.includes('--dry-run');
const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
const path = (lv: string) => `grammar-app/src/data/${lv.toLowerCase()}/vocab.json`;
const files = Object.fromEntries(LEVELS.map((lv) => [lv, JSON.parse(readFileSync(path(lv), 'utf-8')) as Record<string, Vocab[]>]));

const rows: DedupeRow[] = [];
const posOf = new Map<string, string | undefined>();
for (const lv of LEVELS) {
  for (const [lesson, items] of Object.entries(files[lv])) {
    items.forEach((v, index) => {
      rows.push({ level: lv, lesson: Number(lesson), index, word: v.word, reading: v.reading, meaning: v.meaning, exampleJp: v.exampleJp });
      posOf.set(`${lv}|${lesson}|${index}`, v.pos);
    });
  }
}
const corpus = new Set(rows.map((r) => stripAnnotation(r.word).replace(/[〜～\s]/g, '')));
const removals = findRedundant(rows, (word, reading) => masuToDict(word, reading, undefined, corpus));

const shifted: string[] = [];
const byLesson = new Map<string, Set<number>>();
for (const { row, keptBy } of removals) {
  console.log(`  - ${row.level} L${row.lesson} ${row.word} (${row.meaning})  ⇐ ${keptBy.level} L${keptBy.lesson} ${keptBy.word}`);
  const k = `${row.level}|${row.lesson}`;
  byLesson.set(k, new Set([...(byLesson.get(k) ?? []), row.index]));
}
for (const [k, drop] of byLesson) {
  const [lv, lesson] = k.split('|');
  const items = files[lv][lesson];
  shifted.push(`${lv.toLowerCase()}-vocab-${lesson}-${Math.min(...drop) + 1}`);
  files[lv][lesson] = items
    .filter((_, i) => !drop.has(i))
    .map((v, i) => ({ ...v, uid: `${lv.toLowerCase()}-vocab-${lesson}-${i + 1}` }));
}
console.log(`removed ${removals.length} redundant rows in ${byLesson.size} lessons`);
console.log(`first shifted uid per lesson: ${JSON.stringify(shifted.sort())}`);
if (!DRY) for (const lv of LEVELS) writeFileSync(path(lv), `${JSON.stringify(files[lv], null, 2)}\n`);
