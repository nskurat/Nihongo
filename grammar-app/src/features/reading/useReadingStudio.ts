import { useState, useEffect, startTransition } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { generateReadingPractice, getActiveProviderId, getProvider } from '../../services/ai/registry';
import { createStoryId, readingRepository } from '../../services/ai/readingStorage';
import {
  LibraryFilter,
  ReadingView,
  filterLibrary,
  parseReadingView,
  planOpenStory,
  pruneProgress,
  readingViewSearch,
  scoreStory,
  withReading,
  withStoryAnswer,
  withoutStoryAnswers,
} from '../../services/ai/readingSession';
import { LevelType } from '../../types/japanese';
import { ActiveReadings, ReadingHistoryEntry, ReadingProgress } from '../../types/ai';
import { useAiUiStore } from '../../store/useAiStore';
import { isMissingKey } from '../../services/ai/errors';
import { useReadingData } from './useReadingData';

export const PRESET_TOPICS = [
  { id: 'daily', label: '☕ Daily Life & Routine', value: 'Daily Life, Morning Routine, and Hobbies in Japan' },
  { id: 'travel', label: '🚄 Travel & Sightseeing', value: 'Traveling by Shinkansen, Sightseeing in Kyoto & Tokyo' },
  { id: 'food', label: '🍜 Food & Dining', value: 'Eating at a Japanese Restaurant, Ramen, and Izakaya Etiquette' },
  { id: 'culture', label: '🌸 Festivals & Culture', value: 'Traditional Japanese Festivals (Matsuri), Hanami, and Seasons' },
  { id: 'shopping', label: '🛍️ Shopping & City Life', value: 'Convenience Stores, Department Stores, and Asking for Directions' },
  { id: 'story', label: '📖 Mystery / Short Story', value: 'An engaging short mystery story with a heartwarming resolution' },
];

/**
 * Everything Reading Studio and the Story Library share: URL-backed view state,
 * generator settings, each level's current passage, the saved library and the
 * per-story answers, plus the handlers that change them. The components under
 * features/reading/ only render this.
 */
export function useReadingStudio(activeLevel: LevelType) {
  const { setShowKeyModal } = useAiUiStore();
  const { grammarData, vocabData, allowedKanji, error: contentError } = useReadingData(activeLevel);
  const navigate = useNavigate();
  // Studio vs Library, and the library's level filter, live in the URL (?view=library&filter=all)
  // so the header level, the list shown and Back always agree. The filter defaults to - and
  // follows - the header level.
  const [searchParams, setSearchParams] = useSearchParams();
  const { view: activeTab, filter: libraryFilterLevel } = parseReadingView(searchParams, activeLevel);
  const setView = (view: ReadingView, filter: LibraryFilter = libraryFilterLevel) => {
    const search = readingViewSearch(view, filter, activeLevel);
    setSearchParams(new URLSearchParams(search), { replace: true });
  };
  const setActiveTab = (view: ReadingView) => setView(view, activeLevel);
  const setLibraryFilterLevel = (filter: LibraryFilter) => setView('library', filter);

  // Generator configuration
  const [selectedLesson, setSelectedLesson] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  // Tracks the level the lesson scope was set for, so it resets when the level changes
  // without an effect - adjusting state during render, per React's docs.
  const [scopedLevel, setScopedLevel] = useState<LevelType>(activeLevel);
  if (activeLevel !== scopedLevel) {
    setScopedLevel(activeLevel);
    setSelectedLesson('all');
  }
  const [selectedTopic, setSelectedTopic] = useState<string>(PRESET_TOPICS[0].value);
  const [customTopic, setCustomTopic] = useState<string>('');

  // Reader display options
  const [furiganaMode, setFuriganaMode] = useState<'always' | 'hover' | 'off'>('always');
  const [showTranslation, setShowTranslation] = useState<boolean>(false);
  const [showGlossary, setShowGlossary] = useState<boolean>(false);

  // Focus Modal for viewing a story directly from library
  const [modalStory, setModalStory] = useState<ReadingHistoryEntry | null>(null);

  // Each level's current passage. The passage shown is always the current level's own;
  // switching level never relabels another level's passage.
  const [activeReadings, setActiveReadings] = useState<ActiveReadings>({});
  // Answers per story id - shared by Studio and the quick reader, restored on reopen.
  const [progress, setProgress] = useState<ReadingProgress>({});
  const [hydrated, setHydrated] = useState<boolean>(false);
  const [savedHistory, setSavedHistory] = useState<ReadingHistoryEntry[]>([]);
  // The level a generation was started for (null when idle), and the level an error belongs to.
  const [generatingLevel, setGeneratingLevel] = useState<LevelType | null>(null);
  const [error, setError] = useState<{ level: LevelType; message: string } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Bumped by Start over / a new passage: QuestionList is keyed on it, which clears its
  // "show English" toggles exactly where the old explanation maps were reset.
  const [resetCount, setResetCount] = useState(0);

  const totalLessons = Object.keys(grammarData).map(Number).sort((a, b) => a - b);
  const activeProvider = getProvider(getActiveProviderId());

  const activeReading = activeReadings[activeLevel] ?? null;
  const readingData = activeReading?.data ?? null;
  const userAnswers = (activeReading && progress[activeReading.storyId]) || {};
  const modalUserAnswers = (modalStory && progress[modalStory.id]) || {};
  const loading = generatingLevel !== null;
  const generatingHere = generatingLevel === activeLevel;
  const levelError = error?.level === activeLevel ? error.message : '';
  const levelLibraryCount = savedHistory.filter((h) => h.level === activeLevel).length;

  // Load each level's current passage & the library from the repository on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      // Progress first: it reads the legacy per-level answers before anything rewrites them.
      const storedProgress = await readingRepository.getProgress();
      const active = await readingRepository.getActiveReadings();
      const history = await readingRepository.getHistory();
      if (isMounted) {
        setProgress(storedProgress);
        setActiveReadings(active);
        setSavedHistory(history);
        setHydrated(true);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Persist the per-level passages and per-story answers once they have been loaded
  useEffect(() => {
    if (hydrated) readingRepository.setActiveReadings(activeReadings);
  }, [activeReadings, hydrated]);
  useEffect(() => {
    if (hydrated) readingRepository.setProgress(progress);
  }, [progress, hydrated]);

  // Forget answers of stories that left the library and are nobody's current passage.
  const syncLibrary = (history: ReadingHistoryEntry[]) => {
    setSavedHistory(history);
    setProgress((prev) => pruneProgress(prev, history, activeReadings));
  };

  const handleClearHistory = async () => {
    if (window.confirm('Are you sure you want to clear your saved reading library?')) {
      syncLibrary(await readingRepository.clearHistory());
    }
  };

  const handleDeleteHistoryItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    syncLibrary(await readingRepository.deleteFromHistory(id));
    if (modalStory?.id === id) {
      setModalStory(null);
    }
  };

  const handleLoadIntoStudio = (item: ReadingHistoryEntry) => {
    // The story becomes its own level's current passage (its answers come with it, by
    // story id). If that isn't the header level we navigate there. The passage, the view
    // and the route must change in ONE transition: React Router commits navigation inside
    // startTransition, so a plain setState here would render first - showing the old level's
    // passage under the new URL - before the level caught up.
    const plan = planOpenStory(activeReadings, item, activeLevel);
    startTransition(() => {
      setActiveReadings(plan.readings);
      setResetCount((n) => n + 1);
      setModalStory(null);
      if (plan.path) navigate(plan.path);
      else setActiveTab('studio');
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartOver = (storyId: string) => {
    setProgress((prev) => withoutStoryAnswers(prev, storyId));
    setResetCount((n) => n + 1);
  };

  const handleGenerate = async () => {
    // Captured so a result that arrives after a level switch lands on the level it was made for.
    const level = activeLevel;
    setGeneratingLevel(level);
    setError(null);

    try {
      const topicToUse = customTopic.trim() || selectedTopic;
      const lessonNum = selectedLesson === 'all' ? null : Number(selectedLesson);

      const grammarList = lessonNum && grammarData[lessonNum] ? grammarData[lessonNum] : [];
      const vocabList = lessonNum && vocabData[lessonNum] ? vocabData[lessonNum] : [];

      const result = await generateReadingPractice({
        level,
        lesson: lessonNum,
        topic: topicToUse,
        grammarList,
        vocabList,
        allowedKanji,
      });

      // The passage is saved to the library under the same id it is opened with, so its
      // answers (keyed by story id) follow it whether it is reopened from Studio or the library.
      const storyId = createStoryId();
      setActiveReadings((prev) =>
        withReading(prev, { storyId, level, lesson: lessonNum, topic: topicToUse, data: result })
      );
      setResetCount((n) => n + 1);
      const updatedHistory = await readingRepository.saveToHistory({
        reading: result,
        id: storyId,
        level,
        lesson: lessonNum,
        topic: topicToUse,
      });
      setSavedHistory(updatedHistory);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isMissingKey(err)) {
        setShowKeyModal(true);
      } else {
        setError({ level, message: msg || 'Failed to generate reading practice.' });
      }
    } finally {
      setGeneratingLevel(null);
    }
  };

  const handleSelectOption = (questionId: number, optionIndex: number) => {
    if (!activeReading) return;
    const { storyId } = activeReading;
    setProgress((prev) => withStoryAnswer(prev, storyId, questionId, optionIndex));
  };

  const handleModalSelectOption = (questionId: number, optionIndex: number) => {
    if (!modalStory) return;
    const storyId = modalStory.id;
    setProgress((prev) => withStoryAnswer(prev, storyId, questionId, optionIndex));
  };

  const handleCopyText = (text?: string) => {
    if (!text) return;
    const plain = text.replace(/\[[^\]]+\]/g, '');
    navigator.clipboard.writeText(plain);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Score computation for Studio
  const questions = readingData?.questions || [];
  const { answered: answeredCount, correct: correctCount } = readingData
    ? scoreStory(readingData, userAnswers)
    : { answered: 0, correct: 0 };

  const filteredLibrary = filterLibrary(savedHistory, libraryFilterLevel, searchQuery);

  return {
    activeLevel,
    contentError,
    activeTab,
    libraryFilterLevel,
    setActiveTab,
    setLibraryFilterLevel,
    selectedLesson,
    setSelectedLesson,
    searchQuery,
    setSearchQuery,
    selectedTopic,
    setSelectedTopic,
    customTopic,
    setCustomTopic,
    furiganaMode,
    setFuriganaMode,
    showTranslation,
    setShowTranslation,
    showGlossary,
    setShowGlossary,
    modalStory,
    setModalStory,
    activeReadings,
    progress,
    hydrated,
    savedHistory,
    generatingLevel,
    copied,
    resetCount,
    totalLessons,
    activeProvider,
    activeReading,
    readingData,
    userAnswers,
    modalUserAnswers,
    loading,
    generatingHere,
    levelError,
    levelLibraryCount,
    handleClearHistory,
    handleDeleteHistoryItem,
    handleLoadIntoStudio,
    handleStartOver,
    handleGenerate,
    handleSelectOption,
    handleModalSelectOption,
    handleCopyText,
    questions,
    answeredCount,
    correctCount,
    filteredLibrary,
  };
}

export type ReadingStudio = ReturnType<typeof useReadingStudio>;
