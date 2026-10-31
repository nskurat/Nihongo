/**
 * Refreshes grammar-app/src/services/ai/modelCatalog.json, the curated model list the AI
 * settings modal and the providers fall back on.
 *
 * Downloads LiteLLM's public model metadata (a GitHub raw file, NOT an AI provider: this
 * spends no tokens and sends no key), filters and names it with the pure helpers in
 * scripts/lib/modelCatalog.ts, and writes the result. Review the diff and commit it.
 *
 * Usage: npm run update:models
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LITELLM_SOURCE_URL, buildModelCatalog } from './lib/modelCatalog';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'grammar-app/src/services/ai/modelCatalog.json');

async function main(): Promise<void> {
  const res = await fetch(LITELLM_SOURCE_URL);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  const raw = (await res.json()) as Record<string, unknown>;

  const catalog = buildModelCatalog(raw, new Date());
  for (const [provider, models] of Object.entries(catalog.providers)) {
    if (models.length === 0) throw new Error(`No ${provider} models survived filtering; refusing to write.`);
    console.log(`${provider}: ${models.map((m) => m.id).join(', ')}`);
  }

  writeFileSync(OUT, `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(`Wrote ${OUT}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
