import { useCallback, useState } from 'react';
import { useAiCacheStore, useAiUiStore } from '../../store/useAiStore';
import { LevelType, VocabItem } from '../../types/japanese';
import { generateVocabHelp } from '../../services/ai/registry';
import { useContentQuery } from '../useContentQuery';
import { useLessonList } from '../useLessonList';

export function useVocab(activeLevel: LevelType, activeLesson: number) {
  const [searchQuery, setSearchQuery] = useState('');

  const {
    totalLessons,
    lessonCounts,
    error: lessonsError,
    retry: retryLessons,
  } = useLessonList(activeLevel, 'vocab');

  const {
    items: currentContent,
    loading,
    error: contentError,
    retry: retryContent,
  } = useContentQuery<VocabItem>(activeLevel, 'vocab', activeLesson);

  // Either failure drives the section's error panel; its retry re-runs both.
  const error = contentError ?? lessonsError;
  const retry = useCallback(() => {
    retryContent();
    retryLessons();
  }, [retryContent, retryLessons]);

  const filteredContent = searchQuery.trim()
    ? currentContent.filter(
        (item) =>
          item.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.reading.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.meaning.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : currentContent;

  // AI State - the store is keyed by each item's own uid; see useGrammar.ts.
  const { aiVocabNotes, setVocabNote } = useAiCacheStore();
  const { loadingVocabAi, setLoadingVocabAi, handleApiError } = useAiUiStore();

  const handleGenerateVocabHelp = async (vocab: VocabItem) => {
    const uid = vocab.uid;
    setLoadingVocabAi(uid, true);
    try {
      const text = await generateVocabHelp({ vocab, level: activeLevel });
      if (text) {
        setVocabNote(uid, text);
      }
    } catch (error) {
      handleApiError(error);
    } finally {
      setLoadingVocabAi(uid, false);
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
    handleGenerateVocabHelp,
    aiVocabNotes,
    loadingVocabAi,
  };
}
