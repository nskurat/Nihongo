import { LevelType, SectionType } from '../types/japanese';
import { parseLevel, clampLessonForLevel } from './levels';

const VALID_SECTIONS: SectionType[] = ['grammar', 'vocab', 'kanji', 'reading'];

export interface LegacyUrlTarget {
  level: LevelType;
  section: SectionType;
  lesson: number;
}

/**
 * Parses the old `?level=&section=&lesson=` query params and `#section` hash
 * shortcuts (both predate the /:level/:section/:lesson router) into a
 * normalized redirect target. Returns null when neither carries any signal,
 * so the caller can fall back to the default route.
 */
export function parseLegacyUrl(search: string, hash: string): LegacyUrlTarget | null {
  const params = new URLSearchParams(search);
  const rawHash = hash.replace('#', '').toLowerCase();

  if (!params.has('level') && !params.has('section') && !params.has('lesson') && !rawHash) {
    return null;
  }

  const level = parseLevel(params.get('level') || undefined);

  let section = (params.get('section') || rawHash || 'grammar').toLowerCase() as SectionType;
  if (!VALID_SECTIONS.includes(section)) section = 'grammar';

  const lesson = clampLessonForLevel(level, parseInt(params.get('lesson') || '', 10));

  return { level, section, lesson };
}
