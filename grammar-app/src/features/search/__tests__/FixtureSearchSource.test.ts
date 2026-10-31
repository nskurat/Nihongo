import { describe, expect, it } from 'vitest';
import { FixtureSearchSource } from '../__fixtures__/FixtureSearchSource';
import { isNoSourceError } from '../searchClient';
import { searchRepository } from '../../../services/search/SearchSource';

const src = new FixtureSearchSource();

describe('FixtureSearchSource', () => {
  it('is deterministic and satisfies the response shape', async () => {
    const a = await src.search('ばかり', { rankLevel: 'N3' });
    const b = await src.search('ばかり', { rankLevel: 'N3' });
    expect(a).toEqual(b);
    expect(a.groupOrder[0]).toBe('grammar');
    expect(a.totals.grammar).toBeGreaterThan(3);
    expect(a.status).toBe('ready');
  });

  it('filters by level and reports hidden counts', async () => {
    const r = await src.search('ばかり', { rankLevel: 'N3', levels: ['N2'] });
    expect(r.groups.grammar.map((h) => h.title)).toEqual(['〜ばかりか', '〜ばかりだ', '〜ばかりに']);
    expect(r.hiddenByFilters).toBeGreaterThan(0);
    expect(r.otherLevelsCount).toBeGreaterThan(0);
  });

  it('puts kanji first for a single kanji and decomposes kanji words', async () => {
    expect((await src.search('迷', { rankLevel: 'N3' })).groupOrder[0]).toBe('kanji');
    const r = await src.search('迷惑', { rankLevel: 'N3' });
    expect(r.groups.vocab[0].title).toBe('迷惑');
    expect(r.groups.kanji.map((k) => k.title).sort()).toEqual(['惑', '迷'].sort());
  });

  it('offers category chips for English aliases and lists by tag in level order', async () => {
    const r = await src.search('comparison', { rankLevel: 'N3' });
    expect(r.categories.map((c) => c.id)).toContain('comparison');
    const list = await src.listByTag('comparison');
    expect(list[0].level).toBe('N5');
    expect(list.every((h) => h.tags?.includes('comparison'))).toBe(true);
  });

  it('returns a deinflection for an inflected form', async () => {
    const r = await src.search('待たされた', { rankLevel: 'N3' });
    expect(r.groups.vocab[0]).toMatchObject({ title: '待つ', matchKind: 'deinflected' });
  });
});

describe('searchClient fallback detection', () => {
  it('recognises the "no source" error from the contract facade', () => {
    let err: unknown;
    try {
      void searchRepository.warmup();
    } catch (e) {
      err = e;
    }
    expect(isNoSourceError(err)).toBe(true);
    expect(isNoSourceError(new Error('network'))).toBe(false);
  });
});
