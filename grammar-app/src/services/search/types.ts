/**
 * Global search contract shared by the data layer (index, planner, matcher) and the UI.
 * Source of truth: docs/search/04-data.md §1 and §5, docs/search/03-ux.md §7.2.
 * Changing a field here is a contract change — update both docs.
 */
import type { LevelType } from '../../types/japanese';

export type Level = LevelType;
export type Uid = string;
export type DocType = 'grammar' | 'vocab' | 'kanji';

/** What the query was typed in, after normalisation. */
export type Script = 'kanji' | 'kana' | 'romaji' | 'english' | 'mixed';

/** How a hit matched — drives the result's "reason" line (UX §3.3). */
export type MatchKind =
  | 'exact'
  | 'lemma' // stored dictionary form of a ます row, or an alias (お-stripped, okurigana variant)
  | 'deinflected' // query deinflected to a lemma that exists in the data
  | 'prefix'
  | 'contains'
  | 'folded' // long-vowel-folded reading
  | 'english'
  | 'compound' // matched through a kanji compound / collocation hint
  | 'kanjiFromWord' // kanji contained in a word-shaped query
  | 'tag';

export type MatchField = 'title' | 'reading' | 'meaning' | 'structure' | 'compound' | 'tag';

/** One logical search document per grammar point, vocab row or kanji (04-data §1.1). */
export interface SearchDocument {
  uid: Uid;
  type: DocType;
  level: Level;
  lesson: number;
  title: string;
  reading?: string;
  onyomi?: string[];
  kunyomi?: string[];
  meaning: string;
  structure?: string;
  tags?: string[];
  keys: {
    surface: string[];
    reading: string[];
    lemma: string[];
    alias: string[];
    hint: string[];
    folded: string[];
    en: string[];
    kanjiChars?: string[];
  };
  dupKey?: string;
}

export interface CategoryChip {
  id: string;
  label: string;
  count: number;
  tagIds: string[];
}

export interface SearchOptions {
  levels?: Level[];
  types?: DocType[];
  tag?: string;
  category?: string;
  /** The learner's current level: ties rank this level first, then lower, then higher. */
  rankLevel: Level;
  /** Rows per group; 8 by default, Infinity for "show all". */
  limitPerType?: number;
}

export interface SearchHit {
  uid: Uid;
  type: DocType;
  level: Level;
  lesson: number;
  /** Grammar title, vocab word or kanji character. */
  title: string;
  reading?: string;
  meaning: string;
  onyomi?: string[];
  kunyomi?: string[];
  structure?: string;
  tags?: string[];
  matchKind: MatchKind;
  matchField: MatchField;
  tier: number;
  /** Offsets into the DISPLAY strings. */
  highlights?: { field: MatchField; ranges: [number, number][] }[];
  deinflection?: { input: string; lemma: string; steps: { en: string; ja: string }[] };
  /** Human-readable "via" for non-exact hits, e.g. "romaji reading", "compound 迷惑". */
  via?: string;
  /** Same word+reading taught at other levels (collapsed duplicates). */
  alsoAt?: { uid: Uid; level: Level; lesson: number }[];
}

export interface SearchResponse {
  query: string;
  /** The query as matched, e.g. romaji converted to kana. */
  queryAs?: string;
  script: Script;
  /** Single-kana guard: only exact matches were considered. */
  exactOnly: boolean;
  /** False when nothing matched as a word (e.g. 丁度 → only its kanji). */
  wordMatch: boolean;
  queryHasKanji: boolean;
  groupOrder: DocType[];
  groups: Record<DocType, SearchHit[]>;
  totals: Record<DocType, number>;
  facetCounts: { type: Record<DocType, number>; level: Record<Level, number> };
  categories: CategoryChip[];
  hiddenByFilters: number;
  otherLevelsCount: number;
  /** 'partial' while later shards are still loading. */
  status: 'partial' | 'ready';
}

/**
 * Index load state, pushed through `BaseSearchSource.subscribe` (additive, fix round 2).
 * A response with `status: 'partial'` should be re-requested once this becomes 'ready'.
 */
export type IndexStatus = 'idle' | 'loading' | 'partial' | 'ready' | 'error';
