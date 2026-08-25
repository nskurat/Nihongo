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
  pos?: string;
  meaning: string;
  exampleJp?: string;
  exampleEn?: string;
}

export interface KanjiCompound {
  word: string;
  reading: string;
  meaning: string;
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
