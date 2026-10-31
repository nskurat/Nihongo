import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TagTaxonomy } from '../../../types/japanese';
import { buildSearchIndex, type SearchContent, type SearchIndexBuild } from '../indexer/buildSearchIndex';
import { MemorySearchSource } from '../MemorySearchSource';
import { LEVELS } from '../shard';

/** Test helper: the real content files, read from disk (no Vite, no worker). */
const DATA = join(dirname(fileURLToPath(import.meta.url)), '../../../data');

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

export function loadRealContent(): SearchContent {
  const content: SearchContent = {
    taxonomy: readJson<TagTaxonomy>(join(DATA, 'tag-taxonomy.json')),
    grammar: {},
    vocab: {},
    kanji: {},
  };
  for (const level of LEVELS) {
    for (const section of ['grammar', 'vocab', 'kanji'] as const) {
      const p = join(DATA, level.toLowerCase(), `${section}.json`);
      if (existsSync(p)) (content[section] as Record<string, unknown>)[level] = readJson(p);
    }
  }
  return content;
}

let cached: { build: SearchIndexBuild; source: MemorySearchSource } | null = null;

export function realIndex(): { build: SearchIndexBuild; source: MemorySearchSource } {
  if (!cached) {
    const build = buildSearchIndex(loadRealContent(), 'test');
    cached = { build, source: new MemorySearchSource(build.shards) };
  }
  return cached;
}
