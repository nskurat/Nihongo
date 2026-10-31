import { ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { S } from './strings';

/** History state set on links opened from the results page. */
export interface FromSearchState {
  fromSearch?: string;
}

/** `← Back to results for "…"`, only when arrived from the results page (never for shared links). */
export default function SearchReturnBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const from = (location.state as FromSearchState | null)?.fromSearch;
  if (!from) return null;
  const q = new URLSearchParams(from.split('?')[1] ?? '').get('q') ?? '';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-2 py-1.5">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 px-2.5 py-1.5 max-md:min-h-10 rounded-lg text-sm font-semibold text-indigo-700 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 cursor-pointer"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        <span>{S.backToResults(q)}</span>
      </button>
    </div>
  );
}

export function FromSearchPill() {
  return (
    <span className="inline-flex items-center align-middle ml-2 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-semibold whitespace-nowrap">
      {S.fromSearch}
    </span>
  );
}
