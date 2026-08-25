/**
 * Remaps a uid-keyed AI cache store back to the shape components already
 * consume: a lookup keyed by each item's own (collision-prone, deprecated)
 * `id`, scoped to the items actually on screen. Scoping to `items` means two
 * different lessons' uids can never collide in the output even though the
 * underlying `id`s might - see docs/refactor/FINDINGS.md for why `id` collides.
 *
 * Items without an `id` are skipped: there's no legacy key to attach the
 * cached value to. That only happens once Phase 2 removes `id` entirely,
 * at which point this whole remap layer goes away too.
 */
export function remapCacheToIds<T>(
  items: Array<{ id?: string | number; uid: string }>,
  store: Record<string, T>
): Record<string | number, T> {
  const out: Record<string | number, T> = {};
  items.forEach((item) => {
    if (item.id === undefined) return;
    if (store[item.uid] !== undefined) out[item.id] = store[item.uid];
  });
  return out;
}
