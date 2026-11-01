import type { GrammarExampleSentence } from './studyItems';

/**
 * Everything AI generates for a study item, keyed by kind. Adding a feature is a new
 * member here plus its payload type - not another pair of maps in the store.
 */
export interface ArtifactData {
  /** "AI: More Examples" - grows with each press. */
  'grammar-examples': GrammarExampleSentence[];
  /** "Explain nuance & compare" (markdown). */
  'grammar-nuance': string;
  /** Vocab usage note (markdown). */
  'vocab-help': string;
  /** Kanji mnemonic story (markdown). */
  'kanji-mnemonic': string;
}

export type ArtifactKind = keyof ArtifactData;

export interface CachedArtifact<K extends ArtifactKind = ArtifactKind> {
  kind: K;
  uid: string;
  data: ArtifactData[K];
  /** When it was last generated (ms). Eviction drops the oldest first; 0 = migrated. */
  ts: number;
}

/** Flat map keyed by `artifactKey(kind, uid)`. */
export type ArtifactCache = Record<string, CachedArtifact>;

export interface CacheLimits {
  maxEntries: number;
  /** Serialised JSON length, a stand-in for localStorage bytes. */
  maxBytes: number;
}

/**
 * 400 artifacts / ~1 MB. localStorage holds ~5 MB per origin and the reading library
 * shares it, so the AI cache stays well inside a fifth of it.
 */
export const DEFAULT_LIMITS: CacheLimits = { maxEntries: 400, maxBytes: 1_000_000 };

export function artifactKey(kind: ArtifactKind, uid: string): string {
  return `${kind}:${uid}`;
}

export function getArtifact<K extends ArtifactKind>(cache: ArtifactCache, kind: K, uid: string): ArtifactData[K] | undefined {
  const entry = cache[artifactKey(kind, uid)];
  return entry ? (entry.data as ArtifactData[K]) : undefined;
}

/**
 * Stores `data` for (kind, uid), then evicts least-recently-generated entries until the
 * cache fits `limits`. The entry just written is never evicted. Pure: returns a new cache.
 */
export function putArtifact<K extends ArtifactKind>(
  cache: ArtifactCache,
  kind: K,
  uid: string,
  data: ArtifactData[K],
  now: number,
  limits: CacheLimits = DEFAULT_LIMITS
): ArtifactCache {
  const key = artifactKey(kind, uid);
  const next: ArtifactCache = { ...cache, [key]: { kind, uid, data, ts: now } as CachedArtifact };

  const oldestFirst = Object.keys(next)
    .filter((k) => k !== key)
    .sort((a, b) => next[a].ts - next[b].ts);
  let size = JSON.stringify(next).length;
  let count = Object.keys(next).length;
  for (const k of oldestFirst) {
    if (count <= limits.maxEntries && size <= limits.maxBytes) break;
    size -= JSON.stringify(next[k]).length + JSON.stringify(k).length + 2; // entry, key, ":" and ","
    delete next[k];
    count--;
  }
  return next;
}

/** The persisted shape before version 8: four parallel maps keyed by uid. */
export interface LegacyAiMaps {
  generatedExamples?: Record<string, GrammarExampleSentence[]>;
  aiExplanations?: Record<string, string>;
  aiVocabNotes?: Record<string, string>;
  aiKanjiMnemonics?: Record<string, string>;
}

/** Converts the four legacy maps into artifacts, dropping nothing but empty entries. */
export function fromLegacyMaps(maps: LegacyAiMaps): ArtifactCache {
  const cache: ArtifactCache = {};
  const add = <K extends ArtifactKind>(kind: K, entries: Record<string, ArtifactData[K]> | undefined) => {
    for (const [uid, data] of Object.entries(entries ?? {})) {
      if (Array.isArray(data) ? data.length === 0 : !data) continue;
      cache[artifactKey(kind, uid)] = { kind, uid, data, ts: 0 } as CachedArtifact;
    }
  };
  add('grammar-examples', maps.generatedExamples);
  add('grammar-nuance', maps.aiExplanations);
  add('vocab-help', maps.aiVocabNotes);
  add('kanji-mnemonic', maps.aiKanjiMnemonics);
  return cache;
}
