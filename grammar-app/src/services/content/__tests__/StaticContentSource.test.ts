import { describe, it, expect, vi } from 'vitest';
import { StaticContentSource } from '../StaticContentSource';
import { GrammarItem } from '../../../types/japanese';

function grammarItem(overrides: Partial<GrammarItem> = {}): GrammarItem {
  return {
    uid: 'n5-grammar-1-1',
    level: 'N5',
    section: 'grammar',
    lesson: 1,
    title: 'N1は N2です',
    meaning: 'is/equals',
    structure: 'N1は N2です',
    explanation: '...',
    ...overrides,
  };
}

function fixtureSource(modules: Record<string, () => Promise<{ default: unknown }>>): StaticContentSource {
  return new StaticContentSource(modules as ConstructorParameters<typeof StaticContentSource>[0]);
}

describe('StaticContentSource', () => {
  it('lists real N4 lessons (26-50)', async () => {
    const chunk: Record<number, GrammarItem[]> = {};
    for (let lesson = 26; lesson <= 50; lesson++) {
      chunk[lesson] = [grammarItem({ uid: `n4-grammar-${lesson}-1`, level: 'N4', lesson })];
    }
    const source = fixtureSource({
      '../../data/n4/grammar.json': () => Promise.resolve({ default: chunk }),
    });

    const lessons = await source.listLessons('N4', 'grammar');

    expect(lessons.map((l) => l.lesson)).toEqual(Array.from({ length: 25 }, (_, i) => i + 26));
    expect(lessons[0]).toEqual({ lesson: 26, count: 1 });
  });

  it('looks up an item by uid across lessons in its chunk', async () => {
    const target = grammarItem({ uid: 'n5-grammar-2-3', lesson: 2 });
    const source = fixtureSource({
      '../../data/n5/grammar.json': () =>
        Promise.resolve({ default: { 1: [grammarItem()], 2: [grammarItem({ uid: 'n5-grammar-2-1', lesson: 2 }), target] } }),
    });

    expect(await source.getItem('n5-grammar-2-3')).toEqual(target);
  });

  it('resolves null for an unknown uid', async () => {
    const source = fixtureSource({
      '../../data/n5/grammar.json': () => Promise.resolve({ default: { 1: [grammarItem()] } }),
    });

    expect(await source.getItem('n5-grammar-1-999')).toBeNull();
    expect(await source.getItem('not-a-real-uid')).toBeNull();
  });

  it('search finds a hit and misses cleanly', async () => {
    const source = fixtureSource({
      '../../data/n5/grammar.json': () =>
        Promise.resolve({ default: { 1: [grammarItem({ title: 'Topic marker は' })] } }),
    });

    expect(await source.search('topic', { level: 'N5', section: 'grammar' })).toHaveLength(1);
    expect(await source.search('nonexistent-term', { level: 'N5', section: 'grammar' })).toEqual([]);
  });

  it('dedupes concurrent loads of the same chunk into one import call', async () => {
    const importer = vi.fn(() => Promise.resolve({ default: { 1: [grammarItem()] } }));
    const source = fixtureSource({ '../../data/n5/grammar.json': importer });

    await Promise.all([
      source.getItems('N5', 'grammar', 1),
      source.getItems('N5', 'grammar', 1),
      source.listLessons('N5', 'grammar'),
    ]);

    expect(importer).toHaveBeenCalledTimes(1);
  });

  it('rejects with a load-failed ContentError when the chunk has no matching module', async () => {
    const source = fixtureSource({});

    await expect(source.getItems('N5', 'grammar', 1)).rejects.toMatchObject({ kind: 'not-found' });
  });
});
