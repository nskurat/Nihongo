import { useCallback, useEffect, useMemo, useState } from 'react';
import { contentRepository } from '../services/content/StaticContentSource';
import { ContentError, LessonSummary } from '../services/content/ContentSource';
import { Level, ContentSection } from '../types/content';

export interface LessonListResult {
  lessons: LessonSummary[];
  /** Lesson numbers in list order, for the sidebar. */
  totalLessons: number[];
  /** Item count per lesson number. */
  lessonCounts: Record<number, number>;
  loading: boolean;
  error: ContentError | null;
  retry: () => void;
}

/** What a settled lesson-list request wrote, tagged with the request it answers. */
export interface LessonListState {
  key: string;
  lessons: LessonSummary[];
  error: ContentError | null;
}

const NO_LESSONS: LessonSummary[] = [];

export const EMPTY_LESSON_LIST: LessonListState = { key: '', lessons: NO_LESSONS, error: null };

export function toContentError(err: unknown): ContentError {
  return err instanceof ContentError ? err : new ContentError('load-failed', err);
}

/**
 * Fetches one level+section's lesson list as a state value. Never rejects: a
 * failed chunk becomes `error`, so no caller can leak an unhandled rejection.
 */
export function fetchLessonList(
  level: Level,
  section: ContentSection,
  key: string
): Promise<LessonListState> {
  return contentRepository.listLessons(level, section).then(
    (lessons) => ({ key, lessons, error: null }),
    (err: unknown) => ({ key, lessons: [], error: toContentError(err) })
  );
}

/**
 * Reads `state` for the request identified by `key`. State written for any
 * other request (e.g. the previous level) counts as still loading and yields
 * no lessons, so a stale level's list never renders.
 */
export function resolveLessonList(
  state: LessonListState,
  key: string
): Pick<LessonListResult, 'lessons' | 'loading' | 'error'> {
  const loading = state.key !== key;
  return {
    lessons: loading ? NO_LESSONS : state.lessons,
    loading,
    error: loading ? null : state.error,
  };
}

/**
 * The sidebar's lesson list for one level+section. Same key-comparison
 * discipline as useContentQuery: `loading` is derived, and the effect only
 * calls setState once the fetch settles (react-hooks/set-state-in-effect).
 */
export function useLessonList(level: Level, section: ContentSection): LessonListResult {
  const [retryToken, setRetryToken] = useState(0);
  const key = `${level}:${section}:${retryToken}`;
  const [state, setState] = useState<LessonListState>(EMPTY_LESSON_LIST);

  useEffect(() => {
    let cancelled = false;
    fetchLessonList(level, section, key).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` encodes level/section/retryToken already
  }, [key]);

  const retry = useCallback(() => setRetryToken((t) => t + 1), []);
  const { lessons, loading, error } = resolveLessonList(state, key);
  const totalLessons = useMemo(() => lessons.map((l) => l.lesson), [lessons]);
  const lessonCounts = useMemo(
    () => Object.fromEntries(lessons.map((l) => [l.lesson, l.count])),
    [lessons]
  );
  return { lessons, totalLessons, lessonCounts, loading, error, retry };
}
