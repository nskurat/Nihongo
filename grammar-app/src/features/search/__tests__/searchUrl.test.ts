import { describe, expect, it } from 'vitest';
import {
  buildSearchPath,
  clearFilters,
  EMPTY_SEARCH_STATE,
  hasActiveFilters,
  isSearchPath,
  itemPath,
  levelScope,
  parseSearchParams,
  selectType,
  serializeSearchState,
  setCategory,
  setLevelScope,
  setTag,
  functionBrowseState,
  withQuery,
  toAbsoluteHref,
  toggleLevel,
  type SearchUrlState,
} from '../searchUrl';

const parse = (qs: string) => parseSearchParams(new URLSearchParams(qs));
const state = (over: Partial<SearchUrlState> = {}): SearchUrlState => ({ ...EMPTY_SEARCH_STATE, ...over });

describe('parseSearchParams', () => {
  it('reads q, comma lists in any case, tag and more', () => {
    const { state: s, dirty } = parse('q=ばかり&level=n3,N2&type=Grammar&more=grammar');
    expect(s).toEqual({ q: 'ばかり', levels: ['N3', 'N2'], types: ['grammar'], more: 'grammar' });
    expect(dirty).toBe(true);
  });

  it('canonicalises level order N5→N1 and uppercase', () => {
    expect(parse('level=n1,n5').canonical).toBe('level=N5%2CN1');
  });

  it('drops unknown values and marks the URL dirty', () => {
    const p = parse('q=x&level=N9,N3&type=foo&tag=not-a-tag&more=bogus');
    expect(p.state).toEqual({ q: 'x', levels: ['N3'], types: [] });
    expect(p.dirty).toBe(true);
    expect(p.canonical).toBe('q=x&level=N3');
  });

  it('treats a canonical URL as clean', () => {
    expect(parse('q=%E3%82%82%E3%81%AE%E3%81%AE&level=N2').dirty).toBe(false);
  });

  it('keeps tag and cat mutually exclusive (tag wins) and forces grammar', () => {
    const p = parse('tag=comparison&cat=comparison&type=vocab');
    expect(p.state).toEqual({ q: '', levels: [], types: ['grammar'], tag: 'comparison' });
  });

  it('accepts a slug cat and forces grammar', () => {
    expect(parse('cat=cause-reason').state).toEqual({ q: '', levels: [], types: ['grammar'], cat: 'cause-reason' });
    expect(parse('cat=Bad%20Id!').state.cat).toBeUndefined();
  });

  it('collapses "all three types" to no type filter', () => {
    expect(parse('type=grammar,vocab,kanji').state.types).toEqual([]);
  });

  it('drops `more` for a type that the type filter hides', () => {
    expect(parse('type=vocab&more=grammar').state.more).toBeUndefined();
  });
});

describe('serialise / build', () => {
  it('orders params q, level, type, tag, cat, more', () => {
    const qs = serializeSearchState(state({ q: 'a', levels: ['N2'], types: ['grammar'], more: 'grammar' })).toString();
    expect(qs).toBe('q=a&level=N2&type=grammar&more=grammar');
  });

  it('round-trips', () => {
    const s = state({ q: '〜ものの', levels: ['N3', 'N2'], types: ['grammar'] });
    expect(parse(serializeSearchState(s).toString()).state).toEqual(s);
  });

  it('builds router paths without the deployment base', () => {
    expect(buildSearchPath()).toBe('/search');
    expect(buildSearchPath({ tag: 'comparison' })).toBe('/search?type=grammar&tag=comparison');
    expect(isSearchPath('/search')).toBe(true);
    expect(isSearchPath('/n3/grammar/1')).toBe(false);
  });

  it('builds lesson deep links with ?focus', () => {
    expect(itemPath({ type: 'grammar', level: 'N2', lesson: 4, uid: 'n2-grammar-4-1' })).toBe('/n2/grammar/4?focus=n2-grammar-4-1');
  });

  it('prefixes absolute hrefs with BASE_URL', () => {
    expect(toAbsoluteHref('/search?q=a', '/Nihongo/')).toBe('/Nihongo/search?q=a');
    expect(toAbsoluteHref('/search', '/')).toBe('/search');
  });
});

describe('filter transitions', () => {
  it('toggles levels', () => {
    const a = toggleLevel(state(), 'N3');
    expect(a.levels).toEqual(['N3']);
    expect(toggleLevel(a, 'N3').levels).toEqual([]);
  });

  it('setTag clears cat and sets grammar; setCategory clears tag', () => {
    const withCat = setCategory(state({ q: 'so' }), 'cause-reason');
    expect(withCat).toMatchObject({ q: 'so', cat: 'cause-reason', types: ['grammar'] });
    const withTag = setTag(withCat, 'comparison');
    expect(withTag.cat).toBeUndefined();
    expect(withTag.tag).toBe('comparison');
  });

  it('selecting a non-grammar type drops the function filter', () => {
    expect(selectType(state({ tag: 'comparison', types: ['grammar'] }), 'vocab')).toEqual({ q: '', levels: [], types: ['vocab'] });
    expect(selectType(state({ types: ['kanji'], more: 'kanji' }), null)).toEqual({ q: '', levels: [], types: [] });
  });

  it('clearFilters keeps only q', () => {
    const s = state({ q: 'x', levels: ['N2'], types: ['grammar'], tag: 'comparison' });
    expect(hasActiveFilters(s)).toBe(true);
    expect(clearFilters(s)).toEqual({ q: 'x', levels: [], types: [] });
    expect(hasActiveFilters(clearFilters(s))).toBe(false);
  });
});

describe('level scope toggle (Only N3 | All levels)', () => {
  it('derives the active chip from level=', () => {
    expect(levelScope(state(), 'N3')).toBe('all');
    expect(levelScope(state({ levels: ['N3'] }), 'N3')).toBe('only');
    expect(levelScope(state({ levels: ['N2'] }), 'N3')).toBe('custom');
    expect(levelScope(state({ levels: ['N3', 'N2'] }), 'N3')).toBe('custom');
  });

  it('"Only N3" writes level=N3 and "All levels" clears it, keeping other params', () => {
    const base = state({ q: 'ばかり', types: ['grammar'], levels: ['N2', 'N3'] });
    const only = setLevelScope(base, 'only', 'N3');
    expect(serializeSearchState(only).toString()).toBe('q=%E3%81%B0%E3%81%8B%E3%82%8A&level=N3&type=grammar');
    const all = setLevelScope(only, 'all', 'N3');
    expect(all.levels).toEqual([]);
    expect(all.types).toEqual(['grammar']);
  });

  it('stays in sync with the rail: toggling the rank level from the rail flips the chip', () => {
    const viaRail = toggleLevel(state(), 'N4');
    expect(levelScope(viaRail, 'N4')).toBe('only');
    expect(levelScope(toggleLevel(viaRail, 'N5'), 'N4')).toBe('custom');
  });
});

describe('function filters (BUG-02/05/06)', () => {
  const cats = new Set(['comparison', 'degree', 'cause-reason']);

  it('a category chip clears q and levels and lists the whole category', () => {
    expect(functionBrowseState({ id: 'degree', tagIds: ['degree-extent', 'excessive-degree'] }, cats)).toEqual({
      q: '',
      levels: [],
      types: ['grammar'],
      cat: 'degree',
    });
  });

  it('a tag chip writes tag=, never cat=', () => {
    const s = functionBrowseState({ id: 'degree-extent', tagIds: ['degree-extent'] }, cats);
    expect(s.tag).toBe('degree-extent');
    expect(s.cat).toBeUndefined();
    expect(serializeSearchState(s).toString()).toBe('type=grammar&tag=degree-extent');
  });

  it('rewrites a cold cat=<tag id> to tag= and drops unknown categories', () => {
    expect(parseSearchParams(new URLSearchParams('cat=degree-extent'), cats).state).toEqual({
      q: '',
      levels: [],
      types: ['grammar'],
      tag: 'degree-extent',
    });
    const unknown = parseSearchParams(new URLSearchParams('q=a&cat=nope'), cats);
    expect(unknown.state).toEqual({ q: 'a', levels: [], types: [] });
    expect(unknown.dirty).toBe(true);
    expect(parseSearchParams(new URLSearchParams('type=grammar&cat=degree'), cats).dirty).toBe(false);
  });

  it('typing a new query clears the function filter (and the grammar type it implied)', () => {
    const browsing = state({ cat: 'comparison', types: ['grammar'], levels: ['N3'] });
    expect(withQuery(browsing, 'although')).toEqual({ q: 'although', levels: ['N3'], types: [] });
    const filtered = state({ q: 'a', types: ['vocab'], more: 'vocab' });
    expect(withQuery(filtered, 'ab')).toEqual({ q: 'ab', levels: [], types: ['vocab'] });
    expect(withQuery(filtered, 'a')).toBe(filtered);
  });
});
