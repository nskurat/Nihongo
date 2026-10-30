import { describe, it, expect } from 'vitest';
import { LESSON_RANGES, clampLessonForLevel, fromLegacyLesson } from '../levels';

describe('lesson numbering', () => {
  it('starts every level at lesson 1', () => {
    for (const range of Object.values(LESSON_RANGES)) {
      expect(range.min).toBe(1);
      expect(range.default).toBe(1);
    }
  });

  it('maps legacy N4 lessons 26-50 onto 1-25', () => {
    expect(fromLegacyLesson('N4', 26)).toBe(1);
    expect(fromLegacyLesson('N4', 50)).toBe(25);
  });

  it('leaves current lessons and other levels alone', () => {
    expect(fromLegacyLesson('N4', 12)).toBe(12);
    expect(fromLegacyLesson('N5', 30)).toBe(30);
    expect(clampLessonForLevel('N5', fromLegacyLesson('N5', 30))).toBe(1);
  });
});
