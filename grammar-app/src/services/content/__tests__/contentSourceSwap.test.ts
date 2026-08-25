import { describe, it, expect, afterEach } from 'vitest';
import { contentRepository, setContentSource, StaticContentSource } from '../StaticContentSource';
import { InMemoryContentSource } from './InMemoryContentSource';
import { GrammarItem } from '../../../types/japanese';

/**
 * Proves the database-migration promise the phase spec is built on: swapping
 * the active ContentSource changes what contentRepository returns with zero
 * changes anywhere else - every hook and component only ever calls
 * contentRepository, never a concrete source class.
 */
describe('ContentSource swap', () => {
  afterEach(() => {
    setContentSource(new StaticContentSource());
  });

  it('serves an entirely different backend through the same repository facade', async () => {
    const fixtureItem: GrammarItem = {
      uid: 'n5-grammar-1-1',
      level: 'N5',
      section: 'grammar',
      lesson: 1,
      title: 'Fixture pattern',
      meaning: 'from an in-memory source',
      structure: '...',
      explanation: '...',
    };

    setContentSource(
      new InMemoryContentSource({
        N5: { grammar: { 1: [fixtureItem] } },
      })
    );

    expect(await contentRepository.listLessons('N5', 'grammar')).toEqual([{ lesson: 1, count: 1 }]);
    expect(await contentRepository.getItems('N5', 'grammar', 1)).toEqual([fixtureItem]);
    expect(await contentRepository.getItem('n5-grammar-1-1')).toEqual(fixtureItem);
  });

  it('rejects a source that does not inherit from BaseContentSource', () => {
    expect(() => setContentSource({} as never)).toThrow();
  });
});
