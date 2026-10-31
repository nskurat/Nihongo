import { describe, expect, it } from 'vitest';
import taxonomy from '../../../data/tag-taxonomy.json';
import type { GrammarItem, KanjiItem, TagTaxonomy, VocabItem } from '../../../types/japanese';
import { ALIAS_CATEGORIES, aliasKey } from '../aliases';
import { buildSearchIndex, type SearchContent } from '../indexer/buildSearchIndex';
import { ContentHashMismatchError, SearchEngine } from '../engine/SearchEngine';
import { compareHits, groupOrderFor, levelRank, orderGroups } from '../rank';
import type { DocType, Level } from '../types';

const g = (uid: string, title: string, meaning: string, tags: string[] = [], structure = ''): GrammarItem => {
  const [lv, , lesson] = uid.split('-');
  return { uid, level: lv.toUpperCase() as Level, section: 'grammar', lesson: Number(lesson), title, meaning, structure, explanation: '', tags };
};
const v = (uid: string, word: string, reading: string, meaning: string, pos?: string): VocabItem => {
  const [lv, , lesson] = uid.split('-');
  return { uid, level: lv.toUpperCase() as Level, section: 'vocab', lesson: Number(lesson), word, reading, meaning, ...(pos ? { pos } : {}) };
};
const k = (uid: string, kanji: string, meaning: string, onyomi: string[], kunyomi: string[]): KanjiItem => {
  const [lv, , lesson] = uid.split('-');
  return { uid, level: lv.toUpperCase() as Level, section: 'kanji', lesson: Number(lesson), kanji, meaning, onyomi, kunyomi, strokes: 1 };
};

const content: SearchContent = {
  taxonomy: taxonomy as TagTaxonomy,
  grammar: {
    N5: { 4: [g('n5-grammar-4-1', 'N(time)に V', 'At (time)', ['time-relative'])] },
    N3: { 8: [g('n3-grammar-8-1', '〜ながらも', 'Although', ['concession-contrast'], 'V-stem + ながらも')] },
    N2: { 4: [g('n2-grammar-4-1', '〜ものの', 'Although; even though', ['concession-contrast'])] },
  },
  vocab: {
    N5: {
      2: [v('n5-vocab-2-1', '二', 'に', 'two')],
      6: [v('n5-vocab-6-1', '食べます', 'たべます', 'eat', 'Verb (Group II)'), v('n5-vocab-6-2', 'お酒', 'おさけ', 'alcohol')],
    },
    N4: { 21: [v('n4-vocab-21-1', 'ちょうど', 'ちょうど', 'just, exactly')] },
    N3: {
      1: [v('n3-vocab-1-1', 'ちょうど', 'ちょうど', 'just'), v('n3-vocab-1-2', '迷う [道に〜]', 'まよう', "lose [one's way]")],
      10: [v('n3-vocab-10-1', '酒', 'さけ', 'sake'), v('n3-vocab-10-2', 'にぎやか', 'にぎやか', 'lively')],
    },
  },
  kanji: {
    N5: { 7: [k('n5-kanji-7-1', '食', 'eat, food', ['ショク'], ['た・べる', 'く・う'])] },
    N3: { 1: [k('n3-kanji-1-1', '迷', 'astray, lost', ['メイ'], ['まよ・う'])] },
  },
};

function engine(): SearchEngine {
  const e = new SearchEngine();
  const { shards } = buildSearchIndex(content, 'fixture');
  e.expected = shards.map((s) => s.shard);
  for (const s of shards) e.addShard(s);
  return e;
}
const opts = { rankLevel: 'N5' as Level };

describe('SearchEngine (fixture)', () => {
  it('single-kana guard: exact surface/reading only', () => {
    const r = engine().search('に', opts);
    expect(r.exactOnly).toBe(true);
    expect(r.groups.grammar.map((h) => h.uid)).toEqual(['n5-grammar-4-1']);
    expect(r.groups.vocab.map((h) => h.uid)).toEqual(['n5-vocab-2-1']); // not にぎやか
  });

  it('lemma, alias and deinflection tiers', () => {
    const e = engine();
    const taberu = e.search('食べる', opts).groups.vocab[0];
    expect(taberu).toMatchObject({ uid: 'n5-vocab-6-1', matchKind: 'lemma', tier: 1 });
    const sake = e.search('さけ', opts).groups.vocab.map((h) => [h.uid, h.matchKind]);
    expect(sake).toEqual([['n3-vocab-10-1', 'exact'], ['n5-vocab-6-2', 'lemma']]);
    const de = e.search('食べられない', opts).groups.vocab[0];
    expect(de.matchKind).toBe('deinflected');
    expect(de.deinflection).toMatchObject({ input: '食べられない', lemma: '食べる' });
  });

  it('collapses duplicates into alsoAt, keeping the best-ranked row primary', () => {
    const r = engine().search('ちょうど', { rankLevel: 'N3' });
    expect(r.groups.vocab).toHaveLength(1);
    expect(r.groups.vocab[0].uid).toBe('n4-vocab-21-1'); // more basic level first
    expect(r.groups.vocab[0].alsoAt).toEqual([{ uid: 'n3-vocab-1-1', level: 'N3', lesson: 1 }]);
    expect(r.totals.vocab).toBe(1);
  });

  it('filters, facet counts and hidden counts', () => {
    const e = engine();
    const r = e.search('although', { ...opts, levels: ['N2'] });
    expect(r.groups.grammar.map((h) => h.uid)).toEqual(['n2-grammar-4-1']);
    expect(r.facetCounts.level).toMatchObject({ N2: 1, N3: 1 });
    expect(r.hiddenByFilters).toBe(1);
    expect(r.otherLevelsCount).toBe(1);
    const typed = e.search('although', { ...opts, types: ['vocab'] });
    expect(typed.totals.grammar).toBe(0);
    expect(typed.facetCounts.type.grammar).toBe(2);
  });

  it('category chips and tag listing', () => {
    const e = engine();
    const r = e.search('although', opts);
    expect(r.categories).toEqual([{ id: 'concession-contrast', label: 'Concession / Contrast', count: 2, tagIds: ['concession-contrast'] }]);
    expect(e.listByTag('concession-contrast').map((h) => h.uid)).toEqual(['n3-grammar-8-1', 'n2-grammar-4-1']);
    expect(e.listByTag('concession-contrast')[0].via).toBe('Concession / Contrast');
    // An alias-category id (not a tag id) works too: `cat=` with no query.
    expect(e.listByTag('time-sequence').map((h) => h.uid)).toEqual(['n5-grammar-4-1']);
    expect(e.listByTag('time-sequence')[0].via).toBe('Time / sequence');
    const withCat = e.search('', { ...opts, category: 'concession-contrast' });
    expect(withCat.totals.grammar).toBe(2);
    expect(e.listCategories().find((c) => c.id === 'concession-contrast')?.count).toBe(2);
  });

  it('highlights index the display string', () => {
    const e = engine();
    const h = e.search('ながらも', opts).groups.grammar[0];
    expect(h.highlights).toEqual([{ field: 'title', ranges: [[1, 5]] }]);
    const lost = e.search('lost', opts).groups.kanji[0];
    expect(lost.highlights).toEqual([{ field: 'meaning', ranges: [[8, 12]] }]);
    const kana = e.search('まよう', opts).groups.vocab[0];
    expect(kana.highlights).toEqual([{ field: 'reading', ranges: [[0, 3]] }]);
  });

  it('kanji from word, wordMatch and group order', () => {
    const e = engine();
    const r = e.search('迷子', opts);
    expect(r.wordMatch).toBe(false);
    expect(r.groups.kanji[0]).toMatchObject({ title: '迷', matchKind: 'kanjiFromWord', via: '迷子' });
    expect(e.search('食', opts).groupOrder[0]).toBe('kanji');
    expect(e.search('ながら', opts).groupOrder[0]).toBe('grammar');
    expect(e.search('eat', opts).groupOrder[0]).toBe('vocab');
  });

  it('kanji kun stems match, but not under the single-kana guard', () => {
    const e = engine();
    expect(e.search('まよ', opts).groups.kanji[0]?.title).toBe('迷');
    expect(e.search('く', opts).groups.kanji).toEqual([]);
  });

  it('rejects shards from a different build', () => {
    const e = engine();
    const other = buildSearchIndex(content, 'other').shards[0];
    const fresh = new SearchEngine();
    fresh.addShard(buildSearchIndex(content, 'fixture').shards[1]);
    expect(() => fresh.addShard(other)).toThrow(ContentHashMismatchError);
    expect(e.isComplete).toBe(true);
  });

  it('reports partial status until every expected shard is in', () => {
    const e = new SearchEngine();
    const { shards } = buildSearchIndex(content, 'fixture');
    e.expected = shards.map((s) => s.shard);
    e.addShard(shards[0]);
    expect(e.search('ながら', opts).status).toBe('partial');
  });

  it('exposes logical SearchDocuments (the DB contract)', () => {
    const docs = engine().documents();
    const mayou = docs.find((d) => d.uid === 'n3-vocab-1-2');
    expect(mayou?.keys).toMatchObject({ surface: ['迷う'], reading: ['まよう'], hint: ['道に'], folded: ['まよ'], kanjiChars: ['迷'] });
    expect(docs.find((d) => d.uid === 'n3-kanji-1-1')?.keys.reading).toEqual(['めい', 'まよう', 'まよ']);
  });
});

describe('rank', () => {
  it('more basic levels first, whatever the current level', () => {
    const order = (['N1', 'N3', 'N5', 'N2', 'N4'] as Level[]).sort((a, b) => levelRank(a, 'N3') - levelRank(b, 'N3'));
    expect(order).toEqual(['N5', 'N4', 'N3', 'N2', 'N1']);
  });

  it('orders groups by their best hit, vocab winning a verb tie', () => {
    const d: DocType[] = ['grammar', 'vocab', 'kanji'];
    expect(orderGroups(d, { grammar: { tier: 0, sub: 0 }, vocab: { tier: 0, sub: 0 } }, true)).toEqual(['vocab', 'grammar', 'kanji']);
    expect(orderGroups(d, { grammar: { tier: 0, sub: 0 }, vocab: { tier: 0, sub: 0 } }, false)).toEqual(['grammar', 'vocab', 'kanji']);
    expect(orderGroups(d, { grammar: { tier: 4, sub: 0 }, vocab: { tier: 2, sub: 0 } }, false)).toEqual(['vocab', 'grammar', 'kanji']);
    expect(orderGroups(d, { kanji: { tier: 0, sub: 0 } }, false)).toEqual(['kanji', 'grammar', 'vocab']);
  });

  it('tier, then sub, then level, lesson, position', () => {
    const cmp = compareHits('N5');
    const a = { tier: 0, sub: 0, level: 'N1' as Level, len: 0, lesson: 1, pos: 1 };
    const b = { tier: 2, sub: 0, level: 'N5' as Level, len: 0, lesson: 1, pos: 1 };
    expect(cmp(a, b)).toBeLessThan(0);
    expect(cmp({ ...b, lesson: 2 }, { ...b, lesson: 10 })).toBeLessThan(0);
    expect(cmp({ ...b, pos: 2 }, { ...b, pos: 10 })).toBeLessThan(0);
  });

  it('group order by script', () => {
    expect(groupOrderFor('kanji', { singleKanji: true, romajiExact: false })[0]).toBe('kanji');
    expect(groupOrderFor('kana', { singleKanji: false, romajiExact: false })[0]).toBe('grammar');
    expect(groupOrderFor('english', { singleKanji: false, romajiExact: false })[0]).toBe('vocab');
    expect(groupOrderFor('romaji', { singleKanji: false, romajiExact: true })[0]).toBe('vocab');
  });
});

describe('alias layer', () => {
  const tagIds = new Set(Object.values((taxonomy as TagTaxonomy).facets).flatMap((f) => Object.keys(f.tags)));

  it('every category references existing tags, with unique ids and aliases', () => {
    const ids = new Set<string>();
    for (const c of ALIAS_CATEGORIES) {
      expect(ids.has(c.id), c.id).toBe(false);
      ids.add(c.id);
      expect(c.label).toBeTruthy();
      for (const t of c.tags) expect(tagIds.has(t), `${c.id} → ${t}`).toBe(true);
      const keys = c.aliases.map(aliasKey);
      expect(new Set(keys).size, `${c.id} aliases unique`).toBe(keys.length);
    }
    expect(ALIAS_CATEGORIES.length).toBeGreaterThanOrEqual(22);
    for (const c of ALIAS_CATEGORIES) {
      for (const [alias, keys] of Object.entries(c.core ?? {})) {
        expect(c.aliases, `${c.id} core alias ${alias}`).toContain(alias);
        expect(keys.length).toBeGreaterThan(0);
      }
    }
  });

  it('ambiguous short words map to several categories', () => {
    for (const word of ['so', 'for', 'while']) {
      expect(ALIAS_CATEGORIES.filter((c) => c.aliases.includes(word)).length, word).toBeGreaterThan(1);
    }
  });
});
