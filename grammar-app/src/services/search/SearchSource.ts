import type { CategoryChip, SearchHit, SearchOptions, SearchResponse } from './types';

/**
 * Global search backend (docs/search/04-data.md §5). Same swap pattern as
 * services/content/ContentSource.ts: an abstract base, an async facade, a swap function.
 * The static implementation (Web Worker over prebuilt index shards) is the default; a
 * database-backed implementation can replace it later without touching the UI.
 * Lesson navigation keeps using contentRepository; this is only for global search.
 */
export abstract class BaseSearchSource {
  abstract search(query: string, opts: SearchOptions): Promise<SearchResponse>;
  /** All grammar points with a tag (or alias category), N5→N1 then lesson order. */
  abstract listByTag(tag: string, opts?: Omit<SearchOptions, 'tag'>): Promise<SearchHit[]>;
  /** Function categories for the empty-state browse panel. */
  abstract listCategories(): Promise<CategoryChip[]>;
  /** Start loading the index (on search-field focus). Rejects on load failure. */
  abstract warmup(): Promise<void>;
}

let source: BaseSearchSource | null = null;

export function setSearchSource(next: BaseSearchSource): void {
  source = next;
}

function current(): BaseSearchSource {
  if (!source) throw new Error('No search source configured: call setSearchSource() at startup');
  return source;
}

export const searchRepository = {
  search: (query: string, opts: SearchOptions) => current().search(query, opts),
  listByTag: (tag: string, opts?: Omit<SearchOptions, 'tag'>) => current().listByTag(tag, opts),
  listCategories: () => current().listCategories(),
  warmup: () => current().warmup(),
};
