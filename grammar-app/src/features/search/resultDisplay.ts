import type { DocType, Level, SearchHit, SearchResponse } from '../../services/search/types';
import { getTagMeta } from '../../utils/tags';
import { LEVELS } from './searchUrl';
import { S } from './strings';

/** Pure display logic for search results (grouping, caps, duplicates, reason lines). */

export const ROWS_COLLAPSED = 8;
export const ROWS_PAGE = 50;

const levelIndex = (l: Level) => LEVELS.indexOf(l);

export interface Occurrence {
  uid: string;
  type: DocType;
  level: Level;
  lesson: number;
}

/**
 * Collapsed duplicates (03-ux §3.3, Q-UX3): the primary link is the occurrence at the
 * learner's level when there is one, otherwise the lowest level (where it was first taught).
 * Returns every occurrence in level→lesson order with the primary flagged.
 */
export function occurrences(hit: SearchHit, rankLevel: Level): { primary: Occurrence; all: (Occurrence & { primary: boolean })[] } {
  const list: Occurrence[] = [
    { uid: hit.uid, type: hit.type, level: hit.level, lesson: hit.lesson },
    ...(hit.alsoAt ?? []).map((a) => ({ ...a, type: hit.type })),
  ];
  const seen = new Set<string>();
  const unique = list.filter((o) => (seen.has(o.uid) ? false : (seen.add(o.uid), true)));
  unique.sort((a, b) => levelIndex(a.level) - levelIndex(b.level) || a.lesson - b.lesson);
  const primary = unique.find((o) => o.level === rankLevel) ?? unique[0];
  return { primary, all: unique.map((o) => ({ ...o, primary: o.uid === primary.uid })) };
}

/** Rows to render for a group: 8 collapsed, or pages of 50 when expanded / single-type. */
export function visibleCount(total: number, expanded: boolean, pages: number): number {
  if (!expanded) return Math.min(total, ROWS_COLLAPSED);
  return Math.min(total, ROWS_PAGE * Math.max(1, pages));
}

export interface ReasonLine {
  from?: string;
  to?: string;
  note?: string;
}

/** The "why did this match" line, only for non-obvious tiers (03-ux §3.3). */
export function reasonLine(hit: SearchHit): ReasonLine | null {
  switch (hit.matchKind) {
    case 'deinflected': {
      const d = hit.deinflection;
      if (!d) return hit.via ? { to: hit.via, note: S.dictionaryForm } : null;
      // Steps are a sequence (可能・受身 → 否定 → 過去), not alternatives: labels may contain ・.
      const en = d.steps.map((s) => s.en).join(' → ');
      const ja = d.steps.map((s) => s.ja).join(' → ');
      // Only the polite ending was removed (わかります → わかる): name the dictionary form.
      const politeOnly = d.steps.length === 1 && d.steps[0].en === 'polite';
      const note = en && !politeOnly ? `${en}${ja ? `（${ja}）` : ''}` : S.dictionaryForm;
      // Show the word as it is written (→ 分かる), not its kana key (R11), when this row is
      // the dictionary form itself; a ます-row keeps the plain key (→ たべる).
      const word = hit.type === 'vocab' && hit.reading === d.lemma && !hit.title.endsWith('ます') ? hit.title : d.lemma;
      return { from: d.input, to: word, note };
    }
    case 'lemma':
      if (hit.via && hit.via !== hit.title) return { note: S.alsoWritten(hit.via) };
      return { to: hit.deinflection?.lemma ?? hit.title, note: S.dictionaryForm };
    case 'folded':
      return { note: S.similarReading(hit.reading ?? hit.via ?? '') };
    case 'compound':
      return hit.via ? { note: S.inCompound(hit.via) } : null;
    case 'kanjiFromWord':
      return hit.via ? { note: S.kanjiIn(hit.via) } : null;
    // 'tag' hits only appear in the tag/category view, whose heading already names it.
    default:
      return null;
  }
}

/** Grammar tags for a row: known tags only, function facet first, at most 3. */
export function rowTags(tags: readonly string[] | undefined, max = 3): string[] {
  const known = (tags ?? []).filter((t) => getTagMeta(t));
  const fn = known.filter((t) => getTagMeta(t)?.facet === 'function');
  const rest = known.filter((t) => getTagMeta(t)?.facet !== 'function');
  return [...fn, ...rest].slice(0, max);
}

/** Tag/category view: grammar hits under level subheadings, N5→N1, lesson order. */
export function groupByLevel(hits: readonly SearchHit[]): { level: Level; hits: SearchHit[] }[] {
  const sorted = [...hits].sort((a, b) => levelIndex(a.level) - levelIndex(b.level) || a.lesson - b.lesson);
  const out: { level: Level; hits: SearchHit[] }[] = [];
  for (const h of sorted) {
    const last = out[out.length - 1];
    if (last && last.level === h.level) last.hits.push(h);
    else out.push({ level: h.level, hits: [h] });
  }
  return out;
}

export function totalResults(res: Pick<SearchResponse, 'totals'>): number {
  return res.totals.grammar + res.totals.vocab + res.totals.kanji;
}

/** Groups to render, in service order, empty groups omitted. */
export function nonEmptyGroups(res: Pick<SearchResponse, 'groupOrder' | 'groups' | 'totals'>): DocType[] {
  return res.groupOrder.filter((t) => (res.groups[t]?.length ?? 0) > 0 && res.totals[t] > 0);
}

/** DOM id for a row option (combobox aria-activedescendant target). */
export const optionId = (uid: string) => `search-opt-${uid}`;
export const moreOptionId = (type: DocType) => `search-more-${type}`;

export interface GroupView {
  type: DocType;
  rows: SearchHit[];
  total: number;
  footer?: { kind: 'all' | 'more'; count: number };
}

/**
 * What each type group renders (03-ux §3.2): 8 rows collapsed with "Show all N"; the
 * expanded group (`more=`) or a single-type filter pages through 50 at a time.
 */
export function buildGroupViews(
  res: Pick<SearchResponse, 'groupOrder' | 'groups' | 'totals'>,
  state: { types: readonly DocType[]; more?: DocType },
  pages: number
): GroupView[] {
  const single = state.types.length === 1;
  return nonEmptyGroups(res).map((type) => {
    const all = res.groups[type];
    const total = res.totals[type];
    const expanded = single || state.more === type;
    const rows = all.slice(0, visibleCount(all.length, expanded, pages));
    let footer: GroupView['footer'];
    if (!expanded && total > rows.length) footer = { kind: 'all', count: total };
    else if (expanded && all.length > rows.length) footer = { kind: 'more', count: Math.min(ROWS_PAGE, all.length - rows.length) };
    return { type, rows, total, footer };
  });
}
