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

/**
 * Exact and lemma hits form one band in which level decides first (owner decisions D1/D3,
 * docs/search/07-regression.md): a core N5 word reached through its ます-row or dictionary
 * form (います, お酒) ranks above a rarer word whose reading is the query (炒る N2, 酒 N3).
 * Below that band, tier and sub-order come before level as before.
 */
const band = (tier: number) => (tier <= TIER.lemma ? 0 : tier);

export function compareHits(current: Level) {
  return (a: Rankable, b: Rankable): number =>
    band(a.tier) - band(b.tier) ||
    (band(a.tier) === 0 ? levelRank(a.level, current) - levelRank(b.level, current) : 0) ||
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
  /** Level of the group's best hit (N5 = 0). */
  level: number;
}

/**
 * A kanji whose reading is the query is a weaker answer than a word with that reading
 * (たべる → 食べます before 食; regression R2). Applied only to group order.
 */
const KANJI_GROUP_PENALTY = 1.5;

/**
 * Orders groups by their best hit (teacher review F4, QA BUG-03, regression R2/D2): the
 * group with the strongest match comes first. Weak matches (tier ≥ 7: hints, structure,
 * patterns inside the query) are not passed in. When Vocab and Grammar both have an
 * exact/lemma hit, the more basic one leads (ます → Vます N5 over 増す N3; いくら → いくら N5
 * over the N4 point), and at the same level the word leads (だれ → 誰, わかります). Other ties
 * keep the script default.
 */
export function orderGroups(defaults: DocType[], best: Partial<Record<DocType, GroupBest>>): DocType[] {
  const score = (t: DocType) => {
    const b = best[t];
    if (!b) return { tier: Infinity, sub: 0, level: 0 };
    return t === 'kanji' ? { ...b, tier: b.tier + KANJI_GROUP_PENALTY } : b;
  };
  const wordAndGrammar = (a: DocType, b: DocType) =>
    (a === 'vocab' && b === 'grammar') || (a === 'grammar' && b === 'vocab');
  return [...defaults].sort((a, b) => {
    const x = score(a);
    const y = score(b);
    if (wordAndGrammar(a, b) && x.tier <= TIER.lemma && y.tier <= TIER.lemma) {
      if (x.level !== y.level) return x.level - y.level;
      return a === 'vocab' ? -1 : 1;
    }
    if (x.tier !== y.tier) return x.tier - y.tier;
    if (x.tier !== Infinity && x.sub !== y.sub) return x.sub - y.sub;
    return defaults.indexOf(a) - defaults.indexOf(b);
  });
}
