import { describe, it, expect } from 'vitest';
import {
  filterLibrary,
  migrateLegacyAnswers,
  normalizeActiveReadings,
  normalizeProgress,
  openStoryLabel,
  parseReadingView,
  planOpenStory,
  pruneProgress,
  readingViewSearch,
  resolveStoryId,
  scoreStory,
  withReading,
  withStoryAnswer,
  withoutStoryAnswers,
} from '../readingSession';
import { ActiveReadings, ReadingHistoryEntry, ReadingPracticeData } from '../../../types/ai';

const passage = (title: string, titleEn = '', questionCount = 1): ReadingPracticeData => ({
  title,
  titleEn,
  japaneseText: `${title}の文章です。`,
  questions: Array.from({ length: questionCount }, (_, i) => ({
    id: i + 1,
    question: '？',
    options: ['a', 'b'],
    correctIndex: 0,
    explanationJp: '',
  })),
});

const entry = (level: ReadingHistoryEntry['level'], title: string, extra: Partial<ReadingHistoryEntry> = {}): ReadingHistoryEntry => ({
  id: `id_${level}_${title}`,
  timestamp: '2026-10-30T00:00:00Z',
  level,
  lesson: null,
  topic: '',
  data: passage(title),
  ...extra,
});

const slot = (level: ReadingHistoryEntry['level'], title: string, storyId = `id_${level}_${title}`) => ({
  storyId,
  level,
  lesson: null,
  topic: '',
  data: passage(title),
});

describe('normalizeActiveReadings', () => {
  it('maps a legacy bare passage onto the level and story id of the matching library entry', () => {
    const history = [entry('N4', '公園'), entry('N3', '駅', { lesson: 4, topic: 'Travel' })];
    const result = normalizeActiveReadings(passage('駅'), history);
    expect(Object.keys(result)).toEqual(['N3']);
    expect(result.N3).toMatchObject({ storyId: 'id_N3_駅', level: 'N3', lesson: 4, topic: 'Travel' });
  });

  it('drops a legacy passage whose level cannot be determined instead of guessing', () => {
    expect(normalizeActiveReadings(passage('孤児'), [entry('N4', '公園')])).toEqual({});
  });

  it('keeps valid per-level slots, discards malformed ones and no longer carries answers', () => {
    const raw = {
      N5: { level: 'N5', lesson: 2, topic: 'x', data: passage('朝'), answers: { 1: 0 } },
      N4: { data: { title: 'no text' } },
      N9: { data: passage('bogus') },
    };
    const result = normalizeActiveReadings(raw, []);
    expect(Object.keys(result)).toEqual(['N5']);
    expect(result.N5).not.toHaveProperty('answers');
  });

  it('keeps a stored story id and resolves a missing one from the library', () => {
    const history = [entry('N3', '駅')];
    const result = normalizeActiveReadings(
      { N3: { data: passage('駅') }, N5: { storyId: 'keep_me', data: passage('朝') } },
      history
    );
    expect(result.N3?.storyId).toBe('id_N3_駅');
    expect(result.N5?.storyId).toBe('keep_me');
  });

  it('uses the map key as the level, not a mismatched inner field', () => {
    const result = normalizeActiveReadings({ N3: { level: 'N1', data: passage('駅') } }, []);
    expect(result.N3?.level).toBe('N3');
    expect(result.N3?.lesson).toBeNull();
  });

  it('returns an empty map for null or junk', () => {
    expect(normalizeActiveReadings(null, [])).toEqual({});
    expect(normalizeActiveReadings('text', [])).toEqual({});
  });
});

describe('resolveStoryId', () => {
  it('prefers the same level, then any level, then a deterministic local id', () => {
    const history = [entry('N4', '駅'), entry('N3', '駅')];
    expect(resolveStoryId('N3', '駅', history)).toBe('id_N3_駅');
    expect(resolveStoryId('N5', '駅', history)).toBe('id_N4_駅');
    expect(resolveStoryId('N5', '朝', history)).toBe('local_N5_朝');
  });
});

describe('progress (answers per story)', () => {
  it('normalizeProgress keeps valid answers and drops junk or empty stories', () => {
    expect(normalizeProgress({ a: { 1: 0, x: 'y' }, b: {}, c: 'junk' })).toEqual({ a: { 1: 0 } });
    expect(normalizeProgress(null)).toEqual({});
    expect(normalizeProgress([1, 2])).toEqual({});
  });

  it('migrates legacy per-level answers onto the current passage story id', () => {
    const history = [entry('N3', '駅')];
    const rawActive = {
      N3: { level: 'N3', data: passage('駅'), answers: { 1: 0, 2: 1 } },
      N5: { level: 'N5', data: passage('朝'), answers: {} },
    };
    expect(migrateLegacyAnswers(rawActive, {}, history)).toEqual({ id_N3_駅: { 1: 0, 2: 1 } });
  });

  it('does not overwrite answers already stored for that story, and ignores a bare legacy passage', () => {
    const history = [entry('N3', '駅')];
    const rawActive = { N3: { data: passage('駅'), answers: { 1: 1 } } };
    const progress = { id_N3_駅: { 1: 0 } };
    expect(migrateLegacyAnswers(rawActive, progress, history)).toBe(progress);
    expect(migrateLegacyAnswers(passage('駅'), {}, history)).toEqual({});
  });

  it('records the first answer per question per story and ignores repeats', () => {
    let p = withStoryAnswer({}, 's1', 1, 0);
    p = withStoryAnswer(p, 's2', 1, 1);
    expect(p).toEqual({ s1: { 1: 0 }, s2: { 1: 1 } });
    expect(withStoryAnswer(p, 's1', 1, 1)).toBe(p);
  });

  it('start over clears only that story, and is a no-op for a story without answers', () => {
    const p = { s1: { 1: 0 }, s2: { 1: 1 } };
    expect(withoutStoryAnswers(p, 's1')).toEqual({ s2: { 1: 1 } });
    expect(withoutStoryAnswers(p, 'nope')).toBe(p);
  });

  it('prunes answers of stories neither in the library nor current on any level', () => {
    const history = [entry('N3', '駅')];
    const readings: ActiveReadings = { N5: slot('N5', '朝', 'deleted_but_current') };
    const p = { id_N3_駅: { 1: 0 }, deleted_but_current: { 1: 0 }, gone: { 1: 1 } };
    expect(pruneProgress(p, history, readings)).toEqual({ id_N3_駅: { 1: 0 }, deleted_but_current: { 1: 0 } });
    const kept = { id_N3_駅: { 1: 0 } };
    expect(pruneProgress(kept, history, {})).toBe(kept);
  });

  it('scores a story against its questions', () => {
    const data = passage('駅', '', 5);
    expect(scoreStory(data, { 1: 0, 2: 1, 3: 0 })).toEqual({ answered: 3, correct: 2, total: 5 });
    expect(scoreStory(data, {})).toEqual({ answered: 0, correct: 0, total: 5 });
  });
});

describe('withReading', () => {
  it('sets a passage on its own level only', () => {
    const start: ActiveReadings = { N3: slot('N3', '駅') };
    const next = withReading(start, slot('N4', '公園'));
    expect(next.N3).toBe(start.N3);
    expect(next.N4).toMatchObject({ storyId: 'id_N4_公園', level: 'N4' });
  });
});

describe('planOpenStory (library -> Studio)', () => {
  // Regression: on N3, opening an N5 story from the library must make it N5's current
  // passage AND navigate to N5 - the caller applies both in one transition.
  it('opening a story from another level targets that level and its route', () => {
    const readings: ActiveReadings = { N3: slot('N3', '駅'), N5: slot('N5', 'いぬ') };
    const plan = planOpenStory(readings, entry('N5', 'ねこ'), 'N3');
    expect(plan.path).toBe('/n5/reading');
    expect(plan.readings.N5?.storyId).toBe('id_N5_ねこ');
    expect(plan.readings.N5?.data.title).toBe('ねこ');
    expect(plan.readings.N3).toBe(readings.N3);
  });

  it('opening a story of the header level stays on the route', () => {
    const plan = planOpenStory({ N3: slot('N3', '駅') }, entry('N3', '古い'), 'N3');
    expect(plan.path).toBeNull();
    expect(plan.readings.N3?.storyId).toBe('id_N3_古い');
  });

  it('reopening the current story changes nothing', () => {
    const readings: ActiveReadings = { N3: slot('N3', '駅') };
    expect(planOpenStory(readings, entry('N3', '駅'), 'N3').readings).toBe(readings);
  });

  it('labels the action with the level switch when there is one', () => {
    expect(openStoryLabel('N3', 'N3')).toBe('Practice in Studio');
    expect(openStoryLabel('N5', 'N3')).toBe('Open in N5 →');
  });
});

describe('Reading view in the URL', () => {
  it('defaults to the Studio with the filter following the header level', () => {
    expect(parseReadingView('', 'N3')).toEqual({ view: 'studio', filter: 'N3' });
    expect(parseReadingView('?view=library', 'N3')).toEqual({ view: 'library', filter: 'N3' });
  });

  it('reads an explicit filter, case-insensitively, and ignores junk', () => {
    expect(parseReadingView('?view=library&filter=all', 'N3')).toEqual({ view: 'library', filter: 'ALL' });
    expect(parseReadingView(new URLSearchParams('view=library&filter=n5'), 'N3').filter).toBe('N5');
    expect(parseReadingView('?view=library&filter=n9', 'N3').filter).toBe('N3');
    expect(parseReadingView('?filter=all', 'N3')).toEqual({ view: 'studio', filter: 'N3' });
  });

  it('writes the shortest query and round-trips', () => {
    expect(readingViewSearch('studio', 'ALL', 'N3')).toBe('');
    expect(readingViewSearch('library', 'N3', 'N3')).toBe('?view=library');
    expect(readingViewSearch('library', 'ALL', 'N3')).toBe('?view=library&filter=all');
    expect(parseReadingView(readingViewSearch('library', 'N5', 'N3'), 'N3')).toEqual({ view: 'library', filter: 'N5' });
  });
});

describe('filterLibrary', () => {
  const history = [
    entry('N3', '駅', { topic: 'Travel' }),
    entry('N4', '公園', { data: passage('公園', 'Morning in the Park') }),
    entry('N3', '料理'),
  ];

  it('filters by level', () => {
    expect(filterLibrary(history, 'N3', '').map((h) => h.data.title)).toEqual(['駅', '料理']);
    expect(filterLibrary(history, 'ALL', '')).toHaveLength(3);
    expect(filterLibrary(history, 'N5', '')).toEqual([]);
  });

  it('matches title, English title or topic case-insensitively', () => {
    expect(filterLibrary(history, 'ALL', 'travel').map((h) => h.data.title)).toEqual(['駅']);
    expect(filterLibrary(history, 'ALL', 'PARK').map((h) => h.data.title)).toEqual(['公園']);
    expect(filterLibrary(history, 'N3', 'park')).toEqual([]);
  });
});
