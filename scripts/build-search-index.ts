import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import {
  BUILDER_VERSION,
  buildSearchIndex,
  masuReportTsv,
  type SearchContent,
} from '../grammar-app/src/services/search/indexer/buildSearchIndex';
import { LEVELS } from '../grammar-app/src/services/search/shard';
import type { TagTaxonomy } from '../grammar-app/src/types/japanese';

/**
 * Builds the global-search index shards (docs/search/04-data.md §4.3) from src/data into
 * grammar-app/src/generated/search/ (gitignored, so it can never drift from the data).
 * Runs before `npm run dev` and `npm run build`. The worker imports the shards with
 * `?url`, so Vite emits them as content-hashed assets under the app's BASE_URL.
 *
 *   npx tsx scripts/build-search-index.ts [--quiet]
 *
 * Also writes search-index-report.tsv (ます → dictionary-form lemmas, for teacher review).
 * Pure logic lives in services/search/indexer/buildSearchIndex.ts (unit-tested).
 */

const QUIET = process.argv.includes('--quiet');
const DATA = 'grammar-app/src/data';
const OUT = 'grammar-app/src/generated/search';

const t0 = performance.now();
const hash = createHash('sha256').update(`builder:${BUILDER_VERSION}\n`);
const readJson = <T>(path: string): T => {
  const text = readFileSync(path, 'utf-8');
  hash.update(`${path}\n${text}\n`);
  return JSON.parse(text) as T;
};

const content: SearchContent = { taxonomy: readJson<TagTaxonomy>(`${DATA}/tag-taxonomy.json`), grammar: {}, vocab: {}, kanji: {} };
for (const level of LEVELS) {
  for (const section of ['grammar', 'vocab', 'kanji'] as const) {
    const path = `${DATA}/${level.toLowerCase()}/${section}.json`;
    if (existsSync(path)) (content[section] as Record<string, unknown>)[level] = readJson(path);
  }
}
const contentHash = hash.digest('hex').slice(0, 16);

const { shards, report } = buildSearchIndex(content, contentHash);

mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (f.endsWith('.json')) rmSync(join(OUT, f));
let raw = 0;
let gz = 0;
const rows: string[] = [];
for (const shard of shards) {
  const text = JSON.stringify(shard);
  writeFileSync(join(OUT, `${shard.shard}.json`), text);
  const size = Buffer.byteLength(text);
  const zipped = gzipSync(text, { level: 9 }).length;
  raw += size;
  gz += zipped;
  rows.push(`  ${shard.shard.padEnd(9)} ${String(shard.docs.length).padStart(5)} docs ${(size / 1024).toFixed(1).padStart(7)} KB raw ${(zipped / 1024).toFixed(1).padStart(6)} KB gzip`);
}
writeFileSync(join(OUT, 'search-index-report.tsv'), masuReportTsv(report.masu));

const ms = performance.now() - t0;
if (!QUIET) {
  console.log(`search index ${contentHash}: ${shards.length} shards, ${(raw / 1024).toFixed(0)} KB raw, ${(gz / 1024).toFixed(1)} KB gzip (${ms.toFixed(0)} ms)`);
  rows.forEach((r) => console.log(r));
  console.log(`  ます lemmas: ${report.masu.length} (see ${OUT}/search-index-report.tsv)`);
}
for (const w of report.warnings) console.warn(`  warning: ${w}`);
