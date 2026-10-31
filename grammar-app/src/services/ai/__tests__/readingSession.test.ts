import { describe, it, expect } from 'vitest';
import { filterLibrary, normalizeActiveReadings, withAnswer, withReading } from '../readingSession';
import { ActiveReadings, ReadingHistoryEntry, ReadingPracticeData } from '../../../types/ai';

const passage = (title: string, titleEn = ''): ReadingPracticeData => ({
  title,
  titleEn,
  japaneseText: `${title}の文章です。`,
  questions: [{ id: 1, question: '？', options: ['a', 'b'], correctIndex: 0, explanationJp: '' }],
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

describe('normalizeActiveReadings', () => {
  it('maps a legacy bare passage onto the level of the matching library entry', () => {
    const history = [entry('N4', '公園'), entry('N3', '駅', { lesson: 4, topic: 'Travel' })];
    const result = normalizeActiveReadings(passage('駅'), history);
    expect(Object.keys(result)).toEqual(['N3']);
    expect(result.N3).toMatchObject({ level: 'N3', lesson: 4, topic: 'Travel', answers: {} });
  });

  it('drops a legacy passage whose level cannot be determined instead of guessing', () => {
    expect(normalizeActiveReadings(passage('孤児'), [entry('N4', '公園')])).toEqual({});
  });

  it('keeps valid per-level slots and discards malformed ones', () => {
    const raw = {
      N5: { level: 'N5', lesson: 2, topic: 'x', data: passage('朝'), answers: { 1: 0, bad: 'x' } },
      N4: { data: { title: 'no text' } },
      N9: { data: passage('bogus') },
    };
    const result = normalizeActiveReadings(raw, []);
    expect(Object.keys(result)).toEqual(['N5']);
    expect(result.N5?.answers).toEqual({ 1: 0 });
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

describe('withReading / withAnswer', () => {
  it('sets a passage on its own level only, with fresh answers', () => {
    const start: ActiveReadings = {
      N3: { level: 'N3', lesson: null, topic: '', data: passage('駅'), answers: { 1: 1 } },
    };
    const next = withReading(start, { level: 'N4', lesson: 5, topic: 't', data: passage('公園') });
    expect(next.N3).toBe(start.N3);
    expect(next.N4).toMatchObject({ level: 'N4', lesson: 5, answers: {} });
  });

  it('replacing a level passage resets that level answers', () => {
    const start: ActiveReadings = {
      N3: { level: 'N3', lesson: null, topic: '', data: passage('駅'), answers: { 1: 1 } },
    };
    expect(withReading(start, { level: 'N3', lesson: null, topic: '', data: passage('新') }).N3?.answers).toEqual({});
  });

  it('records the first answer per question per level and ignores repeats', () => {
    let state: ActiveReadings = withReading({}, { level: 'N3', lesson: null, topic: '', data: passage('駅') });
    state = withAnswer(state, 'N3', 1, 0);
    expect(state.N3?.answers).toEqual({ 1: 0 });
    const same = withAnswer(state, 'N3', 1, 1);
    expect(same).toBe(state);
  });

  it('is a no-op for a level without a passage', () => {
    const state: ActiveReadings = {};
    expect(withAnswer(state, 'N5', 1, 0)).toBe(state);
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
