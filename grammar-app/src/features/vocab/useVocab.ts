import { useEffect, useMemo, useState } from 'react';
import { useAiCacheStore, useAiUiStore } from '../../store/useAiStore';
import { LevelType, VocabItem } from '../../types/japanese';
import { generateVocabHelp } from '../../services/ai/registry';
import { useContentQuery } from '../useContentQuery';
import { contentRepository } from '../../services/content/StaticContentSource';
import { LessonSummary } from '../../services/content/ContentSource';

export function useVocab(activeLevel: LevelType, activeLesson: number) {
  const [searchQuery, setSearchQuery] = useState('');
  const [lessons, setLessons] = useState<LessonSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    contentRepository.listLessons(activeLevel, 'vocab').then((summaries) => {
      if (!cancelled) setLessons(summaries);
    });
    return () => {
      cancelled = true;
    };
  }, [activeLevel]);

  const totalLessons = useMemo(() => lessons.map((l) => l.lesson), [lessons]);
  const lessonCounts = useMemo(
    () => Object.fromEntries(lessons.map((l) => [l.lesson, l.count])),
    [lessons]
  );

  const {
    items: currentContent,
    loading,
    error,
    retry,
  } = useContentQuery<VocabItem>(activeLevel, 'vocab', activeLesson);

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
