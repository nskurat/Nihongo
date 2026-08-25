import { useMemo, useState } from 'react';
import { useAiCacheStore, useAiUiStore } from '../../store/useAiStore';
import { LevelType, VocabItem } from '../../types/japanese';
import { generateVocabHelp } from '../../services/ai/registry';
import { remapCacheToIds } from '../../utils/uid';

import vocabN3 from '../../data/n3/vocab.json';
import vocabN4 from '../../data/n4/vocab.json';
import vocabN5 from '../../data/n5/vocab.json';

const vocabData: Record<LevelType, Record<number, VocabItem[]>> = {
  N5: vocabN5 as unknown as Record<number, VocabItem[]>,
  N4: vocabN4 as unknown as Record<number, VocabItem[]>,
  N3: vocabN3 as unknown as Record<number, VocabItem[]>,
};

export function useVocab(activeLevel: LevelType, activeLesson: number) {
  const [searchQuery, setSearchQuery] = useState('');

  // Data
  // No `|| {}` fallback - see useGrammar.ts for why.
  const currentLevelData = vocabData[activeLevel];
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
          item.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.reading.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.meaning.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : currentContent;

  // AI State - keyed by a level/lesson-scoped uid; see useGrammar.ts for why.
  const { aiVocabNotes: aiVocabNotesByUid, setVocabNote } = useAiCacheStore();
  const { loadingVocabAi: loadingVocabAiByUid, setLoadingVocabAi, handleApiError } = useAiUiStore();

  const aiVocabNotes = useMemo(
    () => remapCacheToIds(currentContent, aiVocabNotesByUid),
    [currentContent, aiVocabNotesByUid]
  );
  const loadingVocabAi = useMemo(
    () => remapCacheToIds(currentContent, loadingVocabAiByUid),
    [currentContent, loadingVocabAiByUid]
  );

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
    currentLevelData,
    filteredContent,
    currentContent,
    handleGenerateVocabHelp,
    aiVocabNotes,
    loadingVocabAi,
  };
}
