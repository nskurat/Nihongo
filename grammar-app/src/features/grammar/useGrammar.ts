import { useEffect, useMemo, useState } from 'react';
import { useAiCacheStore, useAiUiStore } from '../../store/useAiStore';
import { LevelType, GrammarItem } from '../../types/japanese';
import { generateGrammarExamples, generateGrammarNuance } from '../../services/ai/registry';
import { getTagMeta } from '../../utils/tags';
import { useContentQuery } from '../useContentQuery';
import { contentRepository } from '../../services/content/StaticContentSource';
import { LessonSummary } from '../../services/content/ContentSource';

export function useGrammar(activeLevel: LevelType, activeLesson: number) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDetailItem, setSelectedDetailItem] = useState<GrammarItem | null>(null);
  const [lessons, setLessons] = useState<LessonSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    contentRepository.listLessons(activeLevel, 'grammar').then((summaries) => {
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
  } = useContentQuery<GrammarItem>(activeLevel, 'grammar', activeLesson);

  // Filter grammar points if search is active
  const filteredContent = searchQuery.trim()
    ? currentContent.filter(item => {
        const q = searchQuery.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.meaning.toLowerCase().includes(q) ||
          item.structure.toLowerCase().includes(q) ||
          (item.tags || []).some(tagId => {
            const meta = getTagMeta(tagId);
            return tagId.includes(q) || (meta?.label.toLowerCase().includes(q) ?? false);
          })
        );
      })
    : currentContent;

  // AI State - the store is keyed by each item's own uid, which is globally
  // unique, so it's read directly with no remapping.
  const { generatedExamples, aiExplanations, addExamples, setExplanation } = useAiCacheStore();
  const { loadingExamples, loadingExplanations, setLoadingExamples, setLoadingExplanations, handleApiError } = useAiUiStore();

  const handleGenerateExamples = async (grammar: GrammarItem) => {
    const uid = grammar.uid;
    setLoadingExamples(uid, true);
    try {
      const newExamples = await generateGrammarExamples({ grammar, level: activeLevel });
      if (newExamples && newExamples.length > 0) {
        addExamples(uid, newExamples);
      }
    } catch (error) {
      handleApiError(error);
    } finally {
      setLoadingExamples(uid, false);
    }
  };

  const handleExplainNuance = async (grammar: GrammarItem) => {
    const uid = grammar.uid;
    setLoadingExplanations(uid, true);
    try {
      const text = await generateGrammarNuance({ grammar, level: activeLevel });
      if (text) {
        setExplanation(uid, text);
      }
    } catch (error) {
      handleApiError(error);
    } finally {
      setLoadingExplanations(uid, false);
    }
  };

  return {
    searchQuery,
    setSearchQuery,
    selectedDetailItem,
    setSelectedDetailItem,
    totalLessons,
    lessonCounts,
    filteredContent,
    currentContent,
    loading,
    error,
    retry,
    // AI functions
    handleGenerateExamples,
    handleExplainNuance,
    // AI state
    generatedExamples,
    aiExplanations,
    loadingExamples,
    loadingExplanations,
  };
}
