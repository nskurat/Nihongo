import { LevelType, GrammarItem, VocabItem } from '../../types/japanese';

import grammarN3 from '../../data/n3/grammar.json';
import grammarN4 from '../../data/n4/grammar.json';
import grammarN5 from '../../data/n5/grammar.json';
import vocabN3 from '../../data/n3/vocab.json';
import vocabN4 from '../../data/n4/vocab.json';
import vocabN5 from '../../data/n5/vocab.json';

const grammarByLevel: Record<LevelType, Record<number, GrammarItem[]>> = {
  N5: grammarN5 as unknown as Record<number, GrammarItem[]>,
  N4: grammarN4 as unknown as Record<number, GrammarItem[]>,
  N3: grammarN3 as unknown as Record<number, GrammarItem[]>,
};

const vocabByLevel: Record<LevelType, Record<number, VocabItem[]>> = {
  N5: vocabN5 as unknown as Record<number, VocabItem[]>,
  N4: vocabN4 as unknown as Record<number, VocabItem[]>,
  N3: vocabN3 as unknown as Record<number, VocabItem[]>,
};

/**
 * Lesson-keyed grammar and vocab data for the given level, so Reading Studio
 * can target its AI-generated passages at real lesson content instead of
 * falling back to generic practice. Superseded by the shared content
 * repository in Phase 2.
 */
export function useReadingData(level: LevelType) {
  return {
    grammarData: grammarByLevel[level] || {},
    vocabData: vocabByLevel[level] || {},
  };
}
