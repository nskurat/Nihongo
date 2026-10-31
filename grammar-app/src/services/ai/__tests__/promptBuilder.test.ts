import { describe, it, expect } from 'vitest';
import {
  buildReadingPracticePrompt,
  buildAnswerKey,
  formatTargetVocab,
  MAX_TARGET_GRAMMAR,
  MAX_TARGET_VOCAB,
} from '../promptBuilder';
import {
  FURIGANA_NOTATION_RULES,
  READING_LEVEL_SPECS,
  READING_PRACTICE_SCHEMA_TEMPLATE,
} from '../prompts';
import { parseFuriganaTokens } from '../readingParser';
import { GrammarItem, LevelType, VocabItem } from '../../../types/japanese';

const LEVELS: LevelType[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

/** Deterministic LCG so sampled targets and answer keys are reproducible. */
function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

function grammar(level: LevelType, lesson: number, n: number): GrammarItem[] {
  return Array.from({ length: n }, (_, i) => ({
    uid: `${level.toLowerCase()}-grammar-${lesson}-${i + 1}`,
    level,
    section: 'grammar' as const,
    lesson,
    title: `〜パターン${i + 1}`,
    meaning: `Meaning ${i + 1}. Second sentence that should be dropped.`,
    structure: 'V + ...',
    explanation: '...',
  }));
}

function vocab(word: string, reading: string, meaning: string): VocabItem {
  return { uid: `n3-vocab-1-${word}`, level: 'N3', section: 'vocab', lesson: 1, word, reading, meaning };
}

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
      {
        uid: 'n3-grammar-12-1',
        level: 'N3' as const,
        section: 'grammar' as const,
        lesson: 12,
        title: '〜てたまらない',
        meaning: 'cannot help but...',
        structure: 'V-te + tamaranai',
        explanation: '...',
      },
    ];
    const mockVocab = [vocab('絶望', 'ぜつぼう', 'despair')];

    const prompt = buildReadingPracticePrompt({
      level: 'N3',
      lesson: 12,
      topic: 'Overcoming Challenges',
      grammarList: mockGrammar,
      vocabList: mockVocab,
    });

    expect(prompt).toContain('TARGET LESSON: Lesson 12 (JLPT N3)');
    expect(prompt).toContain('〜てたまらない');
    expect(prompt).toContain('絶望 (ぜつぼう: despair)');
    expect(prompt).toContain('use at least 1 of these');
  });

  it('keeps every JSON key the parser and UI depend on', () => {
    for (const key of [
      'title',
      'titleEn',
      'japaneseText',
      'englishTranslation',
      'vocabulary',
      'word',
      'reading',
      'meaning',
      'grammarUsed',
      'pattern',
      'note',
      'questions',
      'id',
      'question',
      'options',
      'correctIndex',
      'explanationJp',
      'explanationEn',
    ]) {
      expect(READING_PRACTICE_SCHEMA_TEMPLATE).toContain(`"${key}":`);
    }
  });
});

describe('Level-specific reading rules', () => {
  it.each(LEVELS)('%s states its own length range, genres and a five-question plan', (level) => {
    const spec = READING_LEVEL_SPECS[level];
    const prompt = buildReadingPracticePrompt({ level, rng: seeded() });

    expect(prompt).toContain(`${spec.minChars}–${spec.maxChars} Japanese characters`);
    expect(prompt).toContain(spec.genres);
    expect(spec.questionPlan).toHaveLength(5);
    for (let i = 1; i <= 5; i++) expect(prompt).toContain(`Q${i}. `);
    expect(prompt).toContain('Exactly 5 questions');
    expect(prompt).toContain('Exactly 4 options');
  });

  it('passages get longer with each level', () => {
    const lengths = LEVELS.map((l) => READING_LEVEL_SPECS[l].minChars);
    expect([...lengths].sort((a, b) => a - b)).toEqual(lengths);
    expect(READING_LEVEL_SPECS.N5.maxChars).toBeLessThanOrEqual(300);
    expect(READING_LEVEL_SPECS.N1.minChars).toBeGreaterThanOrEqual(700);
  });

  it('N5 uses polite style; N2 and N1 a written である style', () => {
    expect(READING_LEVEL_SPECS.N5.register).toContain('です/ます');
    expect(READING_LEVEL_SPECS.N2.register).toContain('である');
    expect(READING_LEVEL_SPECS.N1.register).toContain('である');
  });

  it.each(['N5', 'N4', 'N3'] as LevelType[])('%s puts furigana on every kanji word', (level) => {
    const prompt = buildReadingPracticePrompt({ level, rng: seeded() });
    expect(prompt).toContain('add furigana to EVERY kanji word');
  });

  it.each(['N2', 'N1'] as LevelType[])('%s keeps common kanji bare and glosses only harder words', (level) => {
    const prompt = buildReadingPracticePrompt({ level, rng: seeded() });
    expect(prompt).not.toContain('EVERY kanji word');
    expect(prompt).toContain('beyond N3');
  });

  it('question types follow the JLPT progression', () => {
    const plan = (l: LevelType) => READING_LEVEL_SPECS[l].questionPlan.join('\n');
    expect(plan('N5')).toContain('情報検索');
    expect(plan('N3')).toContain('指示語');
    expect(plan('N2')).toContain('主張理解');
    expect(plan('N1')).toContain('主張理解');
    // The final question is always about the passage as a whole.
    for (const l of LEVELS) {
      expect(READING_LEVEL_SPECS[l].questionPlan[4]).toMatch(/whole|central claim|Main idea|主張/i);
    }
  });

  it('asks for unlabelled options, passage-quoting explanations and no common-sense answers', () => {
    const prompt = buildReadingPracticePrompt({ level: 'N4', rng: seeded() });
    expect(prompt).not.toContain('(A, B, C, D)');
    expect(prompt).toContain('no "A.", "1)" or other labels');
    expect(prompt).toContain('quote the decisive sentence of the passage in 「」');
    expect(prompt).toContain('never by letter or number');
    expect(prompt).toContain('general knowledge or common sense');
    expect(prompt).toContain('never ASCII double quotes');
  });
});

describe('Answer key', () => {
  it('uses every position 0–3 across the five questions', () => {
    for (let seed = 1; seed < 50; seed++) {
      const key = buildAnswerKey(seeded(seed));
      expect(key).toHaveLength(5);
      expect(new Set(key)).toEqual(new Set([0, 1, 2, 3]));
    }
  });

  it('is written into the prompt', () => {
    const key = buildAnswerKey(seeded(7));
    // The builder draws the answer key after sampling targets; with no lesson
    // there is no sampling, so the same seed yields the same key.
    const prompt = buildReadingPracticePrompt({ level: 'N5', rng: seeded(7) });
    expect(prompt).toContain(`MUST be ${key.join(', ')} in that order`);
  });
});

describe('Furigana notation contract', () => {
  it('every example in the instructions parses with no stray brackets', () => {
    const examples = FURIGANA_NOTATION_RULES.match(/[^\s:,.]+\[[^\]]+\][^\s,.]*/g) ?? [];
    expect(examples.length).toBeGreaterThanOrEqual(8);
    for (const ex of examples) {
      const tokens = parseFuriganaTokens(ex);
      const text = tokens.map((t) => (t.type === 'text' ? t.content : '')).join('');
      expect(text, ex).not.toMatch(/[[\]]/);
      expect(tokens.some((t) => t.type === 'ruby'), ex).toBe(true);
    }
  });

  it('keeps okurigana outside the ruby base', () => {
    expect(parseFuriganaTokens('食[た]べ物[もの]')).toEqual([
      { type: 'ruby', base: '食', ruby: 'た' },
      { type: 'text', content: 'べ' },
      { type: 'ruby', base: '物', ruby: 'もの' },
    ]);
  });
});

describe('Lesson targets', () => {
  it(`lists at most ${MAX_TARGET_GRAMMAR} grammar points, in lesson order`, () => {
    const prompt = buildReadingPracticePrompt({
      level: 'N4',
      lesson: 10,
      grammarList: grammar('N4', 10, 11),
      rng: seeded(3),
    });
    const listed = [...prompt.matchAll(/〜パターン(\d+)/g)].map((m) => Number(m[1]));
    expect(listed).toHaveLength(MAX_TARGET_GRAMMAR);
    expect([...listed].sort((a, b) => a - b)).toEqual(listed);
    expect(prompt).not.toContain('Second sentence');
  });

  it(`lists at most ${MAX_TARGET_VOCAB} words`, () => {
    const many = Array.from({ length: 40 }, (_, i) => vocab(`語${i}`, `ご${i}`, `word ${i}`));
    const prompt = buildReadingPracticePrompt({ level: 'N3', lesson: 1, vocabList: many, rng: seeded() });
    expect(prompt.match(/語\d+ \(/g)).toHaveLength(MAX_TARGET_VOCAB);
    expect(prompt).toContain('use at least 5 of these words');
  });

  it('moves bracketed usage notes out of the headword', () => {
    expect(formatTargetVocab(vocab('迷う [道に〜]', 'まよう', "lose [one's way]"))).toBe(
      "迷う (まよう: lose (one's way); as in 道に〜)"
    );
    expect(formatTargetVocab(vocab('[お]花見', '[お]はなみ', 'cherry-blossom viewing'))).toBe(
      '花見 (はなみ: cherry-blossom viewing)'
    );
    expect(formatTargetVocab(vocab('立派 [な]', 'りっぱ [な]', 'wonderful'))).toBe('立派 (りっぱ: wonderful)');
  });

  it('drops phrases, affixes and paired entries', () => {
    expect(formatTargetVocab(vocab('確か、〜たと思います。', 'たしか', 'I believe'))).toBeNull();
    expect(formatTargetVocab(vocab('〜過ぎ', 'すぎ', 'past'))).toBeNull();
    expect(formatTargetVocab(vocab('もう／まだ', 'もう／まだ', 'already / not yet'))).toBeNull();
  });

  it('early N5 lessons name the verb forms not taught yet', () => {
    const prompt = buildReadingPracticePrompt({ level: 'N5', lesson: 5, rng: seeded() });
    expect(prompt).toContain('N5 Lessons 1–5 only');
    expect(prompt).toContain('て-form (Lesson 14)');
    expect(prompt).toContain('plain style');
  });

  it('late N5 lessons have no not-yet-taught list; N4 maps to Minna 26–50', () => {
    expect(buildReadingPracticePrompt({ level: 'N5', lesson: 25, rng: seeded() })).not.toContain('Not taught yet');
    expect(buildReadingPracticePrompt({ level: 'N4', lesson: 10, rng: seeded() })).toContain(
      'Minna no Nihongo Lessons 26–35'
    );
  });

  it('adds a de-duplicated kanji ceiling only when one is given', () => {
    const withKanji = buildReadingPracticePrompt({ level: 'N5', allowedKanji: '日月日火', rng: seeded() });
    expect(withKanji).toContain('Kanji ceiling');
    expect(withKanji).toContain('  日月火\n');
    expect(buildReadingPracticePrompt({ level: 'N3', rng: seeded() })).not.toContain('Kanji ceiling');
  });

});
