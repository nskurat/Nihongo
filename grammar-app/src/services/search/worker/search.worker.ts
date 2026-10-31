/// <reference lib="webworker" />
import { isShardFile } from '../shard';
import { SearchWorkerHost, ShardLoadError } from './host';
import type { WorkerRequest } from './protocol';

/**
 * Search Web Worker: holds the index, planner and matcher off the main thread.
 * Shard URLs come from Vite (content-hashed assets under import.meta.env.BASE_URL), so
 * an index can only ever be paired with the build that produced it.
 */
const urls = import.meta.glob('../../../generated/search/*.json', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const byName = new Map<string, string>();
for (const [path, url] of Object.entries(urls)) {
  const name = path.split('/').pop()?.replace(/\.json$/, '');
  if (name) byName.set(name, url);
}

async function fetchShard(name: string) {
  const url = byName.get(name);
  if (!url) throw new ShardLoadError(`unknown shard ${name}`);
  const res = await fetch(url);
  if (!res.ok) throw new ShardLoadError(`${name}: HTTP ${res.status}`);
  const json: unknown = await res.json();
  if (!isShardFile(json)) throw new ShardLoadError(`${name}: not a search index shard of this version`);
  return json;
}

const host = new SearchWorkerHost([...byName.keys()], fetchShard);
const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  void host.handle(event.data).then((response) => scope.postMessage(response));
};
