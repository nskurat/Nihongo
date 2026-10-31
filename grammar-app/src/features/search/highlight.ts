import type { MatchField, SearchHit } from '../../services/search/types';

export interface TextSegment {
  text: string;
  mark: boolean;
}

/**
 * Splits a display string into plain/marked segments from service-supplied ranges
 * (`[start, end)` offsets into that same string). Ranges are clamped, sorted and merged;
 * empty or out-of-bounds ranges are dropped. No ranges → one plain segment.
 * The UI never guesses ranges itself (03-ux §3.3).
 */
export function splitHighlights(text: string, ranges: readonly [number, number][] | undefined): TextSegment[] {
  if (!text) return [];
  const clean = (ranges ?? [])
    .map(([s, e]) => [Math.max(0, Math.min(s, e)), Math.min(text.length, Math.max(s, e))] as [number, number])
    .filter(([s, e]) => Number.isFinite(s) && Number.isFinite(e) && e > s)
    .sort((a, b) => a[0] - b[0]);

  const merged: [number, number][] = [];
  for (const r of clean) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }

  const out: TextSegment[] = [];
  let pos = 0;
  for (const [s, e] of merged) {
    if (s > pos) out.push({ text: text.slice(pos, s), mark: false });
    out.push({ text: text.slice(s, e), mark: true });
    pos = e;
  }
  if (pos < text.length) out.push({ text: text.slice(pos), mark: false });
  return out;
}

/** All ranges the service returned for one field of a hit. */
export function rangesFor(hit: Pick<SearchHit, 'highlights'>, field: MatchField): [number, number][] {
  return (hit.highlights ?? []).filter((h) => h.field === field).flatMap((h) => h.ranges);
}
