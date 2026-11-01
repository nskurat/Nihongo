import { readFileSync, writeFileSync } from 'node:fs';
import { applyN4CompoundFixes, type CompoundFixReport, type LessonFile } from './lib/n4CompoundFixes';

/**
 * Fills the N4 kanji compounds the PDF extraction left without a reading or meaning, and
 * removes the English that leaked into their words. Table: scripts/lib/n4CompoundFixes.ts.
 * Deterministic and idempotent.
 *
 *   npx tsx scripts/fix-n4-compounds.ts [--dry-run]
 */

const PATH = 'grammar-app/src/data/n4/kanji.json';
const DRY = process.argv.includes('--dry-run');
const file = JSON.parse(readFileSync(PATH, 'utf-8')) as LessonFile;
const report: CompoundFixReport = { changed: [], skipped: [] };
applyN4CompoundFixes(file, report);
if (!DRY && report.changed.length) writeFileSync(PATH, `${JSON.stringify(file, null, 2)}\n`);
console.log(`${report.changed.length} compound(s) ${DRY ? 'would be ' : ''}fixed`);
for (const s of report.skipped) console.log(`  skipped ${s}`);
