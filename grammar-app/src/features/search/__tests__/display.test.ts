import { describe, expect, it } from 'vitest';
import type { DocType, SearchHit } from '../../../services/search/types';
import { rangesFor, splitHighlights } from '../highlight';
import { isComposingKey, isSearchShortcut, isTypingTarget } from '../keyboard';
import { buildGroupViews, groupByLevel, occurrences, reasonLine, rowTags, visibleCount } from '../resultDisplay';
import { liveCountMessage } from '../strings';
import { buildRequest, searchMode } from '../useSearch';
import { useSearchUiStore } from '../searchUiStore';

const hit = (over: Partial<SearchHit> = {}): SearchHit => ({
  uid: 'n3-vocab-1-35',
  type: 'vocab',
  level: 'N3',
  lesson: 1,
  title: 'ちょうど',
  meaning: 'just',
  matchKind: 'exact',
  matchField: 'title',
  tier: 0,
  ...over,
});

describe('splitHighlights', () => {
  it('returns one plain segment without ranges', () => {
    expect(splitHighlights('ものの', undefined)).toEqual([{ text: 'ものの', mark: false }]);
  });
  it('marks ranges, merging overlaps and clamping', () => {
    expect(splitHighlights('〜ばかりに', [[1, 3], [2, 4], [9, 12]])).toEqual([
      { text: '〜', mark: false },
      { text: 'ばかり', mark: true },
      { text: 'に', mark: false },
    ]);
  });
  it('drops empty and inverted ranges safely', () => {
    expect(splitHighlights('abc', [[2, 2], [3, 1]])).toEqual([
      { text: 'a', mark: false },
      { text: 'bc', mark: true },
    ]);
  });
  it('collects ranges per field', () => {
    const h = hit({ highlights: [{ field: 'title', ranges: [[0, 1]] }, { field: 'meaning', ranges: [[0, 4]] }] });
    expect(rangesFor(h, 'title')).toEqual([[0, 1]]);
    expect(rangesFor(h, 'reading')).toEqual([]);
  });
});

describe('occurrences (collapsed duplicates)', () => {
  const dup = hit({
    alsoAt: [
      { uid: 'n4-vocab-21-10', level: 'N4', lesson: 21 },
      { uid: 'n3-vocab-15-155', level: 'N3', lesson: 15 },
    ],
  });
  it('orders by level then lesson and picks the learner level as primary', () => {
    const { primary, all } = occurrences(dup, 'N3');
    expect(all.map((o) => o.uid)).toEqual(['n4-vocab-21-10', 'n3-vocab-1-35', 'n3-vocab-15-155']);
    expect(primary.uid).toBe('n3-vocab-1-35');
  });
  it('falls back to the lowest level', () => {
    expect(occurrences(dup, 'N1').primary.uid).toBe('n4-vocab-21-10');
  });
});

describe('reasonLine', () => {
  it('is null for exact hits', () => expect(reasonLine(hit())).toBeNull());
  it('describes a deinflection with EN then JA labels', () => {
    const r = reasonLine(
      hit({
        matchKind: 'deinflected',
        title: '待つ',
        deinflection: { input: '待たされた', lemma: '待つ', steps: [{ en: 'causative-passive', ja: '使役受身' }, { en: 'past', ja: '過去' }] },
      })
    );
    expect(r).toEqual({ from: '待たされた', to: '待つ', note: 'causative-passive, past（使役受身・過去）' });
  });
  it('uses the short dictionary-form line for lemma hits', () => {
    expect(reasonLine(hit({ matchKind: 'lemma', title: '分かる' }))).toEqual({ to: '分かる', note: '(dictionary form)' });
  });
  it('explains compounds and word decomposition', () => {
    expect(reasonLine(hit({ matchKind: 'compound', via: '迷子' }))?.note).toBe('in 迷子');
    expect(reasonLine(hit({ matchKind: 'kanjiFromWord', via: '迷惑' }))?.note).toBe('kanji in 迷惑');
  });
});

describe('group views', () => {
  const mk = (type: DocType, n: number) => Array.from({ length: n }, (_, i) => hit({ uid: `${type}-${i}`, type }));
  const res = {
    groupOrder: ['grammar', 'vocab', 'kanji'] as DocType[],
    groups: { grammar: mk('grammar', 8), vocab: mk('vocab', 3), kanji: [] },
    totals: { grammar: 12, vocab: 3, kanji: 0 },
  };
  it('caps at 8 with "Show all N" and omits empty groups', () => {
    const v = buildGroupViews(res, { types: [] }, 1);
    expect(v.map((g) => g.type)).toEqual(['grammar', 'vocab']);
    expect(v[0].footer).toEqual({ kind: 'all', count: 12 });
    expect(v[1].footer).toBeUndefined();
  });
  it('pages expanded groups 50 at a time', () => {
    const big = { ...res, groups: { ...res.groups, grammar: mk('grammar', 120) }, totals: { ...res.totals, grammar: 120 } };
    const v = buildGroupViews(big, { types: [], more: 'grammar' }, 1);
    expect(v[0].rows).toHaveLength(50);
    expect(v[0].footer).toEqual({ kind: 'more', count: 50 });
    expect(buildGroupViews(big, { types: ['grammar'] }, 3)[0].footer).toBeUndefined();
    expect(visibleCount(5, false, 1)).toBe(5);
  });
  it('groups tag views by level, N5→N1', () => {
    const g = groupByLevel([hit({ level: 'N1', uid: 'a' }), hit({ level: 'N5', uid: 'b', lesson: 12 }), hit({ level: 'N5', uid: 'c', lesson: 2 })]);
    expect(g.map((x) => [x.level, x.hits.map((h) => h.uid)])).toEqual([
      ['N5', ['c', 'b']],
      ['N1', ['a']],
    ]);
  });
  it('orders row tags function-facet first, max 3, known only', () => {
    expect(rowTags(['formal-written', 'concession-contrast', 'nope'])).toEqual(['concession-contrast', 'formal-written']);
  });
});

describe('live region copy', () => {
  it('matches the spec wording', () => {
    expect(liveCountMessage({ grammar: 8, vocab: 40, kanji: 5 }, ['grammar', 'vocab', 'kanji'])).toBe(
      '53 results: 8 grammar, 40 vocabulary, 5 kanji.'
    );
    expect(liveCountMessage({ grammar: 8, vocab: 0, kanji: 0 }, ['grammar', 'vocab', 'kanji'])).toBe('8 results: 8 grammar.');
  });
});

describe('keyboard predicates', () => {
  const k = (over: Partial<Parameters<typeof isSearchShortcut>[0]>) => ({ key: '', ctrlKey: false, metaKey: false, altKey: false, ...over });
  it('recognises / and Ctrl/Cmd+K', () => {
    expect(isSearchShortcut(k({ key: '/' }))).toBe(true);
    expect(isSearchShortcut(k({ key: 'k', metaKey: true }))).toBe(true);
    expect(isSearchShortcut(k({ key: 'K', ctrlKey: true }))).toBe(true);
    expect(isSearchShortcut(k({ key: 'k' }))).toBe(false);
  });
  it('ignores keys during IME composition', () => {
    expect(isSearchShortcut(k({ key: '/', isComposing: true }))).toBe(false);
    expect(isComposingKey({ keyCode: 229 })).toBe(true);
  });
  it('detects typing targets', () => {
    expect(isTypingTarget({ tagName: 'INPUT' } as Element)).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true } as unknown as Element)).toBe(true);
    expect(isTypingTarget({ tagName: 'BUTTON' } as Element)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe('search request', () => {
  it('derives the mode', () => {
    expect(searchMode({ q: '  ' })).toBe('empty');
    expect(searchMode({ q: '', tag: 'comparison' })).toBe('browse');
    expect(searchMode({ q: 'a', cat: 'comparison' })).toBe('search');
  });
  it('maps URL state to SearchOptions', () => {
    const r = buildRequest({ q: ' ばかり ', levels: ['N2'], types: [], more: 'grammar' }, 'N3');
    expect(r.q).toBe('ばかり');
    expect(r.opts).toMatchObject({ rankLevel: 'N3', levels: ['N2'], types: undefined, limitPerType: Infinity });
    expect(buildRequest({ q: 'x', levels: [], types: [] }, 'N3').opts.limitPerType).toBe(8);
  });
});

describe('combobox store', () => {
  const link = (id: string) => ({ id, kind: 'link' as const, to: `/${id}` });
  it('selects row 1 on a new list, wraps on arrows, restores the last opened row', () => {
    const s = useSearchUiStore.getState();
    s.setItems([link('a'), link('b'), link('c')], 'q1');
    expect(useSearchUiStore.getState().activeId).toBe('a');
    s.move(-1);
    expect(useSearchUiStore.getState().activeId).toBe('c');
    s.move(1);
    expect(useSearchUiStore.getState().activeId).toBe('a');
    s.markOpened('b');
    s.setItems([], 'q1'); // results page remounting, still loading
    s.setItems([link('a'), link('b'), link('c')], 'q1');
    expect(useSearchUiStore.getState().activeId).toBe('b');
    s.setItems([link('x'), link('b')], 'q2');
    expect(useSearchUiStore.getState().activeId).toBe('x');
  });
});
