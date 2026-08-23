import { useState } from 'react';
import { useAiCacheStore, useAiUiStore } from '../../store/useAiStore';
import { LevelType, VocabItem } from '../../types/japanese';
import { generateVocabHelp } from '../../services/ai/registry';

import vocabN3 from '../../data/n3/vocab.json';
import vocabN4 from '../../data/n4/vocab.json';

const vocabData: Record<LevelType, Record<number, VocabItem[]>> = {
  N3: vocabN3 as unknown as Record<number, VocabItem[]>,
  N4: vocabN4 as unknown as Record<number, VocabItem[]>,
};

export function useVocab(activeLevel: LevelType, activeLesson: number) {
  const [searchQuery, setSearchQuery] = useState('');

  // Data
  const currentLevelData = vocabData[activeLevel] || {};
  const totalLessons = Object.keys(currentLevelData).map(Number).sort((a, b) => a - b);
  const currentContent = currentLevelData[activeLesson] || [];

  const filteredContent = searchQuery.trim()
    ? currentContent.filter(
        (item) =>
          item.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.reading.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.meaning.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : currentContent;

  // AI State
  const { aiVocabNotes, setVocabNote } = useAiCacheStore();
  const { loadingVocabAi, setLoadingVocabAi, handleApiError } = useAiUiStore();

  const handleGenerateVocabHelp = async (vocab: VocabItem) => {
    setLoadingVocabAi(vocab.id, true);
    try {
      const text = await generateVocabHelp({ vocab, level: activeLevel });
      if (text) {
        setVocabNote(vocab.id, text);
      }
    } catch (error) {
      handleApiError(error);
    } finally {
      setLoadingVocabAi(vocab.id, false);
    }
  };

  return {
    searchQuery,
    setSearchQuery,
    totalLessons,
    currentLevelData,
    filteredContent,
    currentContent,
    handleGenerateVocabHelp,
    aiVocabNotes,
    loadingVocabAi,
  };
}
