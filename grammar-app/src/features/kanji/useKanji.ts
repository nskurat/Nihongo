import { useEffect, useMemo, useState } from 'react';
import { useAiCacheStore, useAiUiStore } from '../../store/useAiStore';
import { LevelType, KanjiItem } from '../../types/japanese';
import { generateKanjiMnemonic } from '../../services/ai/registry';
import { useContentQuery } from '../useContentQuery';
import { contentRepository } from '../../services/content/StaticContentSource';
import { LessonSummary } from '../../services/content/ContentSource';

export function useKanji(activeLevel: LevelType, activeLesson: number) {
  const [searchQuery, setSearchQuery] = useState('');
  const [lessons, setLessons] = useState<LessonSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    contentRepository.listLessons(activeLevel, 'kanji').then((summaries) => {
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
  } = useContentQuery<KanjiItem>(activeLevel, 'kanji', activeLesson);

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
