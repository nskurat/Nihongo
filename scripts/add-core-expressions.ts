import { readFileSync, writeFileSync } from 'node:fs';
import { applyCoreExpressions, type LessonFile } from './lib/coreExpressions';

/**
 * Adds N5 lesson 26 "Core expressions" (greetings, 日本語) to n5/vocab.json. Table and
 * rationale: scripts/lib/coreExpressions.ts. Deterministic and idempotent.
 *
 *   npx tsx scripts/add-core-expressions.ts [--dry-run]
 */

const PATH = 'grammar-app/src/data/n5/vocab.json';
const DRY = process.argv.includes('--dry-run');
const file = JSON.parse(readFileSync(PATH, 'utf-8')) as LessonFile;
const added = applyCoreExpressions(file);
if (!DRY && added.length) writeFileSync(PATH, `${JSON.stringify(file, null, 2)}\n`);
console.log(`${added.length} expression(s) ${DRY ? 'would be ' : ''}added to N5 lesson 26${added.length ? `: ${added.join('、')}` : ''}`);
