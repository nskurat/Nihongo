import { useCallback, useState } from 'react';
import { useAiArtifacts } from '../useAiArtifacts';
import { LevelType, VocabItem } from '../../types/japanese';
import { generateVocabHelp } from '../../services/ai/registry';
import { useContentQuery } from '../useContentQuery';
import { useLessonList } from '../useLessonList';

export function useVocab(activeLevel: LevelType, activeLesson: number) {
  const [searchQuery, setSearchQuery] = useState('');

  const {
    totalLessons,
    lessonCounts,
    error: lessonsError,
    retry: retryLessons,
  } = useLessonList(activeLevel, 'vocab');

  const {
    items: currentContent,
    loading,
    error: contentError,
    retry: retryContent,
  } = useContentQuery<VocabItem>(activeLevel, 'vocab', activeLesson);

  // Either failure drives the section's error panel; its retry re-runs both.
  const error = contentError ?? lessonsError;
  const retry = useCallback(() => {
    retryContent();
    retryLessons();
  }, [retryContent, retryLessons]);

  const filteredContent = searchQuery.trim()
    ? currentContent.filter(
        (item) =>
          item.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.reading.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.meaning.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : currentContent;

  const vocabNotes = useAiArtifacts('vocab-help');
  const handleGenerateVocabHelp = (vocab: VocabItem) =>
    vocabNotes.generate(vocab.uid, () => generateVocabHelp({ vocab, level: activeLevel }));

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
    handleGenerateVocabHelp,
    vocabNotes,
  };
}
