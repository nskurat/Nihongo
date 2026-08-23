import { describe, it, expect } from 'vitest';
import { buildReadingPracticePrompt } from '../promptBuilder';

describe('promptBuilder', () => {
  it('should build a general reading practice prompt when no lesson is specified', () => {
    const prompt = buildReadingPracticePrompt({
      level: 'N3',
      topic: 'Japanese Festivals',
    });

    expect(prompt).toContain('JLPT N3 General Reading Practice');
    expect(prompt).toContain('Japanese Festivals');
    expect(prompt).toContain('Furigana Notation');
    expect(prompt).toContain('5 multiple-choice questions');
  });

  it('should inject specific grammar patterns and vocabulary when lesson is specified', () => {
    const prompt = buildReadingPracticePrompt({
      level: 'N4',
      lesson: 27,
      topic: 'Travel & Scenery',
      grammarList: [
        { title: 'Potential verbs', meaning: 'can do' },
        { title: '見えます / 聞こえます', meaning: 'spontaneous sight/sound' },
      ],
      vocabList: [
        { word: '景色', reading: 'けしき', meaning: 'scenery' },
        { word: '富士山', reading: 'ふじさん', meaning: 'Mt. Fuji' },
      ],
    });

    expect(prompt).toContain('TARGET LESSON: Minna no Nihongo Lesson 27 (JLPT N4)');
    expect(prompt).toContain('Potential verbs');
    expect(prompt).toContain('見えます / 聞こえます');
    expect(prompt).toContain('景色 (けしき: scenery)');
    expect(prompt).toContain('Travel & Scenery');
  });
});
