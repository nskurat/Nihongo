import { describe, expect, it } from 'vitest';
import { applyCoreExpressions, CORE_EXPRESSIONS, type LessonFile } from '../../../../scripts/lib/coreExpressions';

describe('applyCoreExpressions (N5 lesson 26)', () => {
  it('appends every expression with stable positional uids and leaves other lessons alone', () => {
    const file: LessonFile = { 25: [{ uid: 'n5-vocab-25-1', word: '考えます' }] };
    const added = applyCoreExpressions(file);
    expect(added).toHaveLength(CORE_EXPRESSIONS.length);
    expect(file[26][0]).toMatchObject({ uid: 'n5-vocab-26-1', level: 'N5', section: 'vocab', lesson: 26, word: '日本語', reading: 'にほんご' });
    expect(file[26].map((r) => r.uid)).toEqual(CORE_EXPRESSIONS.map((_, i) => `n5-vocab-26-${i + 1}`));
    expect(file[25]).toEqual([{ uid: 'n5-vocab-25-1', word: '考えます' }]);
  });

  it('is idempotent', () => {
    const file: LessonFile = {};
    applyCoreExpressions(file);
    const once = JSON.stringify(file);
    expect(applyCoreExpressions(file)).toEqual([]);
    expect(JSON.stringify(file)).toBe(once);
  });

  it('gives every row an example sentence that uses the expression', () => {
    for (const e of CORE_EXPRESSIONS) expect(e.exampleJp).toContain(e.word);
  });
});
