import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EMPTY_LESSON_LIST,
  fetchLessonList,
  resolveLessonList,
  LessonListState,
} from '../useLessonList';
import { loadReadingData, resolveReadingData } from '../reading/useReadingData';
import { BaseContentSource, ContentError } from '../../services/content/ContentSource';
import { setContentSource, StaticContentSource } from '../../services/content/StaticContentSource';
import { InMemoryContentSource } from '../../services/content/__tests__/InMemoryContentSource';

/** A source whose every chunk import fails, as a broken deploy or offline load would. */
class FailingContentSource extends BaseContentSource {
  listLessons(): Promise<never> {
    return Promise.reject(new ContentError('load-failed', 'chunk import failed'));
  }
  getItems(): Promise<never> {
    return Promise.reject(new Error('raw failure, not a ContentError'));
  }
  getItem(): Promise<never> {
    return Promise.reject(new ContentError('load-failed', 'chunk import failed'));
  }
  search(): Promise<never> {
    return Promise.reject(new ContentError('load-failed', 'chunk import failed'));
  }
}

const n5Lessons: LessonListState = {
  key: 'N5:grammar:0',
  lessons: [
    { lesson: 1, count: 3 },
    { lesson: 25, count: 4 },
  ],
  error: null,
};

describe('resolveLessonList', () => {
  it('returns no lessons, not the previous level, on the render after a level change', () => {
    const next = resolveLessonList(n5Lessons, 'N4:grammar:0');
    expect(next.lessons).toEqual([]);
    expect(next.loading).toBe(true);
    expect(next.error).toBeNull();
  });

  it('returns the lessons once the state matches the requested key', () => {
    const now = resolveLessonList(n5Lessons, 'N5:grammar:0');
    expect(now.lessons).toBe(n5Lessons.lessons);
    expect(now.loading).toBe(false);
  });

  it('treats a retry as a new request', () => {
    expect(resolveLessonList(n5Lessons, 'N5:grammar:1').loading).toBe(true);
  });

  it('is loading before anything has been fetched', () => {
    expect(resolveLessonList(EMPTY_LESSON_LIST, 'N5:grammar:0')).toEqual({
      lessons: [],
      loading: true,
      error: null,
    });
  });
});

describe('lesson list loading against a failing source', () => {
  const unhandled = vi.fn();

  beforeEach(() => {
    unhandled.mockReset();
    process.on('unhandledRejection', unhandled);
    setContentSource(new FailingContentSource());
  });

  afterEach(() => {
    process.off('unhandledRejection', unhandled);
    setContentSource(new StaticContentSource());
  });

  /** Lets any stray rejection reach the process-level handler before asserting. */
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('resolves to an error state instead of rejecting', async () => {
    const state = await fetchLessonList('N5', 'grammar', 'N5:grammar:0');
    expect(state.lessons).toEqual([]);
    expect(state.error).toBeInstanceOf(ContentError);
    expect(state.error?.kind).toBe('load-failed');

    const shown = resolveLessonList(state, 'N5:grammar:0');
    expect(shown.loading).toBe(false);
    expect(shown.error?.kind).toBe('load-failed');

    await flush();
    expect(unhandled).not.toHaveBeenCalled();
  });

  it('gives Reading Studio empty data with an error, without an unhandled rejection', async () => {
    const data = await loadReadingData('N5');
    expect(data.grammarData).toEqual({});
    expect(data.vocabData).toEqual({});
    expect(data.allowedKanji).toBe('');
    expect(data.error?.kind).toBe('load-failed');

    await flush();
    expect(unhandled).not.toHaveBeenCalled();
  });
});

describe('fetchLessonList against a working source', () => {
  afterEach(() => setContentSource(new StaticContentSource()));

  it('returns the source lessons tagged with the request key', async () => {
    setContentSource(new InMemoryContentSource({ N4: { vocab: { 1: [], 2: [] } } }));
    expect(await fetchLessonList('N4', 'vocab', 'N4:vocab:3')).toEqual({
      key: 'N4:vocab:3',
      lessons: [
        { lesson: 1, count: 0 },
        { lesson: 2, count: 0 },
      ],
      error: null,
    });
  });
});

describe('retry after a failed chunk', () => {
  afterEach(() => setContentSource(new StaticContentSource()));

  it('a second request (what Retry triggers) recovers once the chunk loads', async () => {
    let attempts = 0;
    const flaky = () => {
      attempts += 1;
      return attempts === 1
        ? Promise.reject(new TypeError('Failed to fetch dynamically imported module'))
        : Promise.resolve({ default: { 1: [], 2: [] } });
    };
    setContentSource(new StaticContentSource({ '../../data/n3/kanji.json': flaky }));

    const failed = await fetchLessonList('N3', 'kanji', 'N3:kanji:0');
    expect(failed.error?.kind).toBe('load-failed');

    const retried = await fetchLessonList('N3', 'kanji', 'N3:kanji:1');
    expect(retried.error).toBeNull();
    expect(retried.lessons.map((l) => l.lesson)).toEqual([1, 2]);
    expect(attempts).toBe(2);
  });
});

describe('resolveReadingData', () => {
  it('hides data loaded for another level', async () => {
    setContentSource(new InMemoryContentSource({}));
    const n5 = await loadReadingData('N5');
    setContentSource(new StaticContentSource());
    expect(resolveReadingData({ level: 'N5', data: n5 }, 'N5')).toBe(n5);
    expect(resolveReadingData({ level: 'N5', data: n5 }, 'N4')).toEqual({
      grammarData: {},
      vocabData: {},
      allowedKanji: '',
      error: null,
    });
  });
});
