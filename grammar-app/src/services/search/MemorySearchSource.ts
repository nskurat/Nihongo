import { BaseSearchSource } from './SearchSource';
import { SearchEngine } from './engine/SearchEngine';
import type { ShardFile } from './shard';
import type { CategoryChip, Level, SearchHit, SearchOptions, SearchResponse } from './types';

type ShardLoader = () => Promise<ShardFile[]>;

/**
 * In-thread search source: the same engine the worker runs, with no worker. Used by tests
 * (built from the real data with `buildSearchIndex`) and anywhere `Worker` is missing.
 */
export class MemorySearchSource extends BaseSearchSource {
  private engine = new SearchEngine();
  private loading: Promise<void> | null = null;
  private load: ShardLoader;

  constructor(shards: ShardFile[] | ShardLoader) {
    super();
    this.load = Array.isArray(shards) ? () => Promise.resolve(shards) : shards;
  }

  warmup(rankLevel?: Level): Promise<void> {
    void rankLevel;
    if (!this.loading) {
      this.loading = this.load()
        .then((shards) => {
          this.engine.expected = shards.map((s) => s.shard);
          for (const s of shards) this.engine.addShard(s);
        })
        .catch((err: unknown) => {
          this.loading = null;
          throw err;
        });
    }
    return this.loading;
  }

  async search(query: string, opts: SearchOptions): Promise<SearchResponse> {
    await this.warmup();
    return this.engine.search(query, opts);
  }

  async listByTag(tag: string, opts?: Omit<SearchOptions, 'tag'>): Promise<SearchHit[]> {
    await this.warmup();
    return this.engine.listByTag(tag, opts);
  }

  async listCategories(): Promise<CategoryChip[]> {
    await this.warmup();
    return this.engine.listCategories();
  }

  /** The underlying engine (tests, diagnostics). */
  get searchEngine(): SearchEngine {
    return this.engine;
  }
}
