import { GrammarItem, KanjiItem, VocabItem } from '../types/japanese';
import { setContentSource, StaticContentSource } from '../services/content/StaticContentSource';
import { InMemoryContentSource } from '../services/content/__tests__/InMemoryContentSource';

/**
 * A tiny content set (15 rows) served through InMemoryContentSource. Tests use
 * this, never the real src/data JSON, so a content edit can't break a UI test.
 */
const g = (uid: string, title: string, meaning: string, structure: string): GrammarItem => {
  const [level, , lesson] = uid.split('-');
  return {
    uid,
    level: level.toUpperCase() as GrammarItem['level'],
    section: 'grammar',
    lesson: Number(lesson),
    title,
    meaning,
    structure,
    explanation: `${title} explained.`,
  };
};

export const N5_GRAMMAR = {
  1: [
    g('n5-grammar-1-1', 'Noun です', 'to be (polite)', 'N + です'),
    g('n5-grammar-1-2', 'Noun じゃありません', 'is not (polite)', 'N + じゃありません'),
  ],
  2: [g('n5-grammar-2-1', 'Question か', 'question marker', 'Sentence + か')],
};

const N5_VOCAB: Record<number, VocabItem[]> = {
  1: [
    { uid: 'n5-vocab-1-1', level: 'N5', section: 'vocab', lesson: 1, word: '学生', reading: 'がくせい', meaning: 'student' },
    { uid: 'n5-vocab-1-2', level: 'N5', section: 'vocab', lesson: 1, word: '先生', reading: 'せんせい', meaning: 'teacher' },
  ],
};

const N5_KANJI: Record<number, KanjiItem[]> = {
  1: [
    {
      uid: 'n5-kanji-1-1',
      level: 'N5',
      section: 'kanji',
      lesson: 1,
      kanji: '日',
      meaning: 'day, sun',
      onyomi: ['ニチ'],
      kunyomi: ['ひ'],
      strokes: 4,
      compounds: [{ word: '日本', reading: 'にほん', meaning: 'Japan' }],
    },
    {
      uid: 'n5-kanji-1-2',
      level: 'N5',
      section: 'kanji',
      lesson: 1,
      kanji: '本',
      meaning: 'book, origin',
      strokes: 5,
      compounds: [{ word: '本気', reading: null, meaning: null }],
    },
  ],
};

export const FIXTURE_CONTENT = {
  N5: { grammar: N5_GRAMMAR, vocab: N5_VOCAB, kanji: N5_KANJI },
  N4: {
    grammar: {
      1: [g('n4-grammar-1-1', 'Verb たことがある', 'have done before', 'V-た + ことがある')],
      24: [g('n4-grammar-24-1', 'Verb ば', 'if (conditional)', 'V-ば')],
      25: [g('n4-grammar-25-1', 'Verb させる', 'make / let do', 'V-させる')],
    },
  },
  N3: { grammar: { 24: [g('n3-grammar-24-1', 'ものの', 'although', 'V + ものの')] } },
  N1: { grammar: { 30: [g('n1-grammar-30-1', 'をもって', 'by means of', 'N + をもって')] } },
};

/** Serve FIXTURE_CONTENT (or `content`) for the rest of the test. */
export function serveFixtureContent(content = FIXTURE_CONTENT): void {
  setContentSource(new InMemoryContentSource(content));
}

export function restoreContentSource(): void {
  setContentSource(new StaticContentSource());
}
