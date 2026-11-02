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
  renameArtifacts,
  renameV9VocabArtifacts,
  unpackUidMap,
  v9VocabUid,
  v11N5Maps,
  v12N4Maps,
  v13N3Maps,
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

/** A pre-v11 N5, pre-v12 N4 or pre-v13 N3 vocab uid → its uid in the restructured lessons (others unchanged). */
const now = (uid: string) =>
  v11N5Maps()['vocab-help']?.[uid] ?? v12N4Maps()['vocab-help']?.[uid] ?? v13N3Maps()['vocab-help']?.[uid] ?? uid;

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
    expect(wordOf.get(now(V9_MOVED_VOCAB_UIDS['n5-vocab-26-3']))).toBe('こんにちは');
    expect(Object.keys(V9_MOVED_VOCAB_UIDS)).toHaveLength(15);
    for (const target of [...Object.values(V9_MOVED_VOCAB_UIDS), ...Object.values(V9_REMOVED_VOCAB_UIDS)]) {
      expect(wordOf.has(now(target))).toBe(true);
    }
    expect(wordOf.get(now(V9_REMOVED_VOCAB_UIDS['n3-vocab-11-84']))).toBe('こんにちは');
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
    expect(Object.keys(migrateAiCache(v8, 8).artifacts)).toEqual([artifactKey('vocab-help', now('n5-vocab-3-38'))]);
    expect(Object.keys(migrateAiCache(v8, 9).artifacts)).toEqual([artifactKey('vocab-help', 'n5-vocab-26-1')]); // v9 caches skip the v9 step
    expect(migrateAiCache(v8, 11)).toEqual(v8);
  });
});

describe('v10: near-repeat merges', () => {
  const change = { moved: {}, removed: V10_REMOVED_VOCAB_UIDS };
  const vocab = (level: string) =>
    JSON.parse(readFileSync(resolve(__dirname, `../../data/${level}/vocab.json`), 'utf-8')) as Record<string, { uid: string; word: string }[]>;
  const wordOf = new Map(['n5', 'n4', 'n3', 'n2'].flatMap((l) => Object.values(vocab(l)).flat().map((r) => [r.uid, r.word] as const)));

  it('redirects each merged row to a current row of the same word', () => {
    expect(wordOf.get(now(V10_REMOVED_VOCAB_UIDS['n1-vocab-30-81']))).toBe('よほど');
    expect(wordOf.get(now(V10_REMOVED_VOCAB_UIDS['n3-vocab-1-127']))).toBe('ぜひ');
    for (const target of Object.values(V10_REMOVED_VOCAB_UIDS)) expect(wordOf.has(now(target))).toBe(true);
  });

  it('shifts later rows of a lesson past every removed row before them', () => {
    expect(vocabUidSuccessor('n3-vocab-22-129', change)).toBe('n3-vocab-22-127'); // after めったに (50) and 大した (128)
    expect(vocabUidSuccessor('n3-vocab-22-51', change)).toBe('n3-vocab-22-50');
    expect(vocabUidSuccessor('n3-vocab-22-49', change)).toBe('n3-vocab-22-49');
  });

  it('a v9 cache migrates through v10; a v8 cache through v9 and v10', () => {
    const entry = (uid: string) => ({ kind: 'vocab-help' as const, uid, data: uid, ts: 1 });
    const v9 = { artifacts: { [artifactKey('vocab-help', 'n3-vocab-22-51')]: entry('n3-vocab-22-51') } };
    expect(Object.keys(migrateAiCache(v9, 9).artifacts)).toEqual([artifactKey('vocab-help', now('n3-vocab-22-50'))]);
  });
});

describe('v11: the N5 restructure', () => {
  const data = (section: string) =>
    JSON.parse(readFileSync(resolve(__dirname, `../../data/n5/${section}.json`), 'utf-8')) as Record<string, { uid: string; word?: string; kanji?: string; title?: string }[]>;
  const uids = (section: string) => new Set(Object.values(data(section)).flat().map((r) => r.uid));
  const maps = v11N5Maps();

  it('maps every pre-restructure N5 row to a current row', () => {
    const grammar = maps['grammar-examples']!;
    expect(Object.keys(grammar).length).toBeGreaterThan(50); // unchanged uids are omitted
    for (const [section, map] of [['grammar', grammar], ['vocab', maps['vocab-help']!], ['kanji', maps['kanji-mnemonic']!]] as const) {
      const current = uids(section);
      for (const target of Object.values(map)) expect(current.has(target), `${section} ${target}`).toBe(true);
    }
    expect(maps['grammar-nuance']).toBe(grammar);
  });

  it('follows known items to their new lessons', () => {
    const word = (uid: string) => Object.values(data('vocab')).flat().find((r) => r.uid === uid)?.word;
    expect(word(now('n5-vocab-9-1'))).toBe('わかります');
    expect(word(now('n5-vocab-5-3'))).toBe('帰ります');
    const title = (uid: string) => Object.values(data('grammar')).flat().find((r) => r.uid === uid)?.title;
    expect(title(maps['grammar-examples']!['n5-grammar-5-3'])).toBe('N(vehicle)で 行きます');
    // three polite-prefix rows (お国, お〜, ご注文) became one
    const prefix = ['n5-grammar-3-6', 'n5-grammar-6-8', 'n5-grammar-13-6'].map((u) => maps['grammar-examples']![u] ?? u);
    expect(new Set(prefix).size).toBe(1);
  });

  it('renames all at once and keeps the newest artifact when rows merged', () => {
    const e = (kind: 'grammar-nuance' | 'vocab-help', uid: string, data: string, ts: number) => ({ kind, uid, data, ts });
    const cache: ArtifactCache = {
      [artifactKey('grammar-nuance', 'a')]: e('grammar-nuance', 'a', 'old a', 1),
      [artifactKey('grammar-nuance', 'b')]: e('grammar-nuance', 'b', 'old b', 5),
      [artifactKey('vocab-help', 'x')]: e('vocab-help', 'x', 'x', 1),
      [artifactKey('vocab-help', 'y')]: e('vocab-help', 'y', 'y', 1),
    };
    const out = renameArtifacts(cache, { 'grammar-nuance': { a: 'm', b: 'm' }, 'vocab-help': { x: 'y', y: 'x' } });
    expect(out[artifactKey('grammar-nuance', 'm')]).toMatchObject({ uid: 'm', data: 'old b' });
    expect(out[artifactKey('vocab-help', 'y')].data).toBe('x');
    expect(out[artifactKey('vocab-help', 'x')].data).toBe('y');
    expect(Object.keys(out)).toHaveLength(3);
  });

  it('unpacks the generated pairs', () => {
    expect(unpackUidMap('1-1>2-3,4-5>1-1', 'n5-vocab-')).toEqual({ 'n5-vocab-1-1': 'n5-vocab-2-3', 'n5-vocab-4-5': 'n5-vocab-1-1' });
  });

  it('migrateAiCache applies it to v10 caches and passes v11 through', () => {
    const v10 = { artifacts: { [artifactKey('vocab-help', 'n5-vocab-9-1')]: { kind: 'vocab-help' as const, uid: 'n5-vocab-9-1', data: 'わかります note', ts: 1 } } };
    expect(Object.keys(migrateAiCache(v10, 10).artifacts)).toEqual([artifactKey('vocab-help', now('n5-vocab-9-1'))]);
    expect(migrateAiCache(v10, 11)).toEqual(v10);
  });
});

describe('v12: the N4 restructure', () => {
  const data = (section: string) =>
    JSON.parse(readFileSync(resolve(__dirname, `../../data/n4/${section}.json`), 'utf-8')) as Record<string, { uid: string; word?: string; kanji?: string; title?: string }[]>;
  const uids = (section: string) => new Set(Object.values(data(section)).flat().map((r) => r.uid));
  const maps = v12N4Maps();

  it('maps every pre-restructure N4 row to a current row', () => {
    const grammar = maps['grammar-examples']!;
    expect(Object.keys(grammar).length).toBeGreaterThan(100);
    for (const [section, map] of [['grammar', grammar], ['vocab', maps['vocab-help']!], ['kanji', maps['kanji-mnemonic']!]] as const) {
      const current = uids(section);
      for (const target of Object.values(map)) expect(current.has(target), `${section} ${target}`).toBe(true);
    }
    expect(maps['grammar-nuance']).toBe(grammar);
  });

  it('follows known items to their new lessons', () => {
    const row = (section: string, uid: string) => Object.values(data(section)).flat().find((r) => r.uid === uid);
    expect(row('vocab', now('n4-vocab-1-1'))?.word).toBe('探します');
    expect(row('vocab', now('n4-vocab-25-6'))?.word).toBe('存じます');
    const grammar = (uid: string) => maps['grammar-examples']![uid] ?? uid; // unchanged uids are omitted
    expect(row('grammar', grammar('n4-grammar-23-6'))?.title).toMatch(/させられる/);
    expect(row('grammar', grammar('n4-grammar-21-3'))?.title).toBe('〜はずです');
    // the two certainty points (でしょう, きっと／たぶん) became one
    expect(grammar('n4-grammar-7-2')).toBe(grammar('n4-grammar-7-4'));
  });

  it('migrateAiCache applies it to v11 caches and passes v12 through', () => {
    const v11 = { artifacts: { [artifactKey('vocab-help', 'n4-vocab-1-1')]: { kind: 'vocab-help' as const, uid: 'n4-vocab-1-1', data: '探します note', ts: 1 } } };
    expect(Object.keys(migrateAiCache(v11, 11).artifacts)).toEqual([artifactKey('vocab-help', now('n4-vocab-1-1'))]);
    expect(Object.keys(migrateAiCache(v11, 12).artifacts)).toEqual([artifactKey('vocab-help', 'n4-vocab-1-1')]); // v12 caches skip the v12 step
  });
});

describe('v13: the N3 restructure', () => {
  const data = (section: string) =>
    JSON.parse(readFileSync(resolve(__dirname, `../../data/n3/${section}.json`), 'utf-8')) as Record<string, { uid: string; word?: string; kanji?: string; title?: string }[]>;
  const uids = (section: string) => new Set(Object.values(data(section)).flat().map((r) => r.uid));
  const maps = v13N3Maps();

  it('maps every pre-restructure N3 row to a current row', () => {
    const grammar = maps['grammar-examples']!;
    expect(Object.keys(grammar).length).toBeGreaterThan(100);
    for (const [section, map] of [['grammar', grammar], ['vocab', maps['vocab-help']!], ['kanji', maps['kanji-mnemonic']!]] as const) {
      const current = uids(section);
      for (const target of Object.values(map)) expect(current.has(target), `${section} ${target}`).toBe(true);
    }
  });

  it('follows known items to their new lessons', () => {
    const row = (section: string, uid: string) => Object.values(data(section)).flat().find((r) => r.uid === uid);
    const grammar = (uid: string) => maps['grammar-examples']![uid] ?? uid;
    expect(row('vocab', now('n3-vocab-1-2'))?.word).toBe('先輩');
    expect(row('kanji', maps['kanji-mnemonic']!['n3-kanji-1-1'] ?? 'n3-kanji-1-1')?.kanji).toBe('迷');
    expect(row('grammar', grammar('n3-grammar-5-2'))?.title).toBe('〜おかげで／〜せいで');
    // つまり and すなわち became one point
    expect(grammar('n3-grammar-3-4')).toBe(grammar('n3-grammar-24-6'));
  });

  it('migrateAiCache applies it to v12 caches and passes v13 through', () => {
    const v12 = { artifacts: { [artifactKey('vocab-help', 'n3-vocab-1-2')]: { kind: 'vocab-help' as const, uid: 'n3-vocab-1-2', data: '先輩 note', ts: 1 } } };
    expect(Object.keys(migrateAiCache(v12, 12).artifacts)).toEqual([artifactKey('vocab-help', now('n3-vocab-1-2'))]);
    expect(migrateAiCache(v12, 13)).toEqual(v12);
  });
});
