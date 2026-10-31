import { SearchEngine } from '../engine/SearchEngine';
import { isShardFile, shardOrder, type ShardFile } from '../shard';
import type { IndexStatus, Level } from '../types';
import type { WorkerRequest, WorkerResponse } from './protocol';

/**
 * Fetches one shard by name: the parsed shard, or its JSON text (parsed later, in
 * priority order, so a big shard that arrives first does not delay the grammar shard).
 * Rejects on network failure.
 */
export type ShardFetcher = (name: string) => Promise<ShardFile | string>;

export class ShardLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShardLoadError';
  }
}

/** How long a query waits for the rest of the index once grammar + its level's vocab are in. */
export const PARTIAL_GRACE_MS = 250;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface Slot {
  /** Resolves once the shard is indexed. */
  done: Promise<void>;
  resolve: () => void;
  reject: (err: unknown) => void;
}

function slot(): Slot {
  let resolve: () => void = () => undefined;
  let reject: (err: unknown) => void = () => undefined;
  const done = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  done.catch(() => undefined); // observed through `all`; never an unhandled rejection
  return { done, resolve, reject };
}

/**
 * The worker's request handler, free of `self`/`postMessage` so tests can drive it
 * in-thread (QA BUG-01):
 * - every shard is requested at once (parallel downloads);
 * - shards are parsed and indexed one at a time in priority order — grammar, then the
 *   learner's level of vocab, then the rest — yielding between shards so queries waiting
 *   on the first two are answered before the rest is indexed;
 * - a query is answered once grammar + its level's vocab are indexed, after a short
 *   grace period for the rest (`status: 'partial'` if they are still out);
 * - `onStatus` reports 'loading' → 'partial' → 'ready' (or 'error'), so the main thread
 *   can re-run a partial query;
 * - a failed shard is forgotten and re-fetched by the next request; indexed ones are kept.
 */
export class SearchWorkerHost {
  private engine = new SearchEngine();
  private slots = new Map<string, Slot>();
  private arrived = new Map<string, ShardFile | string>();
  private priority: string[];
  private draining = false;
  private all: Promise<void> | null = null;
  private status: IndexStatus = 'idle';

  constructor(
    private names: string[],
    private fetchShard: ShardFetcher,
    private onStatus: (status: IndexStatus) => void = () => undefined
  ) {
    this.engine.expected = [...names];
    this.priority = shardOrder(names);
  }

  private setStatus(status: IndexStatus): void {
    if (status === this.status) return;
    this.status = status;
    this.onStatus(status);
  }

  private prioritise(rankLevel?: Level): void {
    if (rankLevel) this.priority = shardOrder(this.names, rankLevel);
  }

  /** Indexes arrived shards, highest priority first, one per macrotask. */
  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.arrived.size) {
        const name = this.priority.find((n) => this.arrived.has(n)) ?? [...this.arrived.keys()][0];
        const data = this.arrived.get(name);
        this.arrived.delete(name);
        const s = this.slots.get(name);
        try {
          const shard: unknown = typeof data === 'string' ? JSON.parse(data) : data;
          if (!isShardFile(shard)) throw new ShardLoadError(`${name}: not a search index shard of this version`);
          this.engine.addShard(shard);
          if (!this.engine.isComplete) this.setStatus('partial');
          s?.resolve();
        } catch (err) {
          this.slots.delete(name);
          s?.reject(err instanceof ShardLoadError ? err : new ShardLoadError(`${name}: ${String(err)}`));
        }
        // Let queued requests (a query waiting on grammar) run before the next shard.
        await sleep(0);
      }
    } finally {
      this.draining = false;
    }
  }

  /** Starts (or resumes) loading every shard; resolves when all are indexed. */
  private loadAll(rankLevel?: Level): Promise<void> {
    this.prioritise(rankLevel);
    if (this.all) return this.all;
    if (!this.names.length) return Promise.reject(new ShardLoadError('no search index shards were built'));
    this.setStatus(this.engine.loadedShards.length ? 'partial' : 'loading');
    for (const name of this.priority) {
      if (this.engine.loadedShards.includes(name) || this.slots.has(name)) continue;
      const s = slot();
      this.slots.set(name, s);
      this.fetchShard(name).then(
        (data) => {
          this.arrived.set(name, data);
          void this.drain();
        },
        (err: unknown) => {
          this.slots.delete(name);
          s.reject(err instanceof ShardLoadError ? err : new ShardLoadError(`${name}: ${String(err)}`));
        }
      );
    }
    this.all = Promise.all([...this.slots.values()].map((s) => s.done))
      .then(() => {
        this.slots.clear();
        this.setStatus('ready');
      })
      .catch((err: unknown) => {
        this.all = null;
        this.setStatus('error');
        throw err instanceof ShardLoadError ? err : new ShardLoadError(String(err));
      });
    this.all.catch(() => undefined); // callers that only race it must not leave it unhandled
    return this.all;
  }

  private indexed(name: string): Promise<void> {
    if (this.engine.loadedShards.includes(name) || !this.names.includes(name)) return Promise.resolve();
    return this.slots.get(name)?.done ?? Promise.resolve();
  }

  /** Waits until a query can be answered well: grammar + the level's vocab, then a grace period. */
  private async ready(rankLevel: Level): Promise<void> {
    const all = this.loadAll(rankLevel);
    if (this.engine.isComplete) return;
    await Promise.race([all, Promise.all([this.indexed('grammar'), this.indexed(`vocab-${rankLevel}`)])]);
    if (this.engine.isComplete) return;
    await Promise.race([all, sleep(PARTIAL_GRACE_MS)]);
  }

  /** Tags and categories live in the grammar shard only. */
  private async grammarReady(): Promise<void> {
    const all = this.loadAll();
    await Promise.race([all, this.indexed('grammar')]);
  }

  async handle(req: WorkerRequest): Promise<WorkerResponse> {
    try {
      switch (req.op) {
        case 'warmup':
          await this.loadAll(req.rankLevel);
          return { id: req.id, ok: true, result: null };
        case 'search':
          await this.ready(req.opts.rankLevel);
          return { id: req.id, ok: true, result: this.engine.search(req.query, req.opts) };
        case 'listByTag':
          await this.grammarReady();
          return { id: req.id, ok: true, result: this.engine.listByTag(req.tag, req.opts) };
        case 'listCategories':
          await this.grammarReady();
          return { id: req.id, ok: true, result: this.engine.listCategories() };
      }
    } catch (err) {
      const kind = err instanceof ShardLoadError ? 'load-failed' : 'error';
      return { id: req.id, ok: false, error: { kind, message: err instanceof Error ? err.message : String(err) } };
    }
  }
}
