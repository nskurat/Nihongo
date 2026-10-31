import { Link } from 'react-router-dom';
import { SlidersHorizontal, X } from 'lucide-react';
import type { DocType, Level, SearchResponse } from '../../services/search/types';
import {
  buildSearchPath,
  DOC_TYPES,
  LEVELS,
  selectType,
  setCategory,
  setTag,
  toggleLevel,
  type SearchUrlState,
} from './searchUrl';
import { S } from './strings';
import ScopeToggle from './ScopeToggle';

interface SearchFiltersProps {
  state: SearchUrlState;
  facetCounts?: SearchResponse['facetCounts'];
  /** Label of the active tag or category, if any. */
  functionLabel?: string;
  /** Learner's level for the "Only N3 | All levels" toggle. */
  rankLevel: Level;
  onChange: (next: SearchUrlState) => void;
}

const typeOn: Record<DocType, string> = {
  grammar: 'bg-indigo-600 text-white border-indigo-600',
  vocab: 'bg-emerald-600 text-white border-emerald-600',
  kanji: 'bg-rose-600 text-white border-rose-600',
};
const OFF = 'bg-white text-slate-600 border-slate-200 hover:bg-indigo-50';
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2';

function Count({ n, on }: { n?: number; on: boolean }) {
  if (n === undefined) return null;
  return (
    <span className={`text-[11px] font-bold px-1.5 rounded-full ${on ? 'bg-black/25 text-white' : 'bg-slate-100 text-slate-700'}`}>{n}</span>
  );
}

function FunctionPill({ state, label, onChange }: { state: SearchUrlState; label?: string; onChange: SearchFiltersProps['onChange'] }) {
  if (!state.tag && !state.cat) return null;
  const clear = () => onChange(state.tag ? setTag(state, undefined) : setCategory(state, undefined));
  return (
    <span className="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full bg-indigo-600 text-white text-xs font-semibold">
      {label ?? state.tag ?? state.cat}
      <button
        type="button"
        onClick={clear}
        aria-label={`Remove filter ${label ?? ''}`}
        className={`w-6 h-6 max-md:w-8 max-md:h-8 flex items-center justify-center rounded-full hover:bg-white/20 cursor-pointer ${FOCUS}`}
      >
        <X size={12} />
      </button>
    </span>
  );
}

/** Type / Level / Function filters: a sticky rail ≥ lg, chip rows below (03-ux §3.1). */
export default function SearchFilters({ state, facetCounts, functionLabel, rankLevel, onChange }: SearchFiltersProps) {
  const functionActive = !!(state.tag || state.cat);
  const allTypeCount = facetCounts ? DOC_TYPES.reduce((n, t) => n + facetCounts.type[t], 0) : undefined;

  const typeButton = (type: DocType | null, layout: 'rail' | 'chip') => {
    const on = type === null ? state.types.length === 0 : state.types.length === 1 && state.types[0] === type;
    const disabled = functionActive && type !== null && type !== 'grammar';
    const count = type === null ? allTypeCount : facetCounts?.type[type];
    const label = type === null ? S.all : S.typeLabel[type];
    const onCls = type === null ? 'bg-indigo-600 text-white border-indigo-600' : typeOn[type];
    return (
      <button
        key={type ?? 'all'}
        type="button"
        aria-pressed={on}
        disabled={disabled}
        title={disabled ? S.functionOnlyGrammar : undefined}
        onClick={() => onChange(selectType(state, type))}
        className={`${
          layout === 'rail' ? 'w-full justify-between px-3 py-1.5' : 'shrink-0 gap-1.5 px-3 py-1.5 max-md:min-h-10'
        } inline-flex items-center rounded-lg border text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
          on ? onCls : OFF
        } ${FOCUS}`}
      >
        <span>{label}</span>
        <Count n={count} on={on} />
      </button>
    );
  };

  const levelButton = (level: Level, layout: 'rail' | 'chip') => {
    const on = state.levels.includes(level);
    const count = facetCounts?.level[level];
    return (
      <button
        key={level}
        type="button"
        aria-pressed={on}
        onClick={() => onChange(toggleLevel(state, level))}
        aria-label={count !== undefined ? `${level}, ${count} result${count === 1 ? '' : 's'}` : level}
        className={`${
          layout === 'rail' ? 'flex-1 flex-col py-1' : 'shrink-0 gap-1.5 px-3 py-1.5 max-md:min-h-10'
        } inline-flex items-center justify-center rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
          on ? 'bg-indigo-600 text-white border-indigo-600' : OFF
        } ${FOCUS}`}
      >
        <span>{level}</span>
        {count !== undefined && (
          <span className={`text-[10px] font-semibold ${on ? 'text-indigo-100' : 'text-slate-600'}`}>{count}</span>
        )}
      </button>
    );
  };

  return (
    <>
      {/* Rail ≥ lg */}
      <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden lg:sticky lg:top-28">
        <div className="p-4 bg-slate-100/80 border-b border-slate-200 flex items-center gap-2">
          <SlidersHorizontal size={18} className="text-indigo-600" aria-hidden="true" />
          <h2 className="font-semibold text-slate-800 text-sm">{S.filters}</h2>
        </div>
        <div className="p-4 space-y-5">
          <fieldset className="space-y-1.5">
            <legend className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">{S.type}</legend>
            {typeButton(null, 'rail')}
            {DOC_TYPES.map((t) => typeButton(t, 'rail'))}
          </fieldset>
          <fieldset>
            <legend className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">{S.level}</legend>
            <div className="flex gap-1">{LEVELS.map((l) => levelButton(l, 'rail'))}</div>
          </fieldset>
          <div>
            <h3 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">{S.function}</h3>
            {functionActive ? (
              <FunctionPill state={state} label={functionLabel} onChange={onChange} />
            ) : (
              <p className="text-xs text-slate-600">{S.functionAny}</p>
            )}
            <Link
              to={buildSearchPath({ types: ['grammar'] })}
              className={`mt-2 inline-block text-xs font-semibold text-indigo-700 hover:underline rounded ${FOCUS}`}
            >
              {S.browseByFunction}
            </Link>
          </div>
        </div>
      </div>

      {/* Chip rows < lg (sticky under the mobile search bar) */}
      <div className="lg:hidden space-y-2 max-md:sticky max-md:top-14 max-md:z-10 max-md:-mx-4 max-md:px-4 max-md:py-2 max-md:bg-slate-50/95 max-md:backdrop-blur-sm">
        <div role="group" aria-label={S.type} className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {typeButton(null, 'chip')}
          {DOC_TYPES.map((t) => typeButton(t, 'chip'))}
        </div>
        <div role="group" aria-label={S.level} className="flex gap-1.5 overflow-x-auto scrollbar-none items-center">
          <ScopeToggle state={state} rankLevel={rankLevel} onChange={onChange} />
          {LEVELS.map((l) => levelButton(l, 'chip'))}
          {functionActive && <FunctionPill state={state} label={functionLabel} onChange={onChange} />}
        </div>
      </div>
    </>
  );
}
