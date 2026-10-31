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
 * Tie-break by level (orchestrator decision, 02-requirements §5): more basic first — N5
 * before N4 … before N1 — whatever the learner's level, so a rare word at the current
 * level never buries a core N5/N4 word. `current` is kept for API stability.
 */
export function levelRank(level: Level, current?: Level): number {
  void current;
  return LEVEL_INDEX[level];
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
  /** Headword length: shorter (more basic) words first among equals. 0 to skip. */
  len: number;
  lesson: number;
  pos: number;
}

export function compareHits(current: Level) {
  return (a: Rankable, b: Rankable): number =>
    a.tier - b.tier ||
    a.sub - b.sub ||
    levelRank(a.level, current) - levelRank(b.level, current) ||
    a.len - b.len ||
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

export interface GroupBest {
  tier: number;
  sub: number;
}

/**
 * Orders groups by their best hit (teacher review F4, QA BUG-03): the group with the
 * strongest match comes first. Weak matches (tier ≥ 7: hints, structure, patterns inside
 * the query) are not passed in. Ties keep the script default, except that a Vocab exact
 * hit on a verb/adjective beats a Grammar exact hit (わかります, いきます).
 */
export function orderGroups(defaults: DocType[], best: Partial<Record<DocType, GroupBest>>, vocabWinsTie: boolean): DocType[] {
  const score = (t: DocType) => best[t] ?? { tier: Infinity, sub: 0 };
  return [...defaults].sort((a, b) => {
    const x = score(a);
    const y = score(b);
    if (x.tier !== y.tier) return x.tier - y.tier;
    if (x.tier !== Infinity && x.sub !== y.sub) return x.sub - y.sub;
    if (vocabWinsTie && x.tier !== Infinity) {
      if (a === 'vocab' && b === 'grammar') return -1;
      if (a === 'grammar' && b === 'vocab') return 1;
    }
    return defaults.indexOf(a) - defaults.indexOf(b);
  });
}
