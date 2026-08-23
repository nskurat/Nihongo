import { describe, it, expect } from 'vitest';
import { buildReadingPracticePrompt } from '../promptBuilder';

describe('AI Reading Prompt Builder', () => {
  it('should build a general N4 prompt with default values', () => {
    const prompt = buildReadingPracticePrompt({
      level: 'N4',
      topic: 'Japanese Tea Ceremony',
    });

    expect(prompt).toContain('TARGET LEVEL: JLPT N4 General Reading Practice');
    expect(prompt).toContain('THEME / TOPIC: "Japanese Tea Ceremony"');
    expect(prompt).toContain('"questions": [');
    expect(prompt).toContain('"explanationJp":');
    expect(prompt).toContain('"explanationEn":');
  });

  it('should build a lesson-targeted N3 prompt injecting grammar and vocabulary constraints', () => {
    const mockGrammar = [
      { id: '1', title: '〜てたまらない', meaning: 'cannot help but...', structure: 'V-te + tamaranai', explanation: '...' },
    ];
    const mockVocab = [
      { id: '1', word: '絶望', reading: 'ぜつぼう', meaning: 'despair' },
    ];

    const prompt = buildReadingPracticePrompt({
      level: 'N3',
      lesson: 12,
      topic: 'Overcoming Challenges',
      grammarList: mockGrammar,
      vocabList: mockVocab,
    });

    expect(prompt).toContain('TARGET LESSON: Minna no Nihongo Lesson 12 (JLPT N3)');
    expect(prompt).toContain('〜てたまらない');
    expect(prompt).toContain('絶望 (ぜつぼう: despair)');
  });
});
