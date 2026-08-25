import { LevelType } from '../types/japanese';

export type UidSection = 'grammar' | 'vocab' | 'kanji';

/**
 * Builds the key AI cache entries are stored under: `{level}-{section}-{lesson}-{n}`,
 * the same shape Phase 1 promotes to the content's permanent `uid` field. `n` is the
 * item's 1-based position within its lesson's full (unfiltered) array, so it stays
 * stable across re-renders and search filtering.
 *
 * This exists because the data's own `id` field collides across levels today
 * (N5 and N3 grammar both start at "1-1") and inconsistently across content
 * types (some vocab/kanji ids carry a level prefix, some don't, one file's
 * ids carry the wrong level's prefix) - see docs/refactor/FINDINGS.md.
 */
export function buildUid(level: LevelType, section: UidSection, lesson: number, n: number): string {
  return `${level.toLowerCase()}-${section}-${lesson}-${n}`;
}

/**
 * Remaps a uid-keyed AI cache store back to the shape components already
 * consume: a lookup keyed by each item's own (collision-prone) `id`, scoped
 * to the items actually on screen. Scoping to `items` means two different
 * lessons' uids can never collide in the output even though the underlying
 * `id`s might.
 */
export function remapCacheToIds<T>(
  items: Array<{ id: string | number }>,
  level: LevelType,
  section: UidSection,
  lesson: number,
  store: Record<string, T>
): Record<string | number, T> {
  const out: Record<string | number, T> = {};
  items.forEach((item, index) => {
    const uid = buildUid(level, section, lesson, index + 1);
    if (store[uid] !== undefined) out[item.id] = store[uid];
  });
  return out;
}
