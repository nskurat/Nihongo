import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { ContentError } from '../../content/ContentSource';
import { MemorySearchSource } from '../MemorySearchSource';
import { searchRepository, setSearchSource } from '../SearchSource';
import { WorkerSearchSource, type WorkerLike } from '../WorkerSearchSource';
import { SearchWorkerHost, ShardLoadError, type ShardFetcher } from '../worker/host';

import type { WorkerMessage, WorkerRequest } from '../worker/protocol';
import type { ShardFile } from '../shard';
import type { SearchResponse } from '../types';
import { realIndex } from './realIndex';
import { searchSourceContract } from './searchSourceContract';

const { build } = realIndex();
const byName = new Map(build.shards.map((s) => [s.shard, s]));

/** An in-thread stand-in for `new Worker(...)` that runs the real worker host. */
class FakeWorker implements WorkerLike {
  onmessage: ((event: MessageEvent<WorkerMessage>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  constructor(makeHost: (emit: (m: WorkerMessage) => void) => SearchWorkerHost) {
    this.host = makeHost((m) => this.onmessage?.({ data: structuredClone(m) } as MessageEvent<WorkerMessage>));
  }
  private host: SearchWorkerHost;
  postMessage(message: WorkerRequest): void {
    // Structured clone, as postMessage would.
    const req = structuredClone(message);
    void this.host.handle(req).then((res) => this.onmessage?.({ data: structuredClone(res) } as MessageEvent<WorkerMessage>));
  }
  terminate(): void {
    this.terminated = true;
  }
}

const okFetch = async (name: string): Promise<ShardFile> => {
  const s = byName.get(name as ShardFile['shard']);
  if (!s) throw new ShardLoadError(`missing ${name}`);
  return s;
};

const workerSource = (fetcher: ShardFetcher = okFetch) =>
  new WorkerSearchSource(
    () => new FakeWorker((emit) => new SearchWorkerHost([...byName.keys()], fetcher, (status) => emit({ event: 'status', status })))
  );

describe('MemorySearchSource contract', () => {
  searchSourceContract(() => realIndex().source);
});

describe('WorkerSearchSource contract (fake worker running the real host)', () => {
  searchSourceContract(() => workerSource());
});

describe('WorkerSearchSource', () => {
  it('rejects with ContentError(load-failed) when a shard fails, then retries', async () => {
    let fail = true;
    const src = workerSource(async (name) => {
      if (fail && name === 'kanji') throw new ShardLoadError('offline');
      return okFetch(name);
    });
    await expect(src.warmup()).rejects.toBeInstanceOf(ContentError);
    await expect(src.search('ものの', { rankLevel: 'N5' })).rejects.toMatchObject({ kind: 'load-failed' });
    fail = false;
    const r = await src.search('ものの', { rankLevel: 'N5' });
    expect(r.groups.grammar[0].title).toBe('〜ものの');
  });

  it('fetches shards in parallel and answers from grammar + level vocab with status partial', async () => {
    let releaseKanji: () => void = () => undefined;
    const kanjiGate = new Promise<void>((resolve) => (releaseKanji = resolve));
    const started: string[] = [];
    const statuses: string[] = [];
    const host = new SearchWorkerHost(
      [...byName.keys()],
      async (name) => {
        started.push(name);
        if (name === 'kanji') await kanjiGate;
        return okFetch(name);
      },
      (s) => statuses.push(s)
    );
    const res = await host.handle({ id: 1, op: 'search', query: 'ものの', opts: { rankLevel: 'N3' } });
    expect(started).toHaveLength(byName.size); // all requested up front
    expect(started.slice(0, 2)).toEqual(['grammar', 'vocab-N3']);
    const first = res.ok ? (res.result as SearchResponse) : null;
    expect(first?.status).toBe('partial');
    expect(first?.groups.grammar[0].title).toBe('〜ものの');
    releaseKanji();
    const ready = await host.handle({ id: 2, op: 'warmup' });
    expect(ready.ok).toBe(true);
    expect(statuses).toEqual(['loading', 'partial', 'ready']);
    const again = await host.handle({ id: 3, op: 'search', query: '因', opts: { rankLevel: 'N3' } });
    expect(again.ok ? (again.result as SearchResponse).status : null).toBe('ready');
  });

  it('forwards status events to subscribers', async () => {
    const src = workerSource();
    const seen: string[] = [];
    const off = src.subscribe((s) => seen.push(s));
    await src.warmup('N4');
    off();
    expect(seen).toContain('ready');
  });

  it('rejects shards from a different build as load-failed', async () => {
    const src = workerSource(async (name) => {
      const s = await okFetch(name);
      return name === 'kanji' ? { ...s, contentHash: 'stale' } : s;
    });
    await expect(src.warmup()).rejects.toMatchObject({ kind: 'load-failed' });
  });

  it('fails calls in flight when the worker script errors, and starts a new worker next time', async () => {
    const workers: FakeWorker[] = [];
    const src = new WorkerSearchSource(() => {
      const w = new FakeWorker(() => new SearchWorkerHost([...byName.keys()], () => new Promise<ShardFile>(() => {})));
      workers.push(w);
      return w;
    });
    const pending = src.warmup();
    workers[0].onerror?.({ message: 'boom' } as ErrorEvent);
    await expect(pending).rejects.toBeInstanceOf(ContentError);
    expect(workers[0].terminated).toBe(true);
    void src.warmup();
    expect(workers).toHaveLength(2);
  });

  it('works through the searchRepository facade', async () => {
    setSearchSource(new MemorySearchSource(build.shards));
    const r = await searchRepository.search('因', { rankLevel: 'N3' });
    expect(r.groups.kanji[0].title).toBe('因');
  });
});

describe('index build (real data)', () => {
  it('stays inside the size budget (gzip ≤ 400 KB total, grammar ≤ 80 KB)', () => {
    let total = 0;
    const sizes: Record<string, number> = {};
    for (const s of build.shards) {
      const gz = gzipSync(JSON.stringify(s), { level: 9 }).length;
      sizes[s.shard] = gz;
      total += gz;
    }
    expect(sizes.grammar).toBeLessThanOrEqual(80 * 1024);
    expect(total).toBeLessThanOrEqual(400 * 1024);
  });

  it('builds 7 versioned shards with one content hash', () => {
    expect(build.shards.map((s) => s.shard).sort()).toEqual(
      ['grammar', 'kanji', 'vocab-N1', 'vocab-N2', 'vocab-N3', 'vocab-N4', 'vocab-N5'].sort()
    );
    for (const s of build.shards) expect(s).toMatchObject({ schema: 'search-index', v: 1, contentHash: 'test' });
    expect(build.report.warnings).toEqual([]);
  });

  it('derives ます lemmas for N5/N4 rows only', () => {
    expect(build.report.masu.length).toBeGreaterThan(200);
    expect(build.report.masu.every((r) => /^n[54]-/.test(r.uid))).toBe(true);
    const lemma = (uid: string) => build.report.masu.filter((r) => r.uid === uid).map((r) => r.lemma);
    expect(lemma('n5-vocab-9-1')).toEqual(['わかる']);
  });

  it('ships only kanji compounds that are not vocab rows', () => {
    const kanji = byName.get('kanji');
    const vocabWords = new Set(build.shards.filter((s) => s.shard.startsWith('vocab')).flatMap((s) => s.docs.map((d) => d[1])));
    const extra = kanji?.shard === 'kanji' ? kanji.docs.flatMap((d) => d[5] ?? []) : [];
    expect(extra.length).toBeGreaterThan(0);
    expect(extra.some((c) => vocabWords.has(c))).toBe(false);
  });
});
