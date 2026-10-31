import { ContentError } from '../content/ContentSource';
import { BaseSearchSource } from './SearchSource';
import type { CategoryChip, SearchHit, SearchOptions, SearchResponse } from './types';
import type { WorkerRequest, WorkerResponse, WorkerResultMap } from './worker/protocol';

/** The subset of `Worker` this source uses (a fake in tests). */
export interface WorkerLike {
  postMessage(message: WorkerRequest): void;
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  terminate(): void;
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type Request = DistributiveOmit<WorkerRequest, 'id'>;

interface Pending {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

function defaultWorker(): WorkerLike {
  return new Worker(new URL('./worker/search.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike;
}

/**
 * Default search source: a Web Worker over the prebuilt index shards
 * (docs/search/04-data.md §4.4). The worker is created lazily on the first call (the
 * header field calls `warmup()` on focus), so lesson pages never pay for the index.
 * Load failures reject with `ContentError('load-failed')`; the next call retries.
 */
export class WorkerSearchSource extends BaseSearchSource {
  private worker: WorkerLike | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();

  constructor(private createWorker: () => WorkerLike = defaultWorker) {
    super();
  }

  private ensureWorker(): WorkerLike {
    if (this.worker) return this.worker;
    const worker = this.createWorker();
    worker.onmessage = (event) => {
      const msg = event.data;
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.ok) p.resolve(msg.result);
      else p.reject(msg.error.kind === 'load-failed' ? new ContentError('load-failed', msg.error.message) : new Error(msg.error.message));
    };
    worker.onerror = (event) => {
      // The worker script itself failed (e.g. stale chunk after a deploy): fail every
      // call in flight and start a fresh worker next time.
      const err = new ContentError('load-failed', event.message);
      for (const p of this.pending.values()) p.reject(err);
      this.pending.clear();
      worker.terminate();
      if (this.worker === worker) this.worker = null;
    };
    this.worker = worker;
    return worker;
  }

  private call<K extends keyof WorkerResultMap>(req: Extract<Request, { op: K }>): Promise<WorkerResultMap[K]> {
    let worker: WorkerLike;
    try {
      worker = this.ensureWorker();
    } catch (err) {
      return Promise.reject(new ContentError('load-failed', err));
    }
    const id = this.nextId++;
    return new Promise<WorkerResultMap[K]>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      worker.postMessage({ ...req, id } as WorkerRequest);
    });
  }

  warmup(): Promise<void> {
    return this.call({ op: 'warmup' }).then(() => undefined);
  }

  search(query: string, opts: SearchOptions): Promise<SearchResponse> {
    return this.call({ op: 'search', query, opts });
  }

  listByTag(tag: string, opts?: Omit<SearchOptions, 'tag'>): Promise<SearchHit[]> {
    return this.call({ op: 'listByTag', tag, opts });
  }

  listCategories(): Promise<CategoryChip[]> {
    return this.call({ op: 'listCategories' });
  }
}
