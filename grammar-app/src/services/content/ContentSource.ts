import { Level, ContentSection, StudyItem, Uid } from '../../types/content';

export interface LessonSummary {
  lesson: number;
  count: number;
}

export type ContentErrorKind = 'not-found' | 'load-failed';

/**
 * Rejection type for listLessons/getItems/search when a level+section chunk
 * can't be loaded. `getItem` never rejects (it resolves `null` for a uid that
 * parses but has no match) - `ContentError` here covers only real fetch/parse
 * failures ('load-failed') and a level+section pairing with no chunk at all
 * ('not-found', defensive - unreachable via the closed Level/ContentSection
 * types today, but meaningful once a source's catalog can vary at runtime).
 * Callers branch on `kind`; they never parse `message`.
 */
export class ContentError extends Error {
  readonly kind: ContentErrorKind;
  readonly detail?: unknown;

  constructor(kind: ContentErrorKind, detail?: unknown) {
    super(`content ${kind}: ${String(detail)}`);
    this.name = 'ContentError';
    this.kind = kind;
    this.detail = detail;
  }
}

/**
 * Abstract content backend. Every method is async and returns plain data -
 * no React, no store access here. Mirrors services/ai/readingStorage.ts's
 * shape (abstract base, async facade, swap function) so a future database
 * backend is a new class plus one `setContentSource` call.
 */
export abstract class BaseContentSource {
  abstract listLessons(level: Level, section: ContentSection): Promise<LessonSummary[]>;
  abstract getItems<T extends StudyItem>(
    level: Level,
    section: ContentSection,
    lesson: number
  ): Promise<T[]>;
  abstract getItem<T extends StudyItem>(uid: Uid): Promise<T | null>;
  abstract search<T extends StudyItem>(
    query: string,
    scope: { level: Level; section: ContentSection }
  ): Promise<T[]>;
}
