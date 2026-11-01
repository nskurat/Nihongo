import { describe, expect, it } from 'vitest';
import { mirrorNotes, noteReading, NOTE_READINGS } from '../../../../scripts/lib/readingNotes';

describe('mirrorNotes', () => {
  it('adds the note in kana, keeping the word’s spacing and note position', () => {
    expect(mirrorNotes('迷う [道に〜]', 'まよう')).toBe('まよう [みちに〜]');
    expect(mirrorNotes('つける [名前を〜]', 'つける [名前を〜]')).toBe('つける [なまえを〜]');
    expect(mirrorNotes('[お]花見', '[お]はなみ')).toBe('[お]はなみ');
    expect(mirrorNotes('[どうも]ありがとう[ございます]', 'ありがとう')).toBe('[どうも]ありがとう[ございます]');
    expect(mirrorNotes('事実[〜関係]', 'じじつ[〜かんけい]')).toBe('じじつ[〜かんけい]');
  });

  it('is idempotent and leaves words without notes alone', () => {
    const once = mirrorNotes('取る [湿気を〜]', 'とる')!;
    expect(mirrorNotes('取る [湿気を〜]', once)).toBe(once);
    expect(mirrorNotes('学生', 'がくせい')).toBeNull();
  });

  it('reports what it cannot resolve instead of guessing', () => {
    expect(mirrorNotes('走る [未知の〜]', 'はしる')).toBeNull();
    expect(noteReading('な')).toBe('な');
  });

  it('every table reading is kana (digits and 〜 / allowed)', () => {
    for (const r of Object.values(NOTE_READINGS)) expect(r).toMatch(/^[ぁ-ゖァ-ヺー〜/0-9]+$/);
  });
});
