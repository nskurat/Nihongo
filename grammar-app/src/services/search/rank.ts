import type { DocType, Level, Script } from './types';

/**
 * Ranking and grouping rules (docs/search/04-data.md §3.5), shared by every backend.
 */

export const TIER = {
  exact: 0,
  lemma: 1,
  deinflected: 2,
  prefix: 3,
  contains: 4,
  folded: 5,
  english: 6,
  summary: 6.5,
  hint: 7,
} as const;

const LEVEL_INDEX: Record<Level, number> = { N5: 0, N4: 1, N3: 2, N2: 3, N1: 4 };

/**
 * Tie-break by level: the learner's level first, then lower levels nearest first (review),
 * then higher levels nearest first.
 */
export function levelRank(level: Level, current: Level): number {
  const a = LEVEL_INDEX[current];
  const b = LEVEL_INDEX[level];
  if (a === b) return 0;
  return b < a ? a - b : 10 + (b - a);
}

/** N5 → N1. */
export function levelIndex(level: Level): number {
  return LEVEL_INDEX[level];
}

export interface Rankable {
  tier: number;
  /** Order inside a tier before the level tie-break (deinflection depth, phrase vs AND). */
  sub: number;
  level: Level;
  lesson: number;
  pos: number;
}

export function compareHits(current: Level) {
  return (a: Rankable, b: Rankable): number =>
    a.tier - b.tier ||
    a.sub - b.sub ||
    levelRank(a.level, current) - levelRank(b.level, current) ||
    a.lesson - b.lesson ||
    a.pos - b.pos;
}

/**
 * Group order follows the query script (PM US-7): a single kanji puts Kanji first, kana/〜
 * Grammar first, English Vocab first; a romaji query whose reading hits a word exactly
 * puts Vocab first.
 */
export function groupOrderFor(script: Script, opts: { singleKanji: boolean; romajiExact: boolean }): DocType[] {
  if (opts.singleKanji) return ['kanji', 'vocab', 'grammar'];
  switch (script) {
    case 'kana':
      return ['grammar', 'vocab', 'kanji'];
    case 'romaji':
      return opts.romajiExact ? ['vocab', 'kanji', 'grammar'] : ['grammar', 'vocab', 'kanji'];
    case 'english':
      return ['vocab', 'grammar', 'kanji'];
    default:
      return ['vocab', 'grammar', 'kanji'];
  }
}
