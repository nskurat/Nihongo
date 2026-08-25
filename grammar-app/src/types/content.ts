export type Level = 'N5' | 'N4' | 'N3';
export type ContentSection = 'grammar' | 'vocab' | 'kanji';

/** Globally unique, stable, safe as a database primary key: `{level}-{section}-{lesson}-{n}` */
export type Uid = string;

export interface StudyItem {
  uid: Uid;
  level: Level;
  section: ContentSection;
  lesson: number;
}
