import { useCallback, useState } from 'react';
import { useAiArtifacts } from '../useAiArtifacts';
import { LevelType, KanjiItem } from '../../types/japanese';
import { generateKanjiMnemonic } from '../../services/ai/registry';
import { useContentQuery } from '../useContentQuery';
import { useLessonList } from '../useLessonList';

export function useKanji(activeLevel: LevelType, activeLesson: number) {
  const [searchQuery, setSearchQuery] = useState('');

  const {
    totalLessons,
    lessonCounts,
    error: lessonsError,
    retry: retryLessons,
  } = useLessonList(activeLevel, 'kanji');

  const {
    items: currentContent,
    loading,
    error: contentError,
    retry: retryContent,
  } = useContentQuery<KanjiItem>(activeLevel, 'kanji', activeLesson);

  // Either failure drives the section's error panel; its retry re-runs both.
  const error = contentError ?? lessonsError;
  const retry = useCallback(() => {
    retryContent();
    retryLessons();
  }, [retryContent, retryLessons]);

  const filteredContent = searchQuery.trim()
    ? currentContent.filter(
        (item) =>
          item.kanji.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.meaning.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.onyomi || []).join(' ').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.kunyomi || []).join(' ').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : currentContent;

  const mnemonics = useAiArtifacts('kanji-mnemonic');
  const handleGenerateKanjiMnemonic = (kanjiItem: KanjiItem) =>
    mnemonics.generate(kanjiItem.uid, () => generateKanjiMnemonic({ kanji: kanjiItem, level: activeLevel }));

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
    mnemonics,
  };
}
