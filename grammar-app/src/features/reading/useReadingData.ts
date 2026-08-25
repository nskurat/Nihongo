import { useEffect, useState } from 'react';
import { LevelType, GrammarItem, VocabItem } from '../../types/japanese';
import { StudyItem } from '../../types/content';
import { contentRepository } from '../../services/content/StaticContentSource';

interface ReadingContentData {
  grammarData: Record<number, GrammarItem[]>;
  vocabData: Record<number, VocabItem[]>;
}

const EMPTY: ReadingContentData = { grammarData: {}, vocabData: {} };

async function loadLevelData<T extends StudyItem>(
  level: LevelType,
  section: 'grammar' | 'vocab'
): Promise<Record<number, T[]>> {
  const lessons = await contentRepository.listLessons(level, section);
  const entries = await Promise.all(
    lessons.map(async ({ lesson }) => [lesson, await contentRepository.getItems<T>(level, section, lesson)] as const)
  );
  return Object.fromEntries(entries);
}

/**
 * Lesson-keyed grammar and vocab data for the given level, so Reading Studio
 * can target its AI-generated passages at real lesson content instead of
 * falling back to generic practice. Loaded through the content repository
 * (one lazy chunk per level+section, shared with useGrammar/useVocab's cache)
 * rather than a static per-level import, and only while Reading Studio is
 * actually mounted.
 */
export function useReadingData(level: LevelType): ReadingContentData {
  const [data, setData] = useState<ReadingContentData>(EMPTY);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      loadLevelData<GrammarItem>(level, 'grammar'),
      loadLevelData<VocabItem>(level, 'vocab'),
    ]).then(([grammarData, vocabData]) => {
      if (!cancelled) setData({ grammarData, vocabData });
    });

    return () => {
      cancelled = true;
    };
  }, [level]);

  return data;
}
