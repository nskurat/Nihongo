import { kataToHira } from '../normalize';

export interface KanjiReadingKeys {
  /** Full reading, separators removed (まよ・う → まよう; メイ → めい). */
  full: string;
  /** Kun stem before the okurigana separator (まよ), when it differs from `full`. */
  stem?: string;
}

/**
 * Keys of one kanji reading (docs/search/04-data.md §2.4). Accepts all three separator
 * styles (`・`, `.`, affix `-`) so a future source refresh cannot break matching.
 */
export function kanjiReadingKeys(reading: string): KanjiReadingKeys | null {
  const clean = kataToHira(reading.normalize('NFKC')).trim().replace(/^-+|-+$/g, '');
  const full = clean.replace(/[.・-]/g, '');
  if (!full) return null;
  const stem = clean.split(/[.・]/)[0].replace(/-/g, '');
  return stem && stem !== full ? { full, stem } : { full };
}
