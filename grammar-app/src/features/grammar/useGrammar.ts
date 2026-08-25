import { useMemo, useState } from 'react';
import { useAiCacheStore, useAiUiStore } from '../../store/useAiStore';
import { LevelType, GrammarItem } from '../../types/japanese';
import { generateGrammarExamples, generateGrammarNuance } from '../../services/ai/registry';
import { getTagMeta } from '../../utils/tags';
import { buildUid, remapCacheToIds } from '../../utils/uid';

import grammarN3 from '../../data/n3/grammar.json';
import grammarN4 from '../../data/n4/grammar.json';
import grammarN5 from '../../data/n5/grammar.json';

function stampItems(
  raw: Record<number, GrammarItem[]>,
  level: LevelType
): Record<number, GrammarItem[]> {
  const stamped: Record<number, GrammarItem[]> = {};
  for (const [lesson, items] of Object.entries(raw)) {
    stamped[Number(lesson)] = items.map(item => ({
      ...item,
      level,
      lesson: Number(lesson),
    }));
  }
  return stamped;
}

const grammarData: Record<LevelType, Record<number, GrammarItem[]>> = {
  N5: stampItems(grammarN5 as unknown as Record<number, GrammarItem[]>, 'N5'),
  N4: stampItems(grammarN4 as unknown as Record<number, GrammarItem[]>, 'N4'),
  N3: stampItems(grammarN3 as unknown as Record<number, GrammarItem[]>, 'N3'),
};

export function useGrammar(activeLevel: LevelType, activeLesson: number) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDetailItem, setSelectedDetailItem] = useState<GrammarItem | null>(null);

  // Data
  // No `|| {}` fallback: grammarData is a Record<LevelType, ...> populated for all
  // three levels, so this is always defined - a fallback here would materialize a
  // fresh object every render and defeat the memoization below.
  const currentLevelData = grammarData[activeLevel];
  const totalLessons = Object.keys(currentLevelData).map(Number).sort((a, b) => a - b);
  // Memoized so its reference is stable across renders when level/lesson don't change -
  // the `|| []` fallback would otherwise be a fresh array every render, defeating the
  // useMemo hooks below that depend on it.
  const currentContent = useMemo(
    () => currentLevelData[activeLesson] || [],
    [currentLevelData, activeLesson]
  );

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

  // AI State - the store is keyed by a level/lesson-scoped uid (see utils/uid.ts),
  // because grammar item ids collide across levels (N5 and N3 both start at "1-1").
  // These raw stores are remapped back to id-keyed lookups below so the UI, which
  // reads by item.id, can stay untouched and still never see another level's data.
  const { generatedExamples: generatedExamplesByUid, aiExplanations: aiExplanationsByUid, addExamples, setExplanation } = useAiCacheStore();
  const { loadingExamples: loadingExamplesByUid, loadingExplanations: loadingExplanationsByUid, setLoadingExamples, setLoadingExplanations, handleApiError } = useAiUiStore();

  const generatedExamples = useMemo(
    () => remapCacheToIds(currentContent, activeLevel, 'grammar', activeLesson, generatedExamplesByUid),
    [currentContent, activeLevel, activeLesson, generatedExamplesByUid]
  );
  const aiExplanations = useMemo(
    () => remapCacheToIds(currentContent, activeLevel, 'grammar', activeLesson, aiExplanationsByUid),
    [currentContent, activeLevel, activeLesson, aiExplanationsByUid]
  );
  const loadingExamples = useMemo(
    () => remapCacheToIds(currentContent, activeLevel, 'grammar', activeLesson, loadingExamplesByUid),
    [currentContent, activeLevel, activeLesson, loadingExamplesByUid]
  );
  const loadingExplanations = useMemo(
    () => remapCacheToIds(currentContent, activeLevel, 'grammar', activeLesson, loadingExplanationsByUid),
    [currentContent, activeLevel, activeLesson, loadingExplanationsByUid]
  );

  const uidFor = (grammar: GrammarItem) =>
    buildUid(activeLevel, 'grammar', activeLesson, currentContent.indexOf(grammar) + 1);

  const handleGenerateExamples = async (grammar: GrammarItem) => {
    const uid = uidFor(grammar);
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
    const uid = uidFor(grammar);
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
    currentLevelData,
    filteredContent,
    currentContent,
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
