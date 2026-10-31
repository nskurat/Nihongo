import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { CategoryChip } from '../../services/search/types';
import TagBadge from '../../components/common/TagBadge';
import { getAllTagsForFacet } from '../../utils/tags';
import CategoryChips from './CategoryChips';
import { buildSearchPath } from './searchUrl';
import { S } from './strings';

const FACETS = ['function', 'register', 'structure'];

interface BrowseByFunctionProps {
  categories: CategoryChip[];
  onPickCategory: (chip: CategoryChip) => void;
}

/**
 * Empty-state browse panel (03-ux §2 F3): alias categories from the index once it has
 * loaded (function tags from the bundled taxonomy until then), plus "All tags" by facet.
 */
export default function BrowseByFunction({ categories, onPickCategory }: BrowseByFunctionProps) {
  const fallback = getAllTagsForFacet('function');
  // The tag lists are only built once the disclosure is opened (keeps the empty state cheap).
  const [allOpen, setAllOpen] = useState(false);
  return (
    <section aria-labelledby="browse-heading" className="space-y-3">
      <h2 id="browse-heading" className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
        {S.browseHeading}
      </h2>
      {categories.length > 0 ? (
        <CategoryChips categories={categories} onPick={onPickCategory} />
      ) : (
        <ul className="flex flex-wrap gap-2">
          {fallback.slice(0, 24).map((t) => (
            <li key={t.id}>
              <Link
                to={buildSearchPath({ tag: t.id })}
                className="inline-flex items-center px-3 py-1.5 max-md:min-h-10 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <details className="group bg-white rounded-xl border border-slate-200" onToggle={(e) => setAllOpen(e.currentTarget.open)}>
        <summary className="px-4 py-2.5 max-md:min-h-10 text-sm font-semibold text-slate-700 cursor-pointer select-none rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600">
          {S.allTags} <span className="text-slate-600 font-normal">(Function · Register · Structure)</span>
        </summary>
        <div className="px-4 pb-4 space-y-3">
          {allOpen && FACETS.map((facet) => {
            const tags = getAllTagsForFacet(facet);
            if (!tags.length) return null;
            return (
              <div key={facet}>
                <h3 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">{tags[0].facetLabel}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <TagBadge key={t.id} tagId={t.id} to={buildSearchPath({ tag: t.id })} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </details>
    </section>
  );
}
