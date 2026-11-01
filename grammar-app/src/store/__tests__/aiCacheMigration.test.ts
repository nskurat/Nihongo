import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  V5_REPLACED_KANJI_UIDS,
  V9_MOVED_VOCAB_UIDS,
  V9_REMOVED_VOCAB_UIDS,
  V10_REMOVED_VOCAB_UIDS,
  vocabUidSuccessor,
  migrateAiCache,
  renameV9VocabArtifacts,
  v9VocabUid,
  withoutKeys,
} from '../aiCacheMigration';
import { artifactKey, type ArtifactCache } from '../../services/ai/artifactCache';

describe('withoutKeys', () => {
  it('drops only the listed keys', () => {
    expect(withoutKeys({ a: 1, b: 2, c: 3 }, ['b', 'x'])).toEqual({ a: 1, c: 3 });
  });
});

describe('V5_REPLACED_KANJI_UIDS', () => {
  it('names real N3 kanji slots', () => {
    const data: Record<string, { uid: string }[]> = JSON.parse(
      readFileSync(resolve(__dirname, '../../data/n3/kanji.json'), 'utf-8')
    );
    const uids = new Set(Object.values(data).flat().map((k) => k.uid));
    for (const uid of V5_REPLACED_KANJI_UIDS) expect(uids.has(uid)).toBe(true);
  });
});

import { withoutShiftedUids } from '../aiCacheMigration';

describe('withoutShiftedUids', () => {
  it('drops uids at or after the first shifted position of their lesson only', () => {
    const notes = { 'n5-vocab-7-26': 'a', 'n5-vocab-7-27': 'b', 'n5-vocab-7-40': 'c', 'n5-vocab-8-30': 'd', 'n5-kanji-7-30': 'e' };
    expect(withoutShiftedUids(notes, ['n5-vocab-7-27'])).toEqual({ 'n5-vocab-7-26': 'a', 'n5-vocab-8-30': 'd', 'n5-kanji-7-30': 'e' });
  });
});

describe('v9: vocab notes follow their words', () => {
  const vocab = (level: string) =>
    JSON.parse(readFileSync(resolve(__dirname, `../../data/${level}/vocab.json`), 'utf-8')) as Record<string, { uid: string; word: string }[]>;
  const wordOf = new Map(['n5', 'n3', 'n2'].flatMap((l) => Object.values(vocab(l)).flat().map((r) => [r.uid, r.word] as const)));

  it('moves, redirects and shifts uids', () => {
    expect(v9VocabUid('n5-vocab-26-1')).toBe('n5-vocab-3-38'); // 日本語
    expect(v9VocabUid('n5-vocab-4-34')).toBe('n5-vocab-5-1'); // 行く → 行きます
    expect(v9VocabUid('n5-vocab-4-35')).toBe('n5-vocab-4-34'); // shifted past the removed row
    expect(v9VocabUid('n2-vocab-19-24')).toBe('n2-vocab-19-22'); // two rows removed before it
    expect(v9VocabUid('n5-vocab-4-33')).toBe('n5-vocab-4-33');
    expect(v9VocabUid('n4-vocab-1-1')).toBe('n4-vocab-1-1');
  });

  it('points every moved row and redirect at a current row of the same word', () => {
    expect(wordOf.get(V9_MOVED_VOCAB_UIDS['n5-vocab-26-3'])).toBe('こんにちは');
    expect(Object.keys(V9_MOVED_VOCAB_UIDS)).toHaveLength(15);
    for (const target of [...Object.values(V9_MOVED_VOCAB_UIDS), ...Object.values(V9_REMOVED_VOCAB_UIDS)]) {
      expect(wordOf.has(target)).toBe(true);
    }
    expect(wordOf.get(V9_REMOVED_VOCAB_UIDS['n3-vocab-11-84'])).toBe('こんにちは');
  });

  it('renames vocab notes, never overwrites the kept twin, and leaves other kinds alone', () => {
    const entry = (kind: 'vocab-help' | 'kanji-mnemonic', uid: string, data: string) => ({ kind, uid, data, ts: 1 });
    const cache: ArtifactCache = {
      [artifactKey('vocab-help', 'n5-vocab-4-35')]: entry('vocab-help', 'n5-vocab-4-35', 'shifted'),
      [artifactKey('vocab-help', 'n5-vocab-4-34')]: entry('vocab-help', 'n5-vocab-4-34', '行く note'),
      [artifactKey('vocab-help', 'n5-vocab-5-1')]: entry('vocab-help', 'n5-vocab-5-1', '行きます note'),
      [artifactKey('vocab-help', 'n3-vocab-11-84')]: entry('vocab-help', 'n3-vocab-11-84', 'こんにちは note'),
      [artifactKey('kanji-mnemonic', 'n5-kanji-4-34')]: entry('kanji-mnemonic', 'n5-kanji-4-34', 'kanji'),
    };
    const out = renameV9VocabArtifacts(cache);
    expect(out[artifactKey('vocab-help', 'n5-vocab-4-34')]).toMatchObject({ uid: 'n5-vocab-4-34', data: 'shifted' });
    expect(out[artifactKey('vocab-help', 'n5-vocab-5-1')].data).toBe('行きます note');
    expect(out[artifactKey('vocab-help', 'n5-vocab-1-45')]).toMatchObject({ uid: 'n5-vocab-1-45', data: 'こんにちは note' });
    expect(out[artifactKey('kanji-mnemonic', 'n5-kanji-4-34')].data).toBe('kanji');
    expect(Object.keys(out)).toHaveLength(4);
  });

  it('migrateAiCache applies it to v8 caches and passes v9 through', () => {
    const v8 = { artifacts: { [artifactKey('vocab-help', 'n5-vocab-26-1')]: { kind: 'vocab-help' as const, uid: 'n5-vocab-26-1', data: 'x', ts: 1 } } };
    expect(Object.keys(migrateAiCache(v8, 8).artifacts)).toEqual([artifactKey('vocab-help', 'n5-vocab-3-38')]);
    expect(Object.keys(migrateAiCache(v8, 9).artifacts)).toEqual([artifactKey('vocab-help', 'n5-vocab-26-1')]); // v9 caches skip the v9 step
    expect(migrateAiCache(v8, 10)).toEqual(v8);
  });
});

describe('v10: near-repeat merges', () => {
  const change = { moved: {}, removed: V10_REMOVED_VOCAB_UIDS };
  const vocab = (level: string) =>
    JSON.parse(readFileSync(resolve(__dirname, `../../data/${level}/vocab.json`), 'utf-8')) as Record<string, { uid: string; word: string }[]>;
  const wordOf = new Map(['n5', 'n4', 'n3', 'n2'].flatMap((l) => Object.values(vocab(l)).flat().map((r) => [r.uid, r.word] as const)));

  it('redirects each merged row to a current row of the same word', () => {
    expect(wordOf.get(V10_REMOVED_VOCAB_UIDS['n1-vocab-30-81'])).toBe('よほど');
    expect(wordOf.get(V10_REMOVED_VOCAB_UIDS['n3-vocab-1-127'])).toBe('ぜひ');
    for (const target of Object.values(V10_REMOVED_VOCAB_UIDS)) expect(wordOf.has(target)).toBe(true);
  });

  it('shifts later rows of a lesson past every removed row before them', () => {
    expect(vocabUidSuccessor('n3-vocab-22-129', change)).toBe('n3-vocab-22-127'); // after めったに (50) and 大した (128)
    expect(vocabUidSuccessor('n3-vocab-22-51', change)).toBe('n3-vocab-22-50');
    expect(vocabUidSuccessor('n3-vocab-22-49', change)).toBe('n3-vocab-22-49');
  });

  it('a v9 cache migrates through v10; a v8 cache through v9 and v10', () => {
    const entry = (uid: string) => ({ kind: 'vocab-help' as const, uid, data: uid, ts: 1 });
    const v9 = { artifacts: { [artifactKey('vocab-help', 'n3-vocab-22-51')]: entry('n3-vocab-22-51') } };
    expect(Object.keys(migrateAiCache(v9, 9).artifacts)).toEqual([artifactKey('vocab-help', 'n3-vocab-22-50')]);
  });
});
