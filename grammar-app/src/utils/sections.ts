import { BookOpen, BookOpenCheck, BookText, Languages, type LucideIcon } from 'lucide-react';
import { SectionType } from '../types/japanese';

export interface SectionEntry {
  id: SectionType;
  /** Header tab label. */
  label: string;
  /** Mid-sentence name, e.g. in "Vocabulary, kanji and reading practice are not available". */
  noun: string;
  icon: LucideIcon;
}

/**
 * Every study section, in header order. Adding a section is one entry here plus its
 * route component; whether a level shows it still comes from `isSectionAvailable`.
 */
export const SECTIONS: readonly SectionEntry[] = [
  { id: 'grammar', label: 'Grammar', noun: 'grammar', icon: BookOpen },
  { id: 'vocab', label: 'Vocabulary', noun: 'vocabulary', icon: BookText },
  { id: 'kanji', label: 'Kanji', noun: 'kanji', icon: Languages },
  { id: 'reading', label: 'Reading Practice', noun: 'reading practice', icon: BookOpenCheck },
];
