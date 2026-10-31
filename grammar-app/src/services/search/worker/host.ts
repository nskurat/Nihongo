import { SearchEngine } from '../engine/SearchEngine';
import { shardOrder, type ShardFile } from '../shard';
import type { WorkerRequest, WorkerResponse } from './protocol';

/** Fetches one shard by name. Rejects on network or parse failure. */
export type ShardFetcher = (name: string) => Promise<ShardFile>;

export class ShardLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShardLoadError';
  }
}

/**
 * The worker's request handler, free of `self`/`postMessage` so tests can drive it
 * in-thread. Shards load in `shardOrder` (grammar → current-level vocab → kanji → rest),
 * each indexed as it arrives; queries wait until every shard is in, so a result is never
 * silently partial. A failed load is forgotten, so the next request retries.
 */
export class SearchWorkerHost {
  private engine = new SearchEngine();
  private loading: Promise<void> | null = null;

  constructor(
    private names: string[],
    private fetchShard: ShardFetcher
  ) {}

  private load(rankLevel?: Parameters<typeof shardOrder>[1]): Promise<void> {
    if (!this.loading) {
      if (!this.names.length) return Promise.reject(new ShardLoadError('no search index shards were built'));
      const order = shardOrder(this.names, rankLevel);
      this.engine.expected = order;
      this.loading = (async () => {
        for (const name of order) {
          if (this.engine.loadedShards.includes(name)) continue;
          this.engine.addShard(await this.fetchShard(name));
        }
      })().catch((err: unknown) => {
        this.loading = null;
        throw err instanceof ShardLoadError ? err : new ShardLoadError(String(err));
      });
    }
    return this.loading;
  }

  async handle(req: WorkerRequest): Promise<WorkerResponse> {
    try {
      switch (req.op) {
        case 'warmup':
          await this.load();
          return { id: req.id, ok: true, result: null };
        case 'search':
          await this.load(req.opts.rankLevel);
          return { id: req.id, ok: true, result: this.engine.search(req.query, req.opts) };
        case 'listByTag':
          await this.load();
          return { id: req.id, ok: true, result: this.engine.listByTag(req.tag, req.opts) };
        case 'listCategories':
          await this.load();
          return { id: req.id, ok: true, result: this.engine.listCategories() };
      }
    } catch (err) {
      const kind = err instanceof ShardLoadError ? 'load-failed' : 'error';
      return { id: req.id, ok: false, error: { kind, message: err instanceof Error ? err.message : String(err) } };
    }
  }
}
