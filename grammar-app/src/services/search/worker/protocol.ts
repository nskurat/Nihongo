import type { CategoryChip, SearchHit, SearchOptions, SearchResponse } from '../types';

/** postMessage RPC between WorkerSearchSource (main thread) and search.worker.ts. */
export type WorkerRequest =
  | { id: number; op: 'warmup' }
  | { id: number; op: 'search'; query: string; opts: SearchOptions }
  | { id: number; op: 'listByTag'; tag: string; opts?: Omit<SearchOptions, 'tag'> }
  | { id: number; op: 'listCategories' };

export interface WorkerResultMap {
  warmup: null;
  search: SearchResponse;
  listByTag: SearchHit[];
  listCategories: CategoryChip[];
}

export type WorkerErrorKind = 'load-failed' | 'error';

export type WorkerResponse =
  | { id: number; ok: true; result: WorkerResultMap[keyof WorkerResultMap] }
  | { id: number; ok: false; error: { kind: WorkerErrorKind; message: string } };
