import { readFileSync, writeFileSync } from 'node:fs';
import { mirrorNotes } from './lib/readingNotes';

/**
 * Makes every vocab reading mirror its word's bracketed notes in kana
 * (`迷う [道に〜]` → `まよう [みちに〜]`). Table and rule: scripts/lib/readingNotes.ts.
 * Deterministic and idempotent; uids never change.
 *
 *   npx tsx scripts/normalise-vocab-readings.ts [--dry-run]
 */

type Row = Record<string, unknown> & { uid: string; word: string; reading: string };
const DRY = process.argv.includes('--dry-run');
const changed: string[] = [];
const unresolved: string[] = [];
for (const level of ['n5', 'n4', 'n3', 'n2', 'n1']) {
  const path = `grammar-app/src/data/${level}/vocab.json`;
  const file = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, Row[]>;
  let n = 0;
  for (const row of Object.values(file).flat()) {
    if (!/[[［]/.test(row.word)) continue;
    const mirrored = mirrorNotes(row.word, row.reading ?? '');
    if (mirrored === null) unresolved.push(`${row.uid} ${row.word}【${row.reading}】`);
    else if (mirrored !== row.reading) {
      changed.push(`${row.uid} ${row.word}: ${row.reading} → ${mirrored}`);
      row.reading = mirrored;
      n++;
    }
  }
  if (!DRY && n) writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`);
}
console.log(`${changed.length} reading(s) ${DRY ? 'would be ' : ''}changed`);
for (const c of changed) console.log(`  ${c}`);
if (unresolved.length) console.log(`unresolved (no note reading or layout):\n  ${unresolved.join('\n  ')}`);
