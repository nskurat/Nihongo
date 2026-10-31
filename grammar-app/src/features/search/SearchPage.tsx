import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import type { DocType, Level, SearchHit, SearchResponse } from '../../services/search/types';
import { useAppStore } from '../../store/useAppStore';
import { getTagMeta } from '../../utils/tags';
import { useScrollRestore } from '../useScrollRestore';
import CategoryChips from './CategoryChips';
import ResultGroup, { ResultRows, type RowContext } from './ResultGroup';
import ScopeToggle from './ScopeToggle';
import SearchEmptyState from './SearchEmptyState';
import SearchFilters from './SearchFilters';
import SearchStatus from './SearchStatus';
import type { FromSearchState } from './SearchReturnBar';
import { buildGroupViews, groupByLevel, moreOptionId, occurrences, optionId, totalResults, type GroupView } from './resultDisplay';
import {
  clearFilters,
  hasActiveFilters,
  itemPath,
  levelScope,
  parseSearchParams,
  serializeSearchState,
  setCategory,
  setLevelScope,
  type SearchUrlState,
} from './searchUrl';
import { useSearchUiStore, type NavItem } from './searchUiStore';
import { liveCountMessage, S } from './strings';
import { useSearch } from './useSearch';

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
      <p className="text-sm text-slate-500 max-w-md mx-auto">{loadFailed ? S.errorLoad : S.errorQuery}</p>
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
      <ul className="text-sm text-slate-500 space-y-1.5 max-w-md mx-auto">
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

/** Tag / category view: grammar under level subheadings, N5→N1 (03-ux §2 F3, D3). */
function FunctionView({ hits, title, description, ctx }: { hits: SearchHit[]; title: string; description?: string; ctx: RowContext }) {
  const byLevel = groupByLevel(hits);
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-bold text-slate-800">
          {title} <span className="text-slate-500 font-semibold">· {S.grammarPoints(hits.length)}</span>
        </h2>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
      {byLevel.length > 0 && (
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
      )}
    </div>
  );
}

function navItemsFor(views: GroupView[], fnHits: SearchHit[] | null, fromSearch: string, onFooter: (t: DocType) => void, rankLevel: Level) {
  const state: FromSearchState = { fromSearch };
  const link = (h: SearchHit): NavItem => {
    // Enter opens the primary occurrence (same rule as the row's link).
    return { id: optionId(h.uid), kind: 'link', to: itemPath(occurrences(h, rankLevel).primary), state };
  };
  if (fnHits) return groupByLevel(fnHits).flatMap((g) => g.hits.map(link));
  return views.flatMap((v) => {
    const items: NavItem[] = v.rows.map(link);
    if (v.footer) items.push({ id: moreOptionId(v.type), kind: 'action', run: () => onFooter(v.type) });
    return items;
  });
}

/** /search: filters rail + status + results, all state in the URL (03-ux §3). */
export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const parsed = useMemo(() => parseSearchParams(params), [params]);
  const { state } = parsed;
  const rankLevel = useAppStore((s) => s.lastLesson.level);
  const showTranslations = useAppStore((s) => s.showTranslations);
  const search = useSearch(state, rankLevel);
  const { activeId, setItems, markOpened } = useSearchUiStore();

  const update = useCallback(
    (next: SearchUrlState) => setParams(serializeSearchState(next), { replace: true, state: location.state }),
    [setParams, location.state]
  );

  // Unknown values are dropped and the URL rewritten clean.
  useEffect(() => {
    if (parsed.dirty) setParams(new URLSearchParams(parsed.canonical), { replace: true, state: location.state });
  }, [parsed, setParams, location.state]);

  // "Show 50 more" pages; reset whenever the query or filters change.
  const pageKey = parsed.canonical;
  const [pages, setPages] = useState({ key: pageKey, n: 1 });
  const pageCount = pages.key === pageKey ? pages.n : 1;

  const onFooter = useCallback(
    (type: DocType) => {
      if (state.more === type || state.types.length === 1) setPages({ key: pageKey, n: pageCount + 1 });
      else update({ ...state, more: type });
    },
    [state, update, pageKey, pageCount]
  );

  const res = search.response;
  const functionId = state.tag ?? state.cat;
  const functionMode = !!functionId;
  const category = state.cat ? search.categories.find((c) => c.id === state.cat) : undefined;
  const functionLabel = state.tag ? getTagMeta(state.tag)?.label : (category?.label ?? state.cat);
  const fnHits = functionMode ? (search.mode === 'browse' ? (search.browseHits ?? null) : (res?.groups.grammar ?? null)) : null;
  const views = useMemo(() => (res && !functionMode ? buildGroupViews(res, state, pageCount) : []), [res, functionMode, state, pageCount]);

  const fromSearch = `${location.pathname}${location.search}`;
  const navItems = useMemo(
    () => navItemsFor(views, fnHits, fromSearch, onFooter, rankLevel),
    [views, fnHits, fromSearch, onFooter, rankLevel]
  );
  useEffect(() => setItems(navItems, `${state.q}|${pageKey}`), [navItems, setItems, state.q, pageKey]);

  // Keep the active row visible while arrowing.
  useEffect(() => {
    if (!activeId) return;
    document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  const ready = search.mode === 'empty' || (!search.loading && (!!res || !!search.browseHits || !!search.error));
  useScrollRestore(ready, { scrollTopOnPush: true });

  const ctx: RowContext = { rankLevel, activeId, fromSearch, showTranslations, onOpen: markOpened };
  const total = res ? totalResults(res) : 0;
  const englishQuery = res?.script === 'english';

  // Live region text.
  let announce = '';
  if (search.error) announce = 'Search unavailable. Retry button available.';
  else if (search.slow) announce = 'Loading search index.';
  else if (functionMode && fnHits) announce = `${functionLabel}: ${S.grammarPoints(fnHits.length)}.`;
  else if (res) {
    announce =
      total === 0
        ? `No results for ${res.query}.`
        : (state.levels.length ? `Filtered to ${state.levels.join(', ')}: ` : '') + liveCountMessage(res.totals, res.groupOrder);
    if (res.categories.length) announce += ` Category available: ${res.categories.map((c) => `${c.label}, ${S.points(c.count)}`).join('; ')}.`;
  }

  const showScope = search.mode === 'search';
  const kanjiOnlyNote = res && !res.wordMatch && res.queryHasKanji && res.groups.kanji.length > 0;

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6 animate-fade-in">
      <h1 className="sr-only">Search</h1>
      <aside className="lg:col-span-1" aria-label={S.filters}>
        <SearchFilters
          state={state}
          facetCounts={res?.facetCounts}
          functionLabel={functionLabel}
          rankLevel={rankLevel}
          onChange={update}
        />
      </aside>

      <div className="lg:col-span-3 space-y-4 min-w-0">
        <SearchStatus announce={announce}>
          {(res || showScope) && !functionMode && (
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="text-sm text-slate-600 min-w-0">
                {res && (
                  <p>
                    <span className="font-semibold text-slate-800" lang="ja">
                      {S.resultsFor(total, res.query)}
                    </span>{' '}
                    <span className="text-slate-500">({S.rankedFor(rankLevel)})</span>
                  </p>
                )}
                {res?.queryAs && <p className="text-xs text-slate-500">{S.searchingAs(res.queryAs)}</p>}
                {res?.exactOnly && <p className="text-xs text-slate-500">{S.exactOnly}</p>}
                {englishQuery && !showTranslations && <p className="text-xs text-slate-500">{S.englishHidden}</p>}
              </div>
              {showScope && (
                <div className="hidden lg:block">
                  <ScopeToggle state={state} rankLevel={rankLevel} onChange={update} />
                </div>
              )}
            </div>
          )}
        </SearchStatus>

        {res && !functionMode && res.categories.length > 0 && (
          <CategoryChips categories={res.categories} onPick={(id) => update(setCategory(state, id))} />
        )}

        {search.mode === 'empty' && (
          <SearchEmptyState
            categories={search.categories}
            onHint={(q) => update({ ...state, q })}
            onPickCategory={(id) => update(setCategory(state, id))}
          />
        )}

        {search.error !== undefined && <ErrorCard loadFailed={!res} onRetry={search.retry} />}

        {search.mode !== 'empty' && search.loading && !res && !search.browseHits && (
          <>
            <Skeleton />
            {search.slow && <p className="text-sm text-slate-500 text-center">{S.loadingIndex}</p>}
          </>
        )}

        <div
          id="search-results"
          role="listbox"
          aria-label="Search results"
          className={`space-y-4 transition-opacity ${search.stale ? 'opacity-60' : ''}`}
        >
          {functionMode && fnHits && (
            <FunctionView
              hits={fnHits}
              title={functionLabel ?? ''}
              description={state.tag ? getTagMeta(state.tag)?.description : undefined}
              ctx={ctx}
            />
          )}
          {!functionMode &&
            views.map((view) => (
              <ResultGroup
                key={view.type}
                view={view}
                onFooter={onFooter}
                {...ctx}
                note={
                  view.type === 'kanji' && kanjiOnlyNote ? (
                    <p className="px-4 py-2 text-xs text-slate-600 bg-amber-50 border-b border-amber-100">
                      <span lang="ja">{S.noWordMatch(res.query)}</span> {S.kanjiInQuery}{' '}
                      <span lang="ja">{res.groups.kanji.map((k) => k.title).join(' · ')}</span>. {S.tryReading}
                    </p>
                  ) : undefined
                }
              />
            ))}
        </div>

        {res && !functionMode && total === 0 && res.categories.length === 0 && !search.loading && (
          <NoResults res={res} state={state} rankLevel={rankLevel} onChange={update} />
        )}
      </div>
    </main>
  );
}
