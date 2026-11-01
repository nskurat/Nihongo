import { Level, StudyItem } from './content';

export type LevelType = Level;

export type SectionType = 'grammar' | 'vocab' | 'kanji' | 'reading';

export interface GrammarItem extends StudyItem {
  title: string;
  meaning: string;
  structure: string;
  explanation: string;
  summary?: string;
  details?: string;
  tags?: string[];
  examples?: Array<{
    jp: string;
    en: string;
  }>;
}

export interface TagDefinition {
  label: string;
  description: string;
}

export interface FacetDefinition {
  label: string;
  color: string;
  description: string;
  tags: Record<string, TagDefinition>;
}

export interface TagTaxonomy {
  facets: Record<string, FacetDefinition>;
}

export interface VocabItem extends StudyItem {
  word: string;
  reading: string;
  romaji?: string;
  /**
   * Part of speech, N5/N4 only: one value of the closed set in scripts/lib/vocabPos.ts
   * (`verb-godan`, `na-adjective` …), or one per part joined with ` / ` for a ／ pair.
   */
  pos?: string;
  /** Dictionary form of a ます row (食べます → 食べる); ／-joined like `word` for pairs. */
  lemma?: string;
  lemmaReading?: string;
  meaning: string;
  exampleJp?: string;
  exampleEn?: string;
}

export interface KanjiCompound {
  word: string;
  /** null where the source data has no reading yet (N4 rows, see docs/backlog.md). */
  reading: string | null;
  /** null where the source data has no meaning yet. */
  meaning: string | null;
}

export interface KanjiItem extends StudyItem {
  kanji: string;
  meaning: string;
  onyomi?: string[];
  kunyomi?: string[];
  strokes: number;
  radical?: string;
  strokeOrderLink?: string;
  exampleJp?: string;
  exampleEn?: string;
  compounds?: KanjiCompound[];
}

export type FuriganaToken =
  | { type: 'text'; content: string }
  | { type: 'ruby'; base: string; ruby: string };

export interface StudyDataSet {
  grammar: Record<number, GrammarItem[]>;
  vocab: Record<number, VocabItem[]>;
  kanji: Record<number, KanjiItem[]>;
}
