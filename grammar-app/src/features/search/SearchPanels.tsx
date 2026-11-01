/**
 * Presentational pieces of the search results page: loading skeleton, error card,
 * the no-results panel and the function-browse header, rows and empty state.
 */
import { useMemo } from 'react';
import type { Level, SearchHit, SearchResponse } from '../../services/search/types';
import { ResultRows, type RowContext } from './ResultGroup';
import { groupByLevel } from './resultDisplay';
import { clearFilters, hasActiveFilters, levelScope, setLevelScope, type SearchUrlState } from './searchUrl';
import { S } from './strings';
export function Skeleton() {
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

export function ErrorCard({ loadFailed, onRetry }: { loadFailed: boolean; onRetry: () => void }) {
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

export function NoResults({
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
export function FunctionHeader({ title, count, description }: { title: string; count?: number; description?: string }) {
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
export function FunctionRows({ hits, ctx }: { hits: SearchHit[]; ctx: RowContext }) {
  const byLevel = useMemo(() => groupByLevel(hits), [hits]);
  if (!byLevel.length) return null;
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {byLevel.map(({ level, hits: rows }) => (
        <div key={level} role="group" aria-labelledby={`search-level-${level}`}>
          <h3
            id={`search-level-${level}`}
            role="presentation"
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
export function FunctionEmpty({ state, label, onChange }: { state: SearchUrlState; label: string; onChange: (s: SearchUrlState) => void }) {
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
