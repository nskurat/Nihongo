import { readFileSync, writeFileSync } from 'node:fs';
import { applyCoreExpressions, type LessonFile } from './lib/coreExpressions';

/**
 * Puts the N5 core expressions (greetings, 日本語) into their lessons in n5/vocab.json,
 * moving them out of the former lesson 26. Table and placement: scripts/lib/coreExpressions.ts.
 * Deterministic and idempotent.
 *
 *   npx tsx scripts/add-core-expressions.ts [--dry-run]
 */

const PATH = 'grammar-app/src/data/n5/vocab.json';
const DRY = process.argv.includes('--dry-run');
const file = JSON.parse(readFileSync(PATH, 'utf-8')) as LessonFile;
const before = JSON.stringify(file);
const { moved, added } = applyCoreExpressions(file);
if (!DRY && JSON.stringify(file) !== before) writeFileSync(PATH, `${JSON.stringify(file, null, 2)}\n`);
const verb = DRY ? 'would be ' : '';
console.log(`${Object.keys(moved).length} expression(s) ${verb}moved, ${added.length} ${verb}added`);
for (const [from, to] of Object.entries(moved)) console.log(`  ${from} → ${to}`);
