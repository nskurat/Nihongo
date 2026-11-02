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
  N2: { min: 1, max: 26, default: 1 },
  N1: { min: 1, max: 32, default: 1 },
};

const ALL_SECTIONS: SectionType[] = ['grammar', 'vocab', 'kanji', 'reading'];

// A level offers grammar/vocab/kanji exactly when its data/{level}/{section}.json exists,
// so adding a level's content file is what turns its tab on. Only the glob's keys are
// read here; the files themselves stay lazy chunks loaded by StaticContentSource.
const CONTENT_FILES = new Set(Object.keys(import.meta.glob('../data/*/*.json')));

const hasFile = (level: LevelType, section: SectionType) =>
  CONTENT_FILES.has(`../data/${level.toLowerCase()}/${section}.json`);

// Reading Practice builds its prompts from a level's grammar and vocab, so it needs both.
function levelOffers(level: LevelType, section: SectionType): boolean {
  if (section === 'reading') return hasFile(level, 'grammar') && hasFile(level, 'vocab');
  return hasFile(level, section);
}

export const LEVEL_SECTIONS = Object.fromEntries(
  (Object.keys(LESSON_RANGES) as LevelType[]).map((level) => [
    level,
    ALL_SECTIONS.filter((section) => levelOffers(level, section)),
  ])
) as Record<LevelType, SectionType[]>;

export function isSectionAvailable(level: LevelType, section: SectionType): boolean {
  return LEVEL_SECTIONS[level].includes(section);
}

export function parseLevel(raw: string | undefined): LevelType {
  const upper = raw?.toUpperCase();
  if (upper === 'N5') return 'N5';
  if (upper === 'N4') return 'N4';
  if (upper === 'N2') return 'N2';
  if (upper === 'N1') return 'N1';
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

/**
 * The canonical path for a `/:level/:section/:lesson?` URL: lowercase level and
 * section, an unknown level read as N3, a section the level lacks read as its
 * grammar, and the lesson clamped into range (legacy N4 numbers mapped first).
 * A URL without a lesson segment keeps having none. The router redirects any
 * other spelling here with `replace`, so bookmarks and shared links show the
 * lesson that is actually on screen.
 */
export function canonicalLessonPath(
  rawLevel: string | undefined,
  rawSection: string | undefined,
  rawLesson: string | undefined
): string {
  const level = parseLevel(rawLevel);
  const requested = (rawSection?.toLowerCase() || 'grammar') as SectionType;
  const section = isSectionAvailable(level, requested) ? requested : 'grammar';
  const base = `/${level.toLowerCase()}/${section}`;
  if (rawLesson === undefined) return base;
  return `${base}/${clampLessonForLevel(level, fromLegacyLesson(level, parseInt(rawLesson, 10)))}`;
}
