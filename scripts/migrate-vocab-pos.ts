import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { buildSearchIndex, type SearchContent } from '../grammar-app/src/services/search/indexer/buildSearchIndex';
import { LEVELS } from '../grammar-app/src/services/search/shard';
import type { TagTaxonomy } from '../grammar-app/src/types/japanese';
import { isPosValue, normalisePos } from './lib/vocabPos';

/**
 * v2 vocab migration: `pos` onto the closed set (scripts/lib/vocabPos.ts), and the
 * dictionary form of every ます row stored as `lemma` / `lemmaReading` (joined with ／ for
 * pairs). The lemmas are the ones search derived at build time, reviewed by the teacher
 * (2026-11-01, all 236 correct); from now on search reads them from the data.
 * Deterministic and idempotent: rows already migrated are left alone.
 *
 *   npx tsx scripts/migrate-vocab-pos.ts [--dry-run]
 */

const DATA = 'grammar-app/src/data';
const DRY = process.argv.includes('--dry-run');
type Row = Record<string, unknown> & { uid: string; word: string; pos?: string; lemma?: string };
const readJson = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf-8')) as T;

const content: SearchContent = { taxonomy: readJson<TagTaxonomy>(`${DATA}/tag-taxonomy.json`), grammar: {}, vocab: {}, kanji: {} };
for (const level of LEVELS) {
  for (const section of ['grammar', 'vocab', 'kanji'] as const) {
    const p = `${DATA}/${level.toLowerCase()}/${section}.json`;
    if (existsSync(p)) (content[section] as Record<string, unknown>)[level] = readJson(p);
  }
}
const report = buildSearchIndex(content, 'migration').report.masu;
const byUid = new Map<string, typeof report>();
for (const r of report) byUid.set(r.uid, [...(byUid.get(r.uid) ?? []), r]);

let posChanged = 0;
let lemmasAdded = 0;
for (const level of LEVELS) {
  const path = `${DATA}/${level.toLowerCase()}/vocab.json`;
  if (!existsSync(path)) continue;
  const file = readJson<Record<string, Row[]>>(path);
  let dirty = false;
  for (const row of Object.values(file).flat()) {
    const lemmaRows = byUid.get(row.uid) ?? [];
    const parts = row.word.split('／').length;
    if (row.pos && !isPosValue(row.pos)) {
      row.pos = normalisePos(row.pos, lemmaRows.map((r) => r.rule), parts);
      posChanged++;
      dirty = true;
    }
    if (lemmaRows.length && row.lemma === undefined) {
      row.lemma = lemmaRows.map((r) => r.lemma).join('／');
      row.lemmaReading = lemmaRows.map((r) => r.lemmaReading).join('／');
      lemmasAdded++;
      dirty = true;
    }
  }
  if (dirty && !DRY) writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`);
}
console.log(`${posChanged} pos value(s) and ${lemmasAdded} lemma(s) ${DRY ? 'would be ' : ''}written`);
