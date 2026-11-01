import { describe, expect, it } from 'vitest';
import { artifactKey, fromLegacyMaps, getArtifact, putArtifact, type ArtifactCache } from '../artifactCache';
import { migrateAiCache } from '../../../store/aiCacheMigration';

describe('putArtifact', () => {
  it('stores and reads back by kind + uid', () => {
    const cache = putArtifact({}, 'vocab-help', 'n5-vocab-1-1', 'note', 10);
    expect(getArtifact(cache, 'vocab-help', 'n5-vocab-1-1')).toBe('note');
    expect(getArtifact(cache, 'kanji-mnemonic', 'n5-vocab-1-1')).toBeUndefined();
    expect(cache[artifactKey('vocab-help', 'n5-vocab-1-1')].ts).toBe(10);
  });

  it('evicts the least recently generated entries past the entry cap', () => {
    let cache: ArtifactCache = {};
    for (let i = 1; i <= 5; i++) cache = putArtifact(cache, 'vocab-help', `u${i}`, `n${i}`, i, { maxEntries: 3, maxBytes: 1e9 });
    expect(Object.values(cache).map((a) => a.uid).sort()).toEqual(['u3', 'u4', 'u5']);
  });

  it('regenerating an old entry makes it recent again', () => {
    const limits = { maxEntries: 2, maxBytes: 1e9 };
    let cache = putArtifact({}, 'vocab-help', 'a', 'x', 1, limits);
    cache = putArtifact(cache, 'vocab-help', 'b', 'x', 2, limits);
    cache = putArtifact(cache, 'vocab-help', 'a', 'y', 3, limits); // a refreshed
    cache = putArtifact(cache, 'vocab-help', 'c', 'x', 4, limits); // b is now oldest
    expect(Object.values(cache).map((a) => a.uid).sort()).toEqual(['a', 'c']);
  });

  it('evicts by size, but never the entry just written', () => {
    const big = 'あ'.repeat(400);
    let cache: ArtifactCache = {};
    for (let i = 1; i <= 4; i++) cache = putArtifact(cache, 'kanji-mnemonic', `k${i}`, big, i, { maxEntries: 100, maxBytes: 1000 });
    expect(JSON.stringify(cache).length).toBeLessThanOrEqual(1000);
    expect(getArtifact(cache, 'kanji-mnemonic', 'k4')).toBe(big);
    const huge = putArtifact({}, 'kanji-mnemonic', 'only', 'x'.repeat(5000), 1, { maxEntries: 100, maxBytes: 1000 });
    expect(getArtifact(huge, 'kanji-mnemonic', 'only')).toHaveLength(5000);
  });
});

describe('migrating the persisted cache', () => {
  const v7 = {
    generatedExamples: { 'n5-grammar-1-1': [{ jp: '学生です。', en: 'I am a student.' }], 'n5-grammar-1-2': [] },
    aiExplanations: { 'n5-grammar-1-1': 'nuance' },
    aiVocabNotes: { 'n5-vocab-1-1': 'usage' },
    aiKanjiMnemonics: { 'n3-kanji-2-5': 'story', 'n5-kanji-1-1': 'sun story' },
  };

  it('v7: every non-empty note and example survives as an artifact', () => {
    const { artifacts } = migrateAiCache(v7, 7);
    expect(Object.keys(artifacts).sort()).toEqual(
      [
        'grammar-examples:n5-grammar-1-1',
        'grammar-nuance:n5-grammar-1-1',
        'kanji-mnemonic:n3-kanji-2-5',
        'kanji-mnemonic:n5-kanji-1-1',
        'vocab-help:n5-vocab-1-1',
      ].sort()
    );
    expect(getArtifact(artifacts, 'grammar-examples', 'n5-grammar-1-1')).toEqual(v7.generatedExamples['n5-grammar-1-1']);
    expect(Object.values(artifacts).every((a) => a.ts === 0)).toBe(true);
  });

  it('v4 still drops mnemonics of the reused N3 kanji slots', () => {
    const { artifacts } = migrateAiCache(v7, 4);
    expect(getArtifact(artifacts, 'kanji-mnemonic', 'n3-kanji-2-5')).toBeUndefined();
    expect(getArtifact(artifacts, 'kanji-mnemonic', 'n5-kanji-1-1')).toBe('sun story');
  });

  it('pre-v4 caches start empty; v8 passes through', () => {
    expect(migrateAiCache(v7, 3)).toEqual({ artifacts: {} });
    const v8 = { artifacts: fromLegacyMaps(v7) };
    expect(migrateAiCache(v8, 8)).toEqual(v8);
  });
});
