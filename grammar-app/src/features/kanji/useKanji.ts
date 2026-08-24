import { useState } from 'react';
import { useAiCacheStore, useAiUiStore } from '../../store/useAiStore';
import { LevelType, KanjiItem } from '../../types/japanese';
import { generateKanjiMnemonic } from '../../services/ai/registry';

import kanjiN3 from '../../data/n3/kanji.json';
import kanjiN4 from '../../data/n4/kanji.json';
import kanjiN5 from '../../data/n5/kanji.json';

const kanjiData: Record<LevelType, Record<number, KanjiItem[]>> = {
  N5: kanjiN5 as unknown as Record<number, KanjiItem[]>,
  N4: kanjiN4 as unknown as Record<number, KanjiItem[]>,
  N3: kanjiN3 as unknown as Record<number, KanjiItem[]>,
};

export function useKanji(activeLevel: LevelType, activeLesson: number) {
  const [searchQuery, setSearchQuery] = useState('');

  // Data
  const currentLevelData = kanjiData[activeLevel] || {};
  const totalLessons = Object.keys(currentLevelData).map(Number).sort((a, b) => a - b);
  const currentContent = currentLevelData[activeLesson] || [];

  const filteredContent = searchQuery.trim()
    ? currentContent.filter(
        (item) =>
          item.kanji.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.meaning.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.onyomi || []).join(' ').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.kunyomi || []).join(' ').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : currentContent;

  // AI State
  const { aiKanjiMnemonics, setKanjiMnemonic } = useAiCacheStore();
  const { loadingKanjiAi, setLoadingKanjiAi, handleApiError } = useAiUiStore();

  const handleGenerateKanjiMnemonic = async (kanjiItem: KanjiItem) => {
    setLoadingKanjiAi(kanjiItem.id, true);
    try {
      const text = await generateKanjiMnemonic({ kanji: kanjiItem, level: activeLevel });
      if (text) {
        setKanjiMnemonic(kanjiItem.id, text);
      }
    } catch (error) {
      handleApiError(error);
    } finally {
      setLoadingKanjiAi(kanjiItem.id, false);
    }
  };

  return {
    searchQuery,
    setSearchQuery,
    totalLessons,
    currentLevelData,
    filteredContent,
    currentContent,
    handleGenerateKanjiMnemonic,
    aiKanjiMnemonics,
    loadingKanjiAi,
  };
}
