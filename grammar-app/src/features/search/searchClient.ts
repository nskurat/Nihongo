import { searchRepository } from '../../services/search/SearchSource';
import type { CategoryChip, SearchHit, SearchOptions, SearchResponse } from '../../services/search/types';

type Repo = Pick<typeof searchRepository, 'search' | 'listByTag' | 'listCategories' | 'warmup'>;

const NO_SOURCE = 'No search source configured';

export function isNoSourceError(err: unknown): boolean {
  return err instanceof Error && err.message.startsWith(NO_SOURCE);
}

let fixture: Promise<Repo> | null = null;

/** Lazily loads the deterministic fixture (its own chunk), only when no source is registered. */
function fixtureRepo(): Promise<Repo> {
  fixture ??= import('./__fixtures__/FixtureSearchSource').then((m) => m.fixtureSearchSource);
  return fixture;
}

/**
 * Calls the registered search source (searchRepository). Until the real engine is
 * registered via setSearchSource() at startup, falls back to the fixture so the UI is
 * usable in local dev and previews. The fallback is never taken once a source exists.
 */
async function call<T>(fn: (repo: Repo) => Promise<T>): Promise<T> {
  try {
    return await fn(searchRepository);
  } catch (err) {
    if (!isNoSourceError(err)) throw err;
    return fn(await fixtureRepo());
  }
}

export const searchClient = {
  search: (query: string, opts: SearchOptions): Promise<SearchResponse> => call((r) => r.search(query, opts)),
  listByTag: (tag: string, opts?: Omit<SearchOptions, 'tag'>): Promise<SearchHit[]> => call((r) => r.listByTag(tag, opts)),
  listCategories: (): Promise<CategoryChip[]> => call((r) => r.listCategories()),
  warmup: (): Promise<void> => call((r) => r.warmup()),
};

let warm: Promise<void> | null = null;

/** Prefetch the index once (header focus, `/`, pointerenter). Failures surface on the next search. */
export function prefetchSearchIndex(): void {
  warm ??= searchClient.warmup().catch(() => {
    warm = null;
  });
}
