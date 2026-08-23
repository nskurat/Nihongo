import { useState } from 'react';
import { useAiCacheStore, useAiUiStore } from '../../store/useAiStore';
import { LevelType, GrammarItem } from '../../types/japanese';
import { generateGrammarExamples, generateGrammarNuance } from '../../services/ai/registry';

import grammarN3 from '../../data/n3/grammar.json';
import grammarN4 from '../../data/n4/grammar.json';

const grammarData: Record<LevelType, Record<number, GrammarItem[]>> = {
  N3: grammarN3 as unknown as Record<number, GrammarItem[]>,
  N4: grammarN4 as unknown as Record<number, GrammarItem[]>,
};

export function useGrammar(activeLevel: LevelType, activeLesson: number) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDetailItem, setSelectedDetailItem] = useState<GrammarItem | null>(null);

  // Data
  const currentLevelData = grammarData[activeLevel] || {};
  const totalLessons = Object.keys(currentLevelData).map(Number).sort((a, b) => a - b);
  const currentContent = currentLevelData[activeLesson] || [];

  // Filter grammar points if search is active
  const filteredContent = searchQuery.trim()
    ? currentContent.filter(
        (item) =>
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.meaning.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.structure.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : currentContent;

  // AI State
  const { generatedExamples, aiExplanations, addExamples, setExplanation } = useAiCacheStore();
  const { loadingExamples, loadingExplanations, setLoadingExamples, setLoadingExplanations, handleApiError } = useAiUiStore();

  const handleGenerateExamples = async (grammar: GrammarItem) => {
    setLoadingExamples(grammar.id, true);
    try {
      const newExamples = await generateGrammarExamples({ grammar, level: activeLevel });
      if (newExamples && newExamples.length > 0) {
        addExamples(grammar.id, newExamples);
      }
    } catch (error) {
      handleApiError(error);
    } finally {
      setLoadingExamples(grammar.id, false);
    }
  };

  const handleExplainNuance = async (grammar: GrammarItem) => {
    setLoadingExplanations(grammar.id, true);
    try {
      const text = await generateGrammarNuance({ grammar, level: activeLevel });
      if (text) {
        setExplanation(grammar.id, text);
      }
    } catch (error) {
      handleApiError(error);
    } finally {
      setLoadingExplanations(grammar.id, false);
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
