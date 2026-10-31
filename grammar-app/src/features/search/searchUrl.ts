import type { DocType, Level } from '../../services/search/types';
import { getTagMeta } from '../../utils/tags';

/**
 * URL state for /search (docs/search/03-ux.md §3.4). Pure: parse, canonicalise, serialise.
 * Paths returned here are router paths (no BASE_URL); react-router's basename adds the
 * sub-path, and `toAbsoluteHref` adds it for window.open.
 */

export const LEVELS: readonly Level[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
export const DOC_TYPES: readonly DocType[] = ['grammar', 'vocab', 'kanji'];
export const SEARCH_PATH = '/search';

export interface SearchUrlState {
  q: string;
  levels: Level[];
  types: DocType[];
  tag?: string;
  cat?: string;
  more?: DocType;
}

export const EMPTY_SEARCH_STATE: SearchUrlState = { q: '', levels: [], types: [] };

const CATEGORY_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

function splitList(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseLevels(raw: string | null): Level[] {
  const wanted = new Set(splitList(raw).map((s) => s.toUpperCase()));
  return LEVELS.filter((l) => wanted.has(l));
}

function parseTypes(raw: string | null): DocType[] {
  const wanted = new Set(splitList(raw).map((s) => s.toLowerCase()));
  return DOC_TYPES.filter((t) => wanted.has(t));
}

/** Applies the cross-field rules: tag XOR cat, tag/cat imply grammar, `more` must be shown. */
/**
 * `categoryIds` (the alias-category ids, known on the results page) lets a `cat=` that is
 * really a tag id become `tag=`, and drops unknown categories. Without it any slug is kept.
 */
export function normaliseSearchState(input: SearchUrlState, categoryIds?: ReadonlySet<string>): SearchUrlState {
  const levels = LEVELS.filter((l) => input.levels.includes(l));
  let types = DOC_TYPES.filter((t) => input.types.includes(t));
  let tag = input.tag && getTagMeta(input.tag) ? input.tag : undefined;
  let cat = !tag && input.cat && CATEGORY_ID.test(input.cat) ? input.cat : undefined;
  if (cat && categoryIds && !categoryIds.has(cat)) {
    if (getTagMeta(cat)) tag = cat;
    cat = undefined;
  }
  if (tag || cat) types = ['grammar'];
  // Selecting every type is the same as no type filter.
  if (types.length === DOC_TYPES.length) types = [];
  let more = input.more && DOC_TYPES.includes(input.more) ? input.more : undefined;
  if (more && types.length > 0 && !types.includes(more)) more = undefined;
  const out: SearchUrlState = { q: input.q, levels, types };
  if (tag) out.tag = tag;
  if (cat) out.cat = cat;
  if (more) out.more = more;
  return out;
}

export function serializeSearchState(state: SearchUrlState, categoryIds?: ReadonlySet<string>): URLSearchParams {
  const s = normaliseSearchState(state, categoryIds);
  const params = new URLSearchParams();
  if (s.q) params.set('q', s.q);
  if (s.levels.length) params.set('level', s.levels.join(','));
  if (s.types.length) params.set('type', s.types.join(','));
  if (s.tag) params.set('tag', s.tag);
  if (s.cat) params.set('cat', s.cat);
  if (s.more) params.set('more', s.more);
  return params;
}

export interface ParsedSearchParams {
  state: SearchUrlState;
  /** Canonical query string (no leading `?`). */
  canonical: string;
  /** True when the incoming params differ from the canonical form (unknown values etc.). */
  dirty: boolean;
}

export function parseSearchParams(params: URLSearchParams, categoryIds?: ReadonlySet<string>): ParsedSearchParams {
  const moreRaw = params.get('more')?.toLowerCase();
  const raw: SearchUrlState = {
    q: params.get('q') ?? '',
    levels: parseLevels(params.get('level')),
    types: parseTypes(params.get('type')),
    tag: params.get('tag')?.trim() || undefined,
    cat: params.get('cat')?.trim().toLowerCase() || undefined,
    more: DOC_TYPES.find((t) => t === moreRaw),
  };
  const state = normaliseSearchState(raw, categoryIds);
  const canonical = serializeSearchState(state).toString();
  return { state, canonical, dirty: canonical !== params.toString() };
}

export function buildSearchPath(state: Partial<SearchUrlState> = {}): string {
  const qs = serializeSearchState({ ...EMPTY_SEARCH_STATE, ...state }).toString();
  return qs ? `${SEARCH_PATH}?${qs}` : SEARCH_PATH;
}

export function isSearchPath(pathname: string): boolean {
  return pathname === SEARCH_PATH || pathname === `${SEARCH_PATH}/`;
}

export function hasActiveFilters(state: SearchUrlState): boolean {
  return state.levels.length > 0 || state.types.length > 0 || !!state.tag || !!state.cat;
}

export function toggleLevel(state: SearchUrlState, level: Level): SearchUrlState {
  const levels = state.levels.includes(level)
    ? state.levels.filter((l) => l !== level)
    : [...state.levels, level];
  return normaliseSearchState({ ...state, levels });
}

/** Single-select type chip; `null` means "All". Clears tag/cat when leaving grammar. */
export function selectType(state: SearchUrlState, type: DocType | null): SearchUrlState {
  if (type === null) return normaliseSearchState({ ...state, types: [], tag: undefined, cat: undefined, more: undefined });
  const keepFunction = type === 'grammar';
  return normaliseSearchState({
    ...state,
    types: [type],
    tag: keepFunction ? state.tag : undefined,
    cat: keepFunction ? state.cat : undefined,
    more: undefined,
  });
}

export function setTag(state: SearchUrlState, tag: string | undefined): SearchUrlState {
  return normaliseSearchState({ ...state, tag, cat: undefined, types: tag ? ['grammar'] : state.types, more: undefined });
}

export function setCategory(state: SearchUrlState, cat: string | undefined): SearchUrlState {
  return normaliseSearchState({ ...state, cat, tag: undefined, types: cat ? ['grammar'] : state.types, more: undefined });
}

/**
 * One-tap scope toggle: "Only N3" ⇔ `level=N3`, "All levels" ⇔ no `level`. Any other
 * level selection (another single level, or several) is 'custom' and neither chip is on.
 */
export type LevelScope = 'only' | 'all' | 'custom';

export function levelScope(state: Pick<SearchUrlState, 'levels'>, rankLevel: Level): LevelScope {
  if (state.levels.length === 0) return 'all';
  if (state.levels.length === 1 && state.levels[0] === rankLevel) return 'only';
  return 'custom';
}

export function setLevelScope(state: SearchUrlState, scope: 'only' | 'all', rankLevel: Level): SearchUrlState {
  return normaliseSearchState({ ...state, levels: scope === 'only' ? [rankLevel] : [] });
}

/**
 * State for a category / tag chip: every grammar point in it, with no query and no level
 * filter, so "45 points" opens 45 (BUG-02). Tag chips (a single tag whose id is the chip
 * id) write `tag=`; alias categories write `cat=` (BUG-06).
 */
export function functionBrowseState(chip: { id: string; tagIds: readonly string[] }, categoryIds?: ReadonlySet<string>): SearchUrlState {
  const isTagChip = !!getTagMeta(chip.id) && chip.tagIds.length === 1 && chip.tagIds[0] === chip.id;
  const asCategory = categoryIds ? categoryIds.has(chip.id) && !isTagChip : !isTagChip;
  return normaliseSearchState(
    asCategory ? { q: '', levels: [], types: ['grammar'], cat: chip.id } : { q: '', levels: [], types: ['grammar'], tag: chip.id },
    categoryIds
  );
}

/**
 * A newly typed query. The function filter (tag/cat) belongs to the browse view it came
 * from, so it is cleared when the query changes (BUG-05), together with the grammar type it
 * implied and the expanded group.
 */
export function withQuery(state: SearchUrlState, q: string): SearchUrlState {
  if (q === state.q) return state;
  const hadFunction = !!(state.tag || state.cat);
  return normaliseSearchState({
    q,
    levels: state.levels,
    types: hadFunction ? [] : state.types,
  });
}

export function clearFilters(state: SearchUrlState): SearchUrlState {
  return { q: state.q, levels: [], types: [] };
}

/** Lesson deep link for a hit: `/n2/grammar/4?focus=n2-grammar-4-1`. */
export function itemPath(item: { type: DocType; level: Level; lesson: number; uid: string }): string {
  return `/${item.level.toLowerCase()}/${item.type}/${item.lesson}?focus=${encodeURIComponent(item.uid)}`;
}

/** Router path → href including the deployment sub-path (for window.open / copy). */
export function toAbsoluteHref(to: string, base: string = import.meta.env.BASE_URL): string {
  return `${base.replace(/\/+$/, '')}${to.startsWith('/') ? to : `/${to}`}`;
}
