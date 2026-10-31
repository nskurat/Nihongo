import { startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import type { CategoryChip, Level, SearchHit, SearchOptions, SearchResponse } from '../../services/search/types';
import { searchClient } from './searchClient';
import type { SearchUrlState } from './searchUrl';

// Short: the worker query is cheap and stale replies are dropped; this only coalesces bursts (paste, fast typing).
export const DEBOUNCE_MS = 16;
export const STALE_AFTER_MS = 150;
export const SLOW_AFTER_MS = 800;

export type SearchMode = 'empty' | 'browse' | 'search';

export function searchMode(state: Pick<SearchUrlState, 'q' | 'tag' | 'cat'>): SearchMode {
  if (state.q.trim()) return 'search';
  if (state.tag || state.cat) return 'browse';
  return 'empty';
}

interface Request {
  mode: SearchMode;
  q: string;
  opts: SearchOptions;
  retry: number;
}

/** Builds the service request for a URL state. Pure; exported for tests. */
export function buildRequest(state: SearchUrlState, rankLevel: Level, retry = 0): Request {
  const mode = searchMode(state);
  const singleType = state.types.length === 1;
  const opts: SearchOptions = {
    rankLevel,
    levels: state.levels.length ? state.levels : undefined,
    types: state.types.length ? state.types : undefined,
    tag: state.tag,
    category: state.cat,
    // Expanded or single-type groups page through everything client-side.
    limitPerType: state.more || singleType ? Infinity : 8,
  };
  return { mode, q: state.q.trim(), opts, retry };
}

const requestKey = (r: Request) =>
  JSON.stringify({ ...r, opts: { ...r.opts, limitPerType: String(r.opts.limitPerType) } });

interface Settled {
  key: string;
  response?: SearchResponse;
  browseHits?: SearchHit[];
  error?: unknown;
}

export interface UseSearchResult {
  mode: SearchMode;
  /** True while the latest request hasn't settled yet. */
  loading: boolean;
  /** Previous results are on screen and the new query has been running > 150 ms. */
  stale: boolean;
  /** First (cold) search running > 800 ms. */
  slow: boolean;
  response?: SearchResponse;
  browseHits?: SearchHit[];
  error?: unknown;
  /** Function categories for the browse panel (empty until loaded). */
  categories: CategoryChip[];
  retry: () => void;
}

let categoriesPromise: Promise<CategoryChip[]> | null = null;
function loadCategories(): Promise<CategoryChip[]> {
  categoriesPromise ??= searchClient.listCategories().catch((err) => {
    categoriesPromise = null;
    throw err;
  });
  return categoriesPromise;
}

/**
 * Debounced search over searchClient (03-ux §4.1). IME safety lives upstream: the header
 * only writes `q` to the URL once composition ends, so this never sees partial input.
 */
export function useSearch(state: SearchUrlState, rankLevel: Level): UseSearchResult {
  const [retryToken, setRetryToken] = useState(0);
  const request = useMemo(() => buildRequest(state, rankLevel, retryToken), [state, rankLevel, retryToken]);
  const key = requestKey(request);

  const [settled, setSettled] = useState<Settled | null>(null);
  const [timerKey, setTimerKey] = useState<{ stale?: string; slow?: string }>({});
  const [categories, setCategories] = useState<CategoryChip[]>([]);

  // Run each distinct request. Typing bursts are coalesced by a short timer; superseded
  // replies are dropped, and the worker query itself is cheap (BUG-10).
  useEffect(() => {
    const r = request;
    if (r.mode === 'empty') return;
    let cancelled = false;
    const k = key;
    const t = setTimeout(() => {
      const run =
        r.mode === 'search'
          ? searchClient.search(r.q, r.opts).then((response) => ({ key: k, response }))
          : searchClient
              .listByTag(r.opts.tag ?? r.opts.category ?? '', { ...r.opts, tag: undefined } as Omit<SearchOptions, 'tag'>)
              .then((browseHits) => ({ key: k, browseHits }));
      // Rendering a result set is the expensive part: keep it interruptible so keystrokes
      // (urgent) never wait behind it.
      run.then(
        (res) => {
          if (!cancelled) startTransition(() => setSettled(res));
        },
        (error: unknown) => {
          if (!cancelled) startTransition(() => setSettled({ key: k, error }));
        }
      );
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // `key` encodes the request; `request` is a fresh object for every URL render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Stale / slow indicators.
  const loading = request.mode !== 'empty' && settled?.key !== key;
  useEffect(() => {
    if (!loading) return;
    const a = setTimeout(() => setTimerKey((t) => ({ ...t, stale: key })), STALE_AFTER_MS);
    const b = setTimeout(() => setTimerKey((t) => ({ ...t, slow: key })), SLOW_AFTER_MS);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [loading, key]);

  // Categories for the browse panel and the category header (loaded once).
  useEffect(() => {
    let cancelled = false;
    loadCategories().then(
      (c) => !cancelled && setCategories(c),
      () => undefined
    );
    return () => {
      cancelled = true;
    };
  }, [retryToken]);

  const retry = useCallback(() => setRetryToken((n) => n + 1), []);

  const current = settled && (settled.key === key || loading) ? settled : null;
  // Results from another mode are never shown under this one.
  const sameMode = current ? JSON.parse(current.key).mode === request.mode : false;
  const shown = sameMode ? current : null;

  return {
    mode: request.mode,
    loading,
    stale: loading && !!shown && timerKey.stale === key,
    slow: loading && !shown && timerKey.slow === key,
    response: shown?.response,
    browseHits: shown?.browseHits,
    error: !loading ? shown?.error : undefined,
    categories,
    retry,
  };
}
