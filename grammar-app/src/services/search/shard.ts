import type { Level } from './types';

/**
 * Wire format of the prebuilt index shards (docs/search/04-data.md §4.2). Documents are
 * positional arrays and leave out every key the loader can derive cheaply (normalised
 * surface/reading, long-vowel folds, English tokens, kanji reading keys).
 */

export const SHARD_SCHEMA = 'search-index';
export const SHARD_VERSION = 1;

/** [uid, title, meaning, tagIdx[], structure, titleKeys[], structureKeys[], summaryTokens] */
export type GrammarRow = [string, string, string, number[], string, string[], string[], string];

/** Vocab keys that need content knowledge. Absent fields are derived from word/reading. */
export interface VocabExtra {
  /** surface variants, when not just [key(word)] */
  s?: string[];
  /** reading variants, when not just [key(reading)] */
  r?: string[];
  /** dictionary-form lemma + lemma reading for ます rows */
  l?: string[];
  /** collocation hints (道に, 迷惑を) */
  h?: string[];
  /** お-stripped forms and okurigana variants */
  a?: string[];
}

/** [uid, word, reading, meaning, extra?] */
export type VocabRow = [string, string, string, string] | [string, string, string, string, VocabExtra];

/** [uid, kanji, meaning, onyomi[], kunyomi[], extraCompounds[]?] */
export type KanjiRow = [string, string, string, string[], string[]] | [string, string, string, string[], string[], string[]];

interface ShardBase {
  schema: typeof SHARD_SCHEMA;
  v: typeof SHARD_VERSION;
  contentHash: string;
}

export interface GrammarShard extends ShardBase {
  shard: 'grammar';
  /** Tag ids in taxonomy order; rows reference them by index. */
  tags: string[];
  /** Taxonomy label per tag id (same order). */
  tagLabels: string[];
  docs: GrammarRow[];
}

export interface VocabShard extends ShardBase {
  shard: `vocab-${Level}`;
  docs: VocabRow[];
}

export interface KanjiShard extends ShardBase {
  shard: 'kanji';
  docs: KanjiRow[];
}

export type ShardFile = GrammarShard | VocabShard | KanjiShard;
export type ShardName = ShardFile['shard'];

export const LEVELS: readonly Level[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

export function isShardFile(x: unknown): x is ShardFile {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return o.schema === SHARD_SCHEMA && o.v === SHARD_VERSION && typeof o.shard === 'string' && Array.isArray(o.docs);
}

/** Load order: grammar first (small, form lookups), then vocab of the learner's level, kanji, the rest. */
export function shardOrder(available: readonly string[], rankLevel: Level = 'N5'): string[] {
  const first = ['grammar', `vocab-${rankLevel}`, 'kanji'];
  const rest = available.filter((n) => !first.includes(n)).sort();
  return [...first.filter((n) => available.includes(n)), ...rest];
}
