import { describe, it, expect } from 'vitest';
import { LESSON_RANGES, clampLessonForLevel, fromLegacyLesson, parseLevel, isSectionAvailable } from '../levels';

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

describe('N2 and N1', () => {
  it('parses N2 and N1 and keeps their lessons in range', () => {
    expect(parseLevel('n2')).toBe('N2');
    expect(parseLevel('n1')).toBe('N1');
    expect(clampLessonForLevel('N2', 26)).toBe(26);
    expect(clampLessonForLevel('N2', 27)).toBe(1);
    expect(clampLessonForLevel('N1', 32)).toBe(32);
  });

  it('offers a section exactly where its content exists', () => {
    expect(isSectionAvailable('N2', 'grammar')).toBe(true);
    expect(isSectionAvailable('N2', 'vocab')).toBe(true);
    expect(isSectionAvailable('N2', 'kanji')).toBe(true);
    expect(isSectionAvailable('N3', 'kanji')).toBe(true);
    expect(isSectionAvailable('N1', 'grammar')).toBe(true);
    expect(isSectionAvailable('N1', 'vocab')).toBe(true);
    expect(isSectionAvailable('N1', 'kanji')).toBe(true);
  });

  it('offers Reading Practice wherever grammar and vocab both exist', () => {
    expect(isSectionAvailable('N2', 'reading')).toBe(true);
    expect(isSectionAvailable('N3', 'reading')).toBe(true);
    expect(isSectionAvailable('N1', 'reading')).toBe(true);
  });
});
