import { describe, it, expect } from 'vitest';
import { LESSON_RANGES, clampLessonForLevel, fromLegacyLesson, parseLevel, isSectionAvailable, canonicalLessonPath } from '../levels';

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

describe('canonicalLessonPath', () => {
  it('leaves a canonical path alone', () => {
    expect(canonicalLessonPath('n2', 'kanji', '26')).toBe('/n2/kanji/26');
    expect(canonicalLessonPath('n5', 'reading', undefined)).toBe('/n5/reading');
  });

  it('lowercases, clamps and maps legacy lessons', () => {
    expect(canonicalLessonPath('N1', 'Vocab', '33')).toBe('/n1/vocab/1');
    expect(canonicalLessonPath('n4', 'grammar', '50')).toBe('/n4/grammar/25');
    expect(canonicalLessonPath('n3', 'grammar', 'abc')).toBe('/n3/grammar/1');
  });

  it('reads an unknown level as N3 and an unknown section as grammar', () => {
    expect(canonicalLessonPath('n9', 'kanji', '2')).toBe('/n3/kanji/2');
    expect(canonicalLessonPath('n5', 'flashcards', '2')).toBe('/n5/grammar/2');
  });
});
