import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useLocation, useNavigate, useNavigationType, useSearchParams } from 'react-router-dom';
import type { CategoryChip, DocType, Level, SearchHit, SearchResponse } from '../../services/search/types';
import { ALIAS_CATEGORIES } from '../../services/search/aliases';
import { useAppStore } from '../../store/useAppStore';
import { getTagMeta } from '../../utils/tags';
import { useScrollRestore } from '../useScrollRestore';
import CategoryChips from './CategoryChips';
import ResultGroup, { ResultRows, type RowContext } from './ResultGroup';
import ScopeToggle from './ScopeToggle';
import SearchEmptyState from './SearchEmptyState';
import SearchFilters from './SearchFilters';
import SearchStatus from './SearchStatus';
import { buildGroupViews, groupByLevel, moreOptionId, occurrences, optionId, totalResults, type GroupView } from './resultDisplay';
import {
  clearFilters,
  functionBrowseState,
  hasActiveFilters,
  itemPath,
  levelScope,
  parseSearchParams,
  serializeSearchState,
  setLevelScope,
  type SearchUrlState,
} from './searchUrl';
import { FROM_SEARCH, useSearchUiStore, type NavItem } from './searchUiStore';
import { liveCountMessage, S } from './strings';
import { useSearch } from './useSearch';

const CATEGORY_IDS: ReadonlySet<string> = new Set(ALIAS_CATEGORIES.map((c) => c.id));
const CATEGORY_LABELS = new Map(ALIAS_CATEGORIES.map((c) => [c.id, c.label]));
const BASE_TITLE = typeof document !== 'undefined' ? document.title : 'Japanese Study Guide';

/** "Show 50 more" pages per results URL, kept across Back so restored scroll has its rows. */
const pagesByUrl = new Map<string, number>();

/** Label for the active function filter: never a raw id (BUG-06). */
function functionLabelFor(state: SearchUrlState): string | undefined {
  if (state.tag) return getTagMeta(state.tag)?.label;
  if (state.cat) return CATEGORY_LABELS.get(state.cat);
  return undefined;
}

function Skeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      {[0, 1].map((card) => (
        <div key={card} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-4 animate-pulse">
          <div className="h-3 w-24 bg-slate-200 rounded" />
          {[0, 1, 2].map((r) => (
            <div key={r} className="space-y-2">
              <div className="h-4 w-1/3 bg-slate-200 rounded" />
              <div className="h-3 w-2/3 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function ErrorCard({ loadFailed, onRetry }: { loadFailed: boolean; onRetry: () => void }) {
  return (
    <div className="bg-white p-12 rounded-xl border border-dashed border-red-300 text-center space-y-3">
      <h2 className="text-lg font-bold text-red-700">{S.errorTitle}</h2>
      <p className="text-sm text-slate-600 max-w-md mx-auto">{loadFailed ? S.errorLoad : S.errorQuery}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 max-md:min-h-10 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-lg border border-indigo-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
      >
        {S.retry}
      </button>
    </div>
  );
}

const linkBtn =
  'font-semibold text-indigo-700 hover:underline cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600';

function NoResults({
  res,
  state,
  rankLevel,
  onChange,
}: {
  res: SearchResponse;
  state: SearchUrlState;
  rankLevel: Level;
  onChange: (next: SearchUrlState) => void;
}) {
  const scopedToRank = levelScope(state, rankLevel) === 'only';
  return (
    <div className="bg-white p-8 md:p-12 rounded-xl border border-dashed border-slate-300 text-center space-y-3">
      <h2 className="text-lg font-bold text-slate-700">
        {scopedToRank ? (
          <>
            {S.noResultsInLevel(rankLevel)} —{' '}
            <button type="button" className={linkBtn} onClick={() => onChange(setLevelScope(state, 'all', rankLevel))}>
              {S.searchAllLevels}
            </button>
          </>
        ) : (
          <span lang="ja">{S.noResults(res.query)}</span>
        )}
      </h2>
      <ul className="text-sm text-slate-600 space-y-1.5 max-w-md mx-auto">
        {hasActiveFilters(state) && res.hiddenByFilters > 0 && (
          <li>
            {S.hiddenByFilters(res.hiddenByFilters)}{' '}
            <button type="button" className={linkBtn} onClick={() => onChange(clearFilters(state))}>
              {S.clearFilters}
            </button>
          </li>
        )}
        {res.queryHasKanji && <li>{S.tryReading}</li>}
        {!scopedToRank && state.levels.length > 0 && res.otherLevelsCount > 0 && (
          <li>
            {S.otherLevels(res.otherLevelsCount)}{' '}
            <button type="button" className={linkBtn} onClick={() => onChange({ ...state, levels: [] })}>
              {S.showAllLevels}
            </button>
          </li>
        )}
        <li>{S.coverageZero}</li>
      </ul>
    </div>
  );
}

/** Header of the tag / category view (outside the listbox). */
function FunctionHeader({ title, count, description }: { title: string; count?: number; description?: string }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-slate-800">
        {title}
        {count !== undefined && <span className="text-slate-600 font-semibold"> · {S.grammarPoints(count)}</span>}
      </h2>
      {description && <p className="text-sm text-slate-600">{description}</p>}
    </div>
  );
}

/** Tag / category rows under level subheadings, N5→N1 (03-ux §2 F3, D3). */
function FunctionRows({ hits, ctx }: { hits: SearchHit[]; ctx: RowContext }) {
  const byLevel = useMemo(() => groupByLevel(hits), [hits]);
  if (!byLevel.length) return null;
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {byLevel.map(({ level, hits: rows }) => (
        <div key={level} role="group" aria-labelledby={`search-level-${level}`}>
          <h3
            id={`search-level-${level}`}
            className="px-4 py-2 bg-slate-50/80 border-y border-slate-200 first:border-t-0 border-l-[3px] border-l-indigo-500 text-xs font-bold text-slate-700"
          >
            {level} · {rows.length}
          </h3>
          <ResultRows hits={rows} {...ctx} />
        </div>
      ))}
    </div>
  );
}

/** Empty tag/category view (BUG-05): say so and offer to drop the filters. */
function FunctionEmpty({ state, label, onChange }: { state: SearchUrlState; label: string; onChange: (s: SearchUrlState) => void }) {
  return (
    <div className="bg-white p-8 md:p-12 rounded-xl border border-dashed border-slate-300 text-center space-y-3">
      <h2 className="text-lg font-bold text-slate-700">
        <span lang={state.q ? 'ja' : undefined}>{state.q ? S.noResults(state.q) : S.noFunctionResults(label)}</span>
      </h2>
      <p className="text-sm text-slate-600">
        {S.functionFilterActive(label)}{' '}
        <button type="button" className={linkBtn} onClick={() => onChange(clearFilters(state))}>
          {S.clearFilters}
        </button>
      </p>
    </div>
  );
}

function navItemsFor(views: GroupView[], fnHits: SearchHit[] | null, onFooter: (t: DocType) => void, rankLevel: Level) {
  // Enter opens the primary occurrence (same rule as the row's link).
  const link = (h: SearchHit): NavItem => ({
    id: optionId(h.uid),
    kind: 'link',
    to: itemPath(occurrences(h, rankLevel).primary),
    state: FROM_SEARCH,
  });
  if (fnHits) return groupByLevel(fnHits).flatMap((g) => g.hits.map(link));
  return views.flatMap((v) => {
    const items: NavItem[] = v.rows.map(link);
    if (v.footer) items.push({ id: moreOptionId(v.type), kind: 'action', run: () => onFooter(v.type) });
    return items;
  });
}

/** /search: status + chips, filters, results; all state in the URL (03-ux §3). */
export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navType = useNavigationType();
  const parsed = useMemo(() => parseSearchParams(params, CATEGORY_IDS), [params]);
  const { state } = parsed;
  const rankLevel = useAppStore((s) => s.lastLesson.level);
  const showTranslations = useAppStore((s) => s.showTranslations);
  const search = useSearch(state, rankLevel);
  const activeId = useSearchUiStore((s) => s.activeId);
  const setItems = useSearchUiStore((s) => s.setItems);
  const markOpened = useSearchUiStore((s) => s.markOpened);
  const setResultsPath = useSearchUiStore((s) => s.setResultsPath);

  const update = useCallback(
    (next: SearchUrlState) => setParams(serializeSearchState(next, CATEGORY_IDS), { replace: true, state: location.state }),
    [setParams, location.state]
  );
  /** A chip opens every grammar point in its category: a new view, so it gets its own entry. */
  const browseFunction = useCallback(
    (chip: Pick<CategoryChip, 'id' | 'tagIds'>) =>
      setParams(serializeSearchState(functionBrowseState(chip, CATEGORY_IDS)), { state: location.state }),
    [setParams, location.state]
  );

  // Unknown values are dropped and the URL rewritten clean.
  useEffect(() => {
    if (parsed.dirty) setParams(new URLSearchParams(parsed.canonical), { replace: true, state: location.state });
  }, [parsed, setParams, location.state]);

  const resultsPath = `${location.pathname}${location.search}`;
  useEffect(() => setResultsPath(resultsPath), [resultsPath, setResultsPath]);

  // Tab title: “ものの” — Search.
  useEffect(() => {
    document.title = state.q ? `“${state.q}” — ${S.searchTitle} · ${BASE_TITLE}` : `${S.searchTitle} · ${BASE_TITLE}`;
  }, [state.q]);
  useEffect(
    () => () => {
      document.title = BASE_TITLE;
    },
    []
  );

  // Back from a lesson: focus returns to the field (desktop; on phones it would pop the keyboard).
  useEffect(() => {
    if (navType !== 'POP' || !window.matchMedia?.('(min-width: 768px)').matches) return;
    document.querySelector<HTMLInputElement>('input[role="combobox"]')?.focus({ preventScroll: true });
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Show 50 more" pages, remembered per results URL.
  const pageKey = parsed.canonical;
  const [pages, setPages] = useState(() => ({ key: pageKey, n: pagesByUrl.get(pageKey) ?? 1 }));
  const pageCount = pages.key === pageKey ? pages.n : (pagesByUrl.get(pageKey) ?? 1);

  const onFooter = useCallback(
    (type: DocType) => {
      if (state.more === type || state.types.length === 1) {
        pagesByUrl.set(pageKey, pageCount + 1);
        setPages({ key: pageKey, n: pageCount + 1 });
      } else update({ ...state, more: type });
    },
    [state, update, pageKey, pageCount]
  );

  const res = search.response;
  const functionMode = !!(state.tag || state.cat);
  const functionLabel = functionLabelFor(state);
  const fnHits = functionMode ? (search.mode === 'browse' ? (search.browseHits ?? null) : (res?.groups.grammar ?? null)) : null;
  // Depend on primitives, not the per-URL `state` object, so a keystroke that doesn't change
  // the response doesn't rebuild (and re-render) every group (BUG-10).
  const typesKey = state.types.join(',');
  const more = state.more;
  const views = useMemo(
    () => (res && !functionMode ? buildGroupViews(res, { types: typesKey ? (typesKey.split(',') as DocType[]) : [], more }, pageCount) : []),
    [res, functionMode, typesKey, more, pageCount]
  );

  const navItems = useMemo(() => navItemsFor(views, fnHits, onFooter, rankLevel), [views, fnHits, onFooter, rankLevel]);
  useEffect(() => setItems(navItems, `${state.q}|${pageKey}`), [navItems, setItems, state.q, pageKey]);

  // Keep the active row visible while arrowing (only then: never fight scroll restore).
  const moveSeq = useSearchUiStore((s) => s.moveSeq);
  useEffect(() => {
    if (!moveSeq) return;
    const id = useSearchUiStore.getState().activeId;
    if (id) document.getElementById(id)?.scrollIntoView({ block: 'nearest' });
  }, [moveSeq]);

  const ready = search.mode === 'empty' || (!search.loading && (!!res || !!search.browseHits || !!search.error));
  useScrollRestore(ready, { scrollTopOnPush: true });

  // Stable row-open handler (useNavigate's identity changes with every URL).
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);
  const openRow = useCallback(
    (id: string, to: string, e: MouseEvent<HTMLAnchorElement>) => {
      markOpened(id);
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      navigateRef.current(to, { state: FROM_SEARCH });
    },
    [markOpened]
  );
  const ctx: RowContext = useMemo(
    () => ({ rankLevel, activeId, showTranslations, onOpen: openRow }),
    [rankLevel, activeId, showTranslations, openRow]
  );
  const total = res ? totalResults(res) : 0;
  const englishQuery = res?.script === 'english';

  // Live region text.
  let announce = '';
  if (search.error) announce = 'Search unavailable. Retry button available.';
  else if (search.slow) announce = 'Loading search index.';
  else if (functionMode && fnHits) announce = `${functionLabel ?? ''}: ${S.grammarPoints(fnHits.length)}.`;
  else if (res) {
    announce =
      total === 0
        ? `No results for ${res.query}.`
        : (state.levels.length ? `Filtered to ${state.levels.join(', ')}: ` : '') + liveCountMessage(res.totals, res.groupOrder);
    if (res.categories.length) announce += ` Category available: ${res.categories.map((c) => `${c.label}, ${S.points(c.count)}`).join('; ')}.`;
  }

  const showScope = search.mode === 'search' && !functionMode;
  const kanjiOnlyNote = res && !res.wordMatch && res.queryHasKanji && res.groups.kanji.length > 0;

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 lg:grid-rows-[auto_1fr] gap-4 lg:gap-x-6 lg:gap-y-4 lg:items-start animate-fade-in">
      <h1 className="sr-only">{S.searchTitle}</h1>

      {/* Status, scope and category chips come first in the DOM so Tab reaches them before the
          filters (03-ux §4.3); on wide screens they sit in the right column. */}
      <div className="lg:col-start-2 lg:col-span-3 lg:row-start-1 space-y-4 min-w-0 empty:hidden">
        <SearchStatus announce={announce}>
          {(res || showScope) && !functionMode && (
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="text-sm text-slate-600 min-w-0">
                {res && (
                  <p>
                    <span className="font-semibold text-slate-800" lang="ja">
                      {S.resultsFor(total, res.query)}
                    </span>{' '}
                    <span className="text-slate-600">({S.rankedFor(rankLevel)})</span>
                  </p>
                )}
                {res?.queryAs && <p className="text-xs text-slate-600">{S.searchingAs(res.queryAs)}</p>}
                {res?.exactOnly && <p className="text-xs text-slate-600">{S.exactOnly}</p>}
                {englishQuery && !showTranslations && <p className="text-xs text-slate-600">{S.englishHidden}</p>}
              </div>
              {showScope && (
                <div className="hidden lg:block">
                  <ScopeToggle state={state} rankLevel={rankLevel} onChange={update} />
                </div>
              )}
            </div>
          )}
        </SearchStatus>

        {res && !functionMode && res.categories.length > 0 && <CategoryChips categories={res.categories} onPick={browseFunction} />}

        {functionMode && functionLabel && (
          <FunctionHeader
            title={functionLabel}
            count={fnHits?.length}
            description={state.tag ? getTagMeta(state.tag)?.description : undefined}
          />
        )}
      </div>

      <aside className="lg:col-start-1 lg:col-span-1 lg:row-start-1 lg:row-span-2 max-lg:order-first" aria-label={S.filters}>
        <SearchFilters state={state} facetCounts={res?.facetCounts} functionLabel={functionLabel} rankLevel={rankLevel} onChange={update} />
      </aside>

      <div className="lg:col-start-2 lg:col-span-3 lg:row-start-2 space-y-4 min-w-0">
        {search.mode === 'empty' && (
          <SearchEmptyState categories={search.categories} onHint={(q) => update({ ...state, q })} onPickCategory={browseFunction} />
        )}

        {search.error !== undefined && <ErrorCard loadFailed={!res} onRetry={search.retry} />}

        {search.mode !== 'empty' && search.loading && !res && !search.browseHits && (
          <>
            <Skeleton />
            {search.slow && <p className="text-sm text-slate-600 text-center">{S.loadingIndex}</p>}
          </>
        )}

        <div
          id="search-results"
          role="listbox"
          aria-label={S.resultsLabel}
          className={`space-y-4 transition-opacity ${search.stale ? 'opacity-60' : ''}`}
        >
          {functionMode && fnHits && <FunctionRows hits={fnHits} ctx={ctx} />}
          {!functionMode &&
            views.map((view) => (
              <ResultGroup
                key={view.type}
                view={view}
                onFooter={onFooter}
                {...ctx}
                note={
                  view.type === 'kanji' && kanjiOnlyNote ? (
                    <p className="px-4 py-2 text-xs text-slate-700 bg-amber-50 border-b border-amber-100">
                      <span lang="ja">{S.noWordMatch(res.query)}</span> {S.kanjiInQuery}{' '}
                      <span lang="ja">{res.groups.kanji.map((k) => k.title).join(' · ')}</span>. {S.tryReading}
                    </p>
                  ) : undefined
                }
              />
            ))}
        </div>

        {functionMode && fnHits && fnHits.length === 0 && !search.loading && (
          <FunctionEmpty state={state} label={functionLabel ?? ''} onChange={update} />
        )}

        {res && !functionMode && total === 0 && res.categories.length === 0 && !search.loading && (
          <NoResults res={res} state={state} rankLevel={rankLevel} onChange={update} />
        )}
      </div>
    </main>
  );
}
