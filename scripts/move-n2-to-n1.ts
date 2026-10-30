import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * One-time migration (N2/N1 build-out): moves the two N2 points that the N1 lists
 * (OpenJLPT, jlptsensei) place at N1 into the N1 deck, each as the first point of
 * the N1 lesson it anchors. Run before adding the new N1 points.
 *
 * Within N2, only Lesson 8 shifts (〜においては moves from 8-3 to 8-2); 〜に至るまで
 * was the last point of Lesson 10. Not idempotent: each uid must still carry the
 * expected title. Pass --dry-run to print the plan without writing.
 */

type Item = Record<string, unknown> & { uid: string; title: string; level: string; lesson: number };
type Chunk = Record<string, Item[]>;

const N2_FILE = resolve('grammar-app/src/data/n2/grammar.json');
const N1_FILE = resolve('grammar-app/src/data/n1/grammar.json');
const dryRun = process.argv.includes('--dry-run');

const MOVES: Record<string, { title: string; lesson: number }> = {
  'n2-grammar-8-2': { title: 'をもって', lesson: 11 },
  'n2-grammar-10-2': { title: 'に至るまで', lesson: 27 },
};

const n2 = JSON.parse(readFileSync(N2_FILE, 'utf8')) as Chunk;
const n1 = JSON.parse(readFileSync(N1_FILE, 'utf8')) as Chunk;

for (const [uid, move] of Object.entries(MOVES)) {
  const lesson = uid.split('-')[2];
  const item = n2[lesson]?.find((candidate) => candidate.uid === uid);
  if (!item?.title.includes(move.title)) throw new Error(`${uid}: expected "${move.title}" (already moved?)`);
  n2[lesson] = n2[lesson].filter((candidate) => candidate !== item);
  if (n1[move.lesson]?.length) throw new Error(`N1 Lesson ${move.lesson} is not empty`);
  n1[move.lesson] = [{ ...item, uid: `n1-grammar-${move.lesson}-1`, level: 'N1', lesson: move.lesson }];
  console.log(`${uid} -> n1-grammar-${move.lesson}-1  ${item.title}`);
}

for (const [lesson, items] of Object.entries(n2)) {
  items.forEach((item, n) => (item.uid = `n2-grammar-${lesson}-${n + 1}`));
}

const sorted = (chunk: Chunk): Chunk =>
  Object.fromEntries(Object.keys(chunk).map(Number).sort((a, b) => a - b).map((k) => [String(k), chunk[k]]));

if (!dryRun) {
  writeFileSync(N2_FILE, `${JSON.stringify(n2, null, 2)}\n`);
  writeFileSync(N1_FILE, `${JSON.stringify(sorted(n1), null, 2)}\n`);
}
