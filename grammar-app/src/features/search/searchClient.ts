import { searchRepository } from '../../services/search/SearchSource';

/**
 * The UI talks to the registered search source (setSearchSource in main.tsx) only through
 * `searchRepository`. The fixture in __fixtures__ is for tests and never reaches a build.
 */
export const searchClient = searchRepository;

let warm: Promise<void> | null = null;

/** Prefetch the index once (header focus, `/`, pointerenter). Failures surface on the next search. */
export function prefetchSearchIndex(): void {
  // The results page chunk too, so the first keystroke doesn't wait on it.
  void import('./SearchPage').catch(() => undefined);
  try {
    warm ??= searchClient.warmup().catch(() => {
      warm = null;
    });
  } catch {
    // No source registered (unit tests): nothing to prefetch.
    warm = null;
  }
}
