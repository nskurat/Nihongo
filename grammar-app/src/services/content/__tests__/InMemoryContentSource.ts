import { BaseContentSource, LessonSummary } from '../ContentSource';
import { Level, ContentSection, StudyItem } from '../../../types/content';

/**
 * Throwaway in-memory backend used only to prove a ContentSource can be
 * swapped in with zero changes to any caller - contentRepository is the only
 * thing components ever touch, and it just forwards to whichever source is
 * currently registered via setContentSource. This is the shape a future
 * FirebaseContentSource (or any database-backed source) would take.
 */
export class InMemoryContentSource extends BaseContentSource {
  constructor(private data: Partial<Record<Level, Partial<Record<ContentSection, Record<number, StudyItem[]>>>>>) {
    super();
  }

  private chunk(level: Level, section: ContentSection): Record<number, StudyItem[]> {
    return this.data[level]?.[section] || {};
  }

  async listLessons(level: Level, section: ContentSection): Promise<LessonSummary[]> {
    const chunk = this.chunk(level, section);
    return Object.keys(chunk)
      .map(Number)
      .sort((a, b) => a - b)
      .map((lesson) => ({ lesson, count: chunk[lesson].length }));
  }

  async getItems<T extends StudyItem>(level: Level, section: ContentSection, lesson: number): Promise<T[]> {
    return (this.chunk(level, section)[lesson] as T[] | undefined) || [];
  }

  async getItem<T extends StudyItem>(uid: string): Promise<T | null> {
    for (const sections of Object.values(this.data)) {
      for (const chunk of Object.values(sections || {})) {
        for (const items of Object.values(chunk)) {
          const found = items.find((item) => item.uid === uid);
          if (found) return found as T;
        }
      }
    }
    return null;
  }

  async search<T extends StudyItem>(query: string, scope: { level: Level; section: ContentSection }): Promise<T[]> {
    const q = query.toLowerCase();
    const chunk = this.chunk(scope.level, scope.section);
    return Object.values(chunk)
      .flat()
      .filter((item) => JSON.stringify(item).toLowerCase().includes(q)) as T[];
  }
}
