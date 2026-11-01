import { useEffect, useState } from 'react';
import { LevelType, GrammarItem, VocabItem, KanjiItem } from '../../types/japanese';
import { StudyItem } from '../../types/content';
import { contentRepository } from '../../services/content/StaticContentSource';
import { ContentError } from '../../services/content/ContentSource';
import { toContentError } from '../useLessonList';

interface ReadingContentData {
  grammarData: Record<number, GrammarItem[]>;
  vocabData: Record<number, VocabItem[]>;
  /** Kanji ceiling for the reading prompt; empty when the level has none. */
  allowedKanji: string;
  /** Set when a chunk failed to load; the data fields are then empty. */
  error: ContentError | null;
}

const EMPTY: ReadingContentData = { grammarData: {}, vocabData: {}, allowedKanji: '', error: null };

interface ReadingDataState {
  level: LevelType | null;
  data: ReadingContentData;
}

/**
 * Levels whose reading prompt carries an explicit kanji list: the level's own
 * kanji plus every lower level's. Only N5/N4, where the list is short and the
 * model's own sense of "basic kanji" is least reliable.
 */
const KANJI_CEILING_LEVELS: Partial<Record<LevelType, LevelType[]>> = {
  N5: ['N5'],
  N4: ['N5', 'N4'],
};

async function loadKanjiCeiling(level: LevelType): Promise<string> {
  const levels = KANJI_CEILING_LEVELS[level] ?? [];
  const perLevel = await Promise.all(
    levels.map(async (l) => Object.values(await loadLevelData<KanjiItem>(l, 'kanji')).flat())
  );
  return perLevel
    .flat()
    .map((k) => k.kanji)
    .join('');
}

async function loadLevelData<T extends StudyItem>(
  level: LevelType,
  section: 'grammar' | 'vocab' | 'kanji'
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
 *
 * Loads everything Reading Studio needs for `level`. Never rejects: a failed
 * chunk resolves to empty data carrying `error`, so nothing leaks as an
 * unhandled rejection.
 */
export function loadReadingData(level: LevelType): Promise<ReadingContentData> {
  return Promise.all([
    loadLevelData<GrammarItem>(level, 'grammar'),
    loadLevelData<VocabItem>(level, 'vocab'),
    loadKanjiCeiling(level),
  ]).then(
    ([grammarData, vocabData, allowedKanji]) => ({ grammarData, vocabData, allowedKanji, error: null }),
    (err: unknown) => ({ ...EMPTY, error: toContentError(err) })
  );
}

/**
 * Reads `state` for `level`. Data written for another level is treated as
 * not loaded yet, so a level switch never shows the previous level's lessons.
 */
export function resolveReadingData(state: ReadingDataState, level: LevelType): ReadingContentData {
  return state.level === level ? state.data : EMPTY;
}

export function useReadingData(level: LevelType): ReadingContentData {
  const [state, setState] = useState<ReadingDataState>({ level: null, data: EMPTY });

  useEffect(() => {
    let cancelled = false;
    loadReadingData(level).then((data) => {
      if (!cancelled) setState({ level, data });
    });
    return () => {
      cancelled = true;
    };
  }, [level]);

  return resolveReadingData(state, level);
}
