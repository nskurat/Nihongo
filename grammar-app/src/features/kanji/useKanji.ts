import { useMemo, useState } from 'react';
import { useAiCacheStore, useAiUiStore } from '../../store/useAiStore';
import { LevelType, KanjiItem } from '../../types/japanese';
import { generateKanjiMnemonic } from '../../services/ai/registry';
import { remapCacheToIds } from '../../utils/uid';

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
  // No `|| {}` fallback - see useGrammar.ts for why.
  const currentLevelData = kanjiData[activeLevel];
  const totalLessons = Object.keys(currentLevelData).map(Number).sort((a, b) => a - b);
  // Memoized so its reference is stable across renders when level/lesson don't change -
  // see useGrammar.ts for why.
  const currentContent = useMemo(
    () => currentLevelData[activeLesson] || [],
    [currentLevelData, activeLesson]
  );

  const filteredContent = searchQuery.trim()
    ? currentContent.filter(
        (item) =>
          item.kanji.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.meaning.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.onyomi || []).join(' ').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.kunyomi || []).join(' ').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : currentContent;

  // AI State - keyed by a level/lesson-scoped uid; see useGrammar.ts for why.
  const { aiKanjiMnemonics: aiKanjiMnemonicsByUid, setKanjiMnemonic } = useAiCacheStore();
  const { loadingKanjiAi: loadingKanjiAiByUid, setLoadingKanjiAi, handleApiError } = useAiUiStore();

  const aiKanjiMnemonics = useMemo(
    () => remapCacheToIds(currentContent, aiKanjiMnemonicsByUid),
    [currentContent, aiKanjiMnemonicsByUid]
  );
  const loadingKanjiAi = useMemo(
    () => remapCacheToIds(currentContent, loadingKanjiAiByUid),
    [currentContent, loadingKanjiAiByUid]
  );

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
    currentLevelData,
    filteredContent,
    currentContent,
    handleGenerateKanjiMnemonic,
    aiKanjiMnemonics,
    loadingKanjiAi,
  };
}
