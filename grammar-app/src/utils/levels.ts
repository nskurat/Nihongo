import { LevelType, SectionType } from '../types/japanese';

interface LessonRange {
  min: number;
  max: number;
  default: number;
}

// Every level numbers its lessons independently from 1.
// Exported as the single source of truth for scripts/validate-content.ts.
export const LESSON_RANGES: Record<LevelType, LessonRange> = {
  N5: { min: 1, max: 25, default: 1 },
  N4: { min: 1, max: 25, default: 1 },
  N3: { min: 1, max: 24, default: 1 },
  N2: { min: 1, max: 11, default: 1 },
};

const ALL_SECTIONS: SectionType[] = ['grammar', 'vocab', 'kanji', 'reading'];

// N2 is a grammar-only preview: there is no N2 vocab or kanji content, and
// Reading Practice builds its prompts from a level's vocab.
export const LEVEL_SECTIONS: Record<LevelType, SectionType[]> = {
  N5: ALL_SECTIONS,
  N4: ALL_SECTIONS,
  N3: ALL_SECTIONS,
  N2: ['grammar'],
};

export function isSectionAvailable(level: LevelType, section: SectionType): boolean {
  return LEVEL_SECTIONS[level].includes(section);
}

export function parseLevel(raw: string | undefined): LevelType {
  const upper = raw?.toUpperCase();
  if (upper === 'N5') return 'N5';
  if (upper === 'N4') return 'N4';
  if (upper === 'N2') return 'N2';
  return 'N3';
}

// N4 lessons used to be numbered 26-50 (continuing on from N5). Old bookmarks,
// ?lesson= links and saved reading history still carry those numbers; since
// 26-50 is now out of range for every level, mapping them is unambiguous.
const LEGACY_N4_OFFSET = 25;

export function fromLegacyLesson(level: LevelType, lesson: number): number {
  return level === 'N4' && lesson >= 26 && lesson <= 50 ? lesson - LEGACY_N4_OFFSET : lesson;
}

export function getDefaultLesson(level: LevelType): number {
  return LESSON_RANGES[level].default;
}

export function clampLessonForLevel(level: LevelType, lesson: number): number {
  const { min, max, default: def } = LESSON_RANGES[level];
  if (isNaN(lesson) || lesson < min || lesson > max) return def;
  return lesson;
}
