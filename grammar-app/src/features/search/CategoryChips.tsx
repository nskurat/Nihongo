import { Layers } from 'lucide-react';
import type { CategoryChip } from '../../services/search/types';
import { S } from './strings';

interface CategoryChipsProps {
  categories: CategoryChip[];
  onPick: (id: string) => void;
  /** Hide counts until the index has loaded them. */
  showCounts?: boolean;
  className?: string;
}

/** Alias-category chips: `▤ Comparison · 17 points →` (03-ux §2 F3). */
export default function CategoryChips({ categories, onPick, showCounts = true, className = '' }: CategoryChipsProps) {
  if (!categories.length) return null;
  return (
    <ul className={`flex flex-wrap gap-2 ${className}`} aria-label="Grammar categories">
      {categories.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            onClick={() => onPick(c.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 max-md:min-h-10 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold hover:bg-indigo-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
          >
            <Layers size={14} aria-hidden="true" />
            <span>{c.label}</span>
            {showCounts && c.count > 0 && (
              <span className="font-bold">
                · {S.points(c.count)}
              </span>
            )}
            <span aria-hidden="true">→</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
