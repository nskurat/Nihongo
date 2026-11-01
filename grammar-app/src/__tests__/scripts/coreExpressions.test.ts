import { describe, expect, it } from 'vitest';
import { applyCoreExpressions, CORE_EXPRESSIONS, type LessonFile } from '../../../../scripts/lib/coreExpressions';

const lessonOf = (word: string) => CORE_EXPRESSIONS.find((e) => e.word === word)?.lesson;

describe('applyCoreExpressions', () => {
  it('places each expression at the end of its N5 lesson without shifting existing uids', () => {
    const file: LessonFile = { 1: [{ uid: 'n5-vocab-1-1', word: 'わたし' }], 3: [], 7: [] };
    const { added, moved } = applyCoreExpressions(file);
    expect(added).toHaveLength(CORE_EXPRESSIONS.length);
    expect(moved).toEqual({});
    expect(file[1][0]).toEqual({ uid: 'n5-vocab-1-1', word: 'わたし' });
    expect(file[1][1]).toMatchObject({ uid: 'n5-vocab-1-2', lesson: 1, word: 'おはようございます' });
    expect(file[3].map((r) => r.word)).toEqual(['日本語', 'ごめんなさい']);
    expect(file[7].every((r) => r.lesson === 7)).toBe(true);
  });

  it('moves rows out of the former lesson 26, reporting old → new uids, and removes it', () => {
    const file: LessonFile = {
      1: [],
      26: [
        { uid: 'n5-vocab-26-1', word: '日本語' },
        { uid: 'n5-vocab-26-2', word: 'おはようございます' },
      ],
    };
    const { moved, added } = applyCoreExpressions(file);
    expect(moved).toEqual({ 'n5-vocab-26-1': 'n5-vocab-3-1', 'n5-vocab-26-2': 'n5-vocab-1-1' });
    expect(added).not.toContain('日本語');
    expect(file).not.toHaveProperty('26');
  });

  it('is idempotent', () => {
    const file: LessonFile = {};
    applyCoreExpressions(file);
    const once = JSON.stringify(file);
    expect(applyCoreExpressions(file)).toEqual({ moved: {}, added: [] });
    expect(JSON.stringify(file)).toBe(once);
  });

  it('uses only lessons the textbook sequence teaches them in, each with an example', () => {
    expect(lessonOf('こんにちは')).toBe(1);
    expect(lessonOf('日本語')).toBe(3);
    expect(lessonOf('いただきます')).toBe(7);
    for (const e of CORE_EXPRESSIONS) {
      expect([1, 3, 7]).toContain(e.lesson);
      expect(e.exampleJp).toContain(e.word);
    }
  });
});
