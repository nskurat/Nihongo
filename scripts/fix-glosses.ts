import { readFileSync, writeFileSync } from 'node:fs';
import { applyGlossFixes, GLOSS_FIXES, type GlossReport, type LessonFile } from './lib/glossFixes';

/**
 * Fixes single vocab glosses (scripts/lib/glossFixes.ts). Uids never change; idempotent.
 *
 *   npx tsx scripts/fix-glosses.ts [--dry-run]
 */

const DRY = process.argv.includes('--dry-run');
const report: GlossReport = { changed: [], skipped: [] };
for (const level of ['n5', 'n3'] as const) {
  const path = `grammar-app/src/data/${level}/vocab.json`;
  const file = JSON.parse(readFileSync(path, 'utf-8')) as LessonFile;
  const before = report.changed.length;
  applyGlossFixes(file, GLOSS_FIXES[level], report);
  if (!DRY && report.changed.length > before) writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`);
}
for (const line of report.changed) console.log(`${DRY ? 'would fix' : 'fixed'} ${line}`);
for (const line of report.skipped) console.warn(`skipped ${line}`);
