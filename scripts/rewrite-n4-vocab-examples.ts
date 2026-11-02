import { readFileSync, writeFileSync } from 'node:fs';
import { applyVocabExamples, type ExampleBatch, type LessonFile } from './lib/n5Restructure';

/**
 * Replaces the example sentences of the N4 core vocab rows with the ones written for the
 * N4 restructure (scripts/batches/n4-vocab-examples.json, docs/content/n4-restructure.md).
 * Checks each row's word first; changes nothing else. Idempotent.
 *
 *   npx tsx scripts/rewrite-n4-vocab-examples.ts [--dry-run]
 */

const PATH = 'grammar-app/src/data/n4/vocab.json';
const DRY = process.argv.includes('--dry-run');
const file = JSON.parse(readFileSync(PATH, 'utf-8')) as LessonFile;
const { examples } = JSON.parse(readFileSync('scripts/batches/n4-vocab-examples.json', 'utf-8')) as { examples: ExampleBatch };
const withExamples = Object.values(file).flat().filter((r) => r.exampleJp).length;
const changed = applyVocabExamples(file, examples);
if (!DRY && changed) writeFileSync(PATH, `${JSON.stringify(file, null, 2)}\n`);
console.log(`${changed} example(s) ${DRY ? 'would be ' : ''}rewritten; ${Object.keys(examples).length} in the batch, ${withExamples} rows with examples`);
