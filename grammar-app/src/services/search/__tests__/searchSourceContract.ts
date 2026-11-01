import { expect, it } from 'vitest';
import type { BaseSearchSource } from '../SearchSource';

/**
 * Shared contract every BaseSearchSource must pass against the real data (04-data §8):
 * the static worker source, the in-memory source, and any future database adapter.
 */
export function searchSourceContract(make: () => BaseSearchSource): void {
  it('contract: listByTag("comparison") → 18 points, N5 → N1', async () => {
    const list = await make().listByTag('comparison');
    expect(list).toHaveLength(18);
    const order = list.map((h) => ['N5', 'N4', 'N3', 'N2', 'N1'].indexOf(h.level) * 1000 + h.lesson);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('contract: search returns grouped, typed results with totals and facets', async () => {
    const src = make();
    await src.warmup('N5');
    const r = await src.search('ものの', { rankLevel: 'N5' });
    expect(r.groups.grammar[0]).toMatchObject({ title: '〜ものの', level: 'N2', type: 'grammar', matchKind: 'exact' });
    expect(r.totals.grammar).toBeGreaterThanOrEqual(1);
    expect(r.facetCounts.level.N2).toBeGreaterThanOrEqual(1);
    expect(r.status).toBe('ready');
  });

  it('contract: listCategories lists the alias categories with counts', async () => {
    const cats = await make().listCategories();
    expect(cats.find((c) => c.id === 'comparison')?.count).toBe(18);
  });
}
