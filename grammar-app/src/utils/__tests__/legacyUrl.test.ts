import { describe, it, expect } from 'vitest';
import { parseLegacyUrl } from '../legacyUrl';

describe('parseLegacyUrl', () => {
  it('parses a query-string URL', () => {
    expect(parseLegacyUrl('?level=n4&section=vocab&lesson=30', '')).toEqual({
      level: 'N4',
      section: 'vocab',
      lesson: 30,
    });
  });

  it('parses a hash-only URL', () => {
    expect(parseLegacyUrl('', '#kanji')).toEqual({
      level: 'N3',
      section: 'kanji',
      lesson: 1,
    });
  });

  it('sanitizes a garbage URL to safe defaults', () => {
    expect(parseLegacyUrl('?level=xx&section=nonsense&lesson=9999', '')).toEqual({
      level: 'N3',
      section: 'grammar',
      lesson: 1,
    });
  });

  it('returns null for an empty URL', () => {
    expect(parseLegacyUrl('', '')).toBeNull();
  });

  it('prefers the query param section over the hash when both are present', () => {
    expect(parseLegacyUrl('?section=reading', '#kanji')).toEqual({
      level: 'N3',
      section: 'reading',
      lesson: 1,
    });
  });

  it('clamps a lesson out of range for the level', () => {
    expect(parseLegacyUrl('?level=n4&lesson=1', '')).toEqual({
      level: 'N4',
      section: 'grammar',
      lesson: 26,
    });
  });
});
