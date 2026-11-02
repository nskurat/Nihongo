import { describe, expect, it } from 'vitest';
import { applyGlossFixes, type GlossReport, type LessonFile } from '../../../../scripts/lib/glossFixes';

const fix = { uid: 'n3-vocab-1-1', word: '仕舞い', from: 'sisters', to: 'end, close' };

describe('applyGlossFixes', () => {
  it('fixes the gloss once and is idempotent', () => {
    const file: LessonFile = { 1: [{ uid: 'n3-vocab-1-1', word: '仕舞い', meaning: 'sisters' }] };
    const report: GlossReport = { changed: [], skipped: [] };
    applyGlossFixes(file, [fix], report);
    applyGlossFixes(file, [fix], report);
    expect(file[1][0].meaning).toBe('end, close');
    expect(report.changed).toHaveLength(1);
    expect(report.skipped).toEqual([]);
  });

  it('never touches a row whose word or gloss is not the expected one', () => {
    const file: LessonFile = { 1: [{ uid: 'n3-vocab-1-1', word: '姉妹', meaning: 'sisters' }] };
    const report: GlossReport = { changed: [], skipped: [] };
    applyGlossFixes(file, [fix], report);
    expect(file[1][0].meaning).toBe('sisters');
    expect(report.skipped[0]).toMatch(/expected 仕舞い/);
  });

  it('replaces an example only when it is the old one', () => {
    const example = { fromJp: 'old', jp: 'new', en: 'New.' };
    const file: LessonFile = { 1: [{ uid: 'n3-vocab-1-1', word: '仕舞い', meaning: 'sisters', exampleJp: 'old', exampleEn: 'Old.' }] };
    applyGlossFixes(file, [{ ...fix, example }], { changed: [], skipped: [] });
    expect(file[1][0]).toMatchObject({ exampleJp: 'new', exampleEn: 'New.' });
  });
});
