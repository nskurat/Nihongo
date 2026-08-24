import { LevelType } from '../types/japanese';

interface LessonRange {
  min: number;
  max: number;
  default: number;
}

// Lesson numbering follows the Minna no Nihongo textbook for N4 (26-50, Book II)
// while N5 and N3 use their own independent 1-based ranges for this app's content.
const LESSON_RANGES: Record<LevelType, LessonRange> = {
  N5: { min: 1, max: 15, default: 1 },
  N4: { min: 26, max: 50, default: 26 },
  N3: { min: 1, max: 24, default: 1 },
};

export function parseLevel(raw: string | undefined): LevelType {
  const upper = raw?.toUpperCase();
  if (upper === 'N5') return 'N5';
  if (upper === 'N4') return 'N4';
  return 'N3';
}

export function getDefaultLesson(level: LevelType): number {
  return LESSON_RANGES[level].default;
}

export function clampLessonForLevel(level: LevelType, lesson: number): number {
  const { min, max, default: def } = LESSON_RANGES[level];
  if (isNaN(lesson) || lesson < min || lesson > max) return def;
  return lesson;
}
