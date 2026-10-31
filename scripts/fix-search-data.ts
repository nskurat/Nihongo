import { readFileSync, writeFileSync } from 'node:fs';
import { applyKunFixes, applyVocabFixes, type FixReport, type LessonFile } from './lib/searchDataFixes';

/**
 * Data-quality fixes global search depends on (docs/search/04-data.md §7 #1, #3, #8):
 * 言う read as ゆう, slash pairs whose reading covers one half only, and N5 kun readings
 * stored as bare stems. Tables live in scripts/lib/searchDataFixes.ts.
 *
 *   npx tsx scripts/fix-search-data.ts [--dry-run]
 *
 * Uids never change. Deterministic and idempotent: a second run changes nothing. Safe to
 * run after any step of the content pipeline (docs/content-data.md); none of those steps
 * rewrites the fields touched here.
 */

const DRY = process.argv.includes('--dry-run');
const DATA = 'grammar-app/src/data';
const read = (p: string): LessonFile => JSON.parse(readFileSync(p, 'utf-8')) as LessonFile;
const report: FixReport = { changed: [], skipped: [] };

const targets: { path: string; apply: (f: LessonFile, r: FixReport) => void }[] = [
  { path: `${DATA}/n5/kanji.json`, apply: applyKunFixes },
  { path: `${DATA}/n4/vocab.json`, apply: applyVocabFixes },
  { path: `${DATA}/n3/vocab.json`, apply: applyVocabFixes },
];

for (const { path, apply } of targets) {
  const file = read(path);
  const before = report.changed.length;
  apply(file, report);
  if (!DRY && report.changed.length > before) writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`);
}

console.log(`${report.changed.length} fixes${DRY ? ' (dry run)' : ''}`);
report.changed.forEach((c) => console.log(`  ${c}`));
report.skipped.forEach((s) => console.warn(`  skipped ${s}`));
