import { useCallback, useState } from 'react';
import { useAiCacheStore, useAiUiStore } from '../../store/useAiStore';
import { LevelType, KanjiItem } from '../../types/japanese';
import { generateKanjiMnemonic } from '../../services/ai/registry';
import { useContentQuery } from '../useContentQuery';
import { useLessonList } from '../useLessonList';

export function useKanji(activeLevel: LevelType, activeLesson: number) {
  const [searchQuery, setSearchQuery] = useState('');

  const {
    totalLessons,
    lessonCounts,
    error: lessonsError,
    retry: retryLessons,
  } = useLessonList(activeLevel, 'kanji');

  const {
    items: currentContent,
    loading,
    error: contentError,
    retry: retryContent,
  } = useContentQuery<KanjiItem>(activeLevel, 'kanji', activeLesson);

  // Either failure drives the section's error panel; its retry re-runs both.
  const error = contentError ?? lessonsError;
  const retry = useCallback(() => {
    retryContent();
    retryLessons();
  }, [retryContent, retryLessons]);

  const filteredContent = searchQuery.trim()
    ? currentContent.filter(
        (item) =>
          item.kanji.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.meaning.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.onyomi || []).join(' ').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.kunyomi || []).join(' ').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : currentContent;

  // AI State - the store is keyed by each item's own uid; see useGrammar.ts.
  const { aiKanjiMnemonics, setKanjiMnemonic } = useAiCacheStore();
  const { loadingKanjiAi, setLoadingKanjiAi, handleApiError } = useAiUiStore();

  const handleGenerateKanjiMnemonic = async (kanjiItem: KanjiItem) => {
    const uid = kanjiItem.uid;
    setLoadingKanjiAi(uid, true);
    try {
      const text = await generateKanjiMnemonic({ kanji: kanjiItem, level: activeLevel });
      if (text) {
        setKanjiMnemonic(uid, text);
      }
    } catch (error) {
      handleApiError(error);
    } finally {
      setLoadingKanjiAi(uid, false);
    }
  };

  return {
    searchQuery,
    setSearchQuery,
    totalLessons,
    lessonCounts,
    filteredContent,
    currentContent,
    loading,
    error,
    retry,
    handleGenerateKanjiMnemonic,
    aiKanjiMnemonics,
    loadingKanjiAi,
  };
}
