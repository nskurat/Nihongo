import type { Level } from '../../services/search/types';
import { levelScope, setLevelScope, type SearchUrlState } from './searchUrl';
import { S } from './strings';

interface ScopeToggleProps {
  state: SearchUrlState;
  rankLevel: Level;
  onChange: (next: SearchUrlState) => void;
  className?: string;
}

/** Segmented "Only N3 | All levels" chips; drives the same `level=` param as the rail. */
export default function ScopeToggle({ state, rankLevel, onChange, className = '' }: ScopeToggleProps) {
  const scope = levelScope(state, rankLevel);
  const chip = (value: 'only' | 'all', label: string) => {
    const on = scope === value;
    return (
      <button
        type="button"
        aria-pressed={on}
        onClick={() => onChange(setLevelScope(state, value, rankLevel))}
        className={`px-3 py-1 max-md:min-h-10 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
          on ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-indigo-50'
        }`}
      >
        {label}
      </button>
    );
  };
  return (
    <div
      role="group"
      aria-label={S.scopeLabel}
      className={`inline-flex shrink-0 rounded-lg border border-slate-200 overflow-hidden divide-x divide-slate-200 ${className}`}
    >
      {chip('only', S.onlyLevel(rankLevel))}
      {chip('all', S.allLevels)}
    </div>
  );
}
