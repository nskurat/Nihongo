import type { CategoryChip } from '../../services/search/types';
import BrowseByFunction from './BrowseByFunction';
import { S } from './strings';

interface SearchEmptyStateProps {
  categories: CategoryChip[];
  onHint: (q: string) => void;
  onPickCategory: (id: string) => void;
}

/** Empty query: example hints, the browse panel and the coverage note (03-ux §2 F4, M3). */
export default function SearchEmptyState({ categories, onHint, onPickCategory }: SearchEmptyStateProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <span className="font-semibold">{S.tryLabel}</span>
        {S.hints.map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => onHint(h)}
            lang={/[a-z]/i.test(h) ? undefined : 'ja'}
            className="px-2.5 py-1 max-md:min-h-10 rounded-md bg-white border border-slate-200 text-indigo-700 font-semibold hover:bg-indigo-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
          >
            {h}
          </button>
        ))}
      </div>
      <BrowseByFunction categories={categories} onPickCategory={onPickCategory} />
      <p className="text-xs text-slate-500">{S.coverage}</p>
    </div>
  );
}
