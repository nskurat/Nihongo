import { useCallback, useState } from 'react';
import { useAiArtifacts } from '../useAiArtifacts';
import { LevelType, GrammarItem } from '../../types/japanese';
import { generateGrammarExamples, generateGrammarNuance } from '../../services/ai/registry';
import { getTagMeta } from '../../utils/tags';
import { useContentQuery } from '../useContentQuery';
import { useLessonList } from '../useLessonList';

export function useGrammar(activeLevel: LevelType, activeLesson: number) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDetailItem, setSelectedDetailItem] = useState<GrammarItem | null>(null);

  const {
    totalLessons,
    lessonCounts,
    error: lessonsError,
    retry: retryLessons,
  } = useLessonList(activeLevel, 'grammar');

  const {
    items: currentContent,
    loading,
    error: contentError,
    retry: retryContent,
  } = useContentQuery<GrammarItem>(activeLevel, 'grammar', activeLesson);

  // Either failure drives the section's error panel; its retry re-runs both.
  const error = contentError ?? lessonsError;
  const retry = useCallback(() => {
    retryContent();
    retryLessons();
  }, [retryContent, retryLessons]);

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

  // AI results, cached per item uid (store/useAiStore.ts). Examples accumulate: each
  // press asks for new sentences and appends them.
  const examples = useAiArtifacts('grammar-examples');
  const nuance = useAiArtifacts('grammar-nuance');

  const handleGenerateExamples = (grammar: GrammarItem) =>
    examples.generate(grammar.uid, async (current = []) => [
      ...current,
      ...(await generateGrammarExamples({ grammar, level: activeLevel, previous: current })),
    ]);

  const handleExplainNuance = (grammar: GrammarItem) =>
    nuance.generate(grammar.uid, () =>
      generateGrammarNuance({ grammar, level: activeLevel, lessonItems: currentContent })
    );

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
    examples,
    nuance,
  };
}
