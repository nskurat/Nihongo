import { useState, useEffect } from 'react';
import {
  BookOpenCheck,
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  HelpCircle,
  RefreshCw,
  Award,
  Layers,
  ChevronDown,
  ChevronUp,
  Tag,
  Copy,
  Check,
  AlertCircle,
  Compass,
  History,
  Trash2,
  Clock,
  Search,
  BookMarked,
  BookOpen,
} from 'lucide-react';
import FuriganaText from './FuriganaText';
import { generateReadingPractice, getActiveProviderId, getProvider } from '../services/ai/registry';
import { readingRepository } from '../services/ai/readingStorage';
import { GrammarItem, VocabItem, LevelType } from '../types/japanese';
import { ReadingPracticeData, ReadingHistoryEntry } from '../types/ai';

const PRESET_TOPICS = [
  { id: 'daily', label: '☕ Daily Life & Routine', value: 'Daily Life, Morning Routine, and Hobbies in Japan' },
  { id: 'travel', label: '🚄 Travel & Sightseeing', value: 'Traveling by Shinkansen, Sightseeing in Kyoto & Tokyo' },
  { id: 'food', label: '🍜 Food & Dining', value: 'Eating at a Japanese Restaurant, Ramen, and Izakaya Etiquette' },
  { id: 'culture', label: '🌸 Festivals & Culture', value: 'Traditional Japanese Festivals (Matsuri), Hanami, and Seasons' },
  { id: 'shopping', label: '🛍️ Shopping & City Life', value: 'Convenience Stores, Department Stores, and Asking for Directions' },
  { id: 'story', label: '📖 Mystery / Short Story', value: 'An engaging short mystery story with a heartwarming resolution' },
];

interface ReadingSectionProps {
  activeLevel?: LevelType;
  grammarData?: Record<number, GrammarItem[]>;
  vocabData?: Record<number, VocabItem[]>;
  onOpenKeyModal: () => void;
}

export default function ReadingSection({
  activeLevel = 'N4',
  grammarData = {},
  vocabData = {},
  onOpenKeyModal,
}: ReadingSectionProps) {
  // Navigation tabs inside reading section: 'studio' | 'library'
  const [activeTab, setActiveTab] = useState<'studio' | 'library'>('studio');

  // Generator configuration
  const [selectedLesson, setSelectedLesson] = useState<string>('all');
  const [selectedTopic, setSelectedTopic] = useState<string>(PRESET_TOPICS[0].value);
  const [customTopic, setCustomTopic] = useState<string>('');

  // Reader display options
  const [furiganaMode, setFuriganaMode] = useState<'always' | 'hover' | 'off'>('always');
  const [showTranslation, setShowTranslation] = useState<boolean>(false);
  const [showGlossary, setShowGlossary] = useState<boolean>(false);

  // Library filter & search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [libraryFilterLevel, setLibraryFilterLevel] = useState<'ALL' | 'N4' | 'N3'>('ALL');

  // Focus Modal for viewing a story directly from library
  const [modalStory, setModalStory] = useState<ReadingHistoryEntry | null>(null);
  const [modalUserAnswers, setModalUserAnswers] = useState<Record<number, number>>({});

  // Active Passage & Library State
  const [loading, setLoading] = useState<boolean>(false);
  const [readingData, setReadingData] = useState<ReadingPracticeData | null>(null);
  const [savedHistory, setSavedHistory] = useState<ReadingHistoryEntry[]>([]);
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // Quiz state for studio
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [showExplanations, setShowExplanations] = useState<Record<number, boolean>>({});
  const [showExplanationEn, setShowExplanationEn] = useState<Record<number, boolean>>({});
  const [modalShowExplanationEn, setModalShowExplanationEn] = useState<Record<number, boolean>>({});

  const totalLessons = Object.keys(grammarData).map(Number).sort((a, b) => a - b);
  const activeProvider = getProvider(getActiveProviderId());

  // Load initial reading & history from repository on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const active = await readingRepository.getActiveReading();
      const history = await readingRepository.getHistory();
      if (isMounted) {
        if (active) setReadingData(active);
        if (history) setSavedHistory(history);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Sync active reading state to storage whenever it changes
  useEffect(() => {
    if (readingData !== null) {
      readingRepository.setActiveReading(readingData);
    }
  }, [readingData]);

  // Reset lesson selection if level changes
  useEffect(() => {
    setSelectedLesson('all');
  }, [activeLevel]);

  const handleClearHistory = async () => {
    if (window.confirm('Are you sure you want to clear your saved reading library?')) {
      const cleared = await readingRepository.clearHistory();
      setSavedHistory(cleared);
    }
  };

  const handleDeleteHistoryItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = await readingRepository.deleteFromHistory(id);
    setSavedHistory(updated);
    if (modalStory?.id === id) {
      setModalStory(null);
    }
  };

  const handleLoadIntoStudio = (item: ReadingHistoryEntry) => {
    setReadingData(item.data);
    setUserAnswers({});
    setShowExplanations({});
    setActiveTab('studio');
    if (modalStory) setModalStory(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setUserAnswers({});
    setShowExplanations({});

    try {
      const topicToUse = customTopic.trim() || selectedTopic;
      const lessonNum = selectedLesson === 'all' ? null : Number(selectedLesson);

      const grammarList = lessonNum && grammarData[lessonNum] ? grammarData[lessonNum] : [];
      const vocabList = lessonNum && vocabData[lessonNum] ? vocabData[lessonNum] : [];

      const result = await generateReadingPractice({
        level: activeLevel,
        lesson: lessonNum,
        topic: topicToUse,
        grammarList,
        vocabList,
      });

      setReadingData(result);
      const updatedHistory = await readingRepository.saveToHistory({
        reading: result,
        level: activeLevel,
        lesson: lessonNum,
        topic: topicToUse,
      });
      setSavedHistory(updatedHistory);
      setActiveTab('studio');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'MISSING_KEY') {
        onOpenKeyModal();
      } else {
        setError(msg || 'Failed to generate reading practice.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (questionId: number, optionIndex: number) => {
    if (userAnswers[questionId] !== undefined) return;
    setUserAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
    setShowExplanations((prev) => ({ ...prev, [questionId]: true }));
  };

  const handleModalSelectOption = (questionId: number, optionIndex: number) => {
    if (modalUserAnswers[questionId] !== undefined) return;
    setModalUserAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
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
  const answeredCount = Object.keys(userAnswers).length;
  const correctCount = questions.filter((q) => userAnswers[q.id] === q.correctIndex).length;

  // Filtered Library calculation
  const filteredLibrary = savedHistory.filter((item) => {
    const matchesLevel = libraryFilterLevel === 'ALL' || item.level === libraryFilterLevel;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (item.data?.title && item.data.title.toLowerCase().includes(q)) ||
      (item.data?.titleEn && item.data.titleEn.toLowerCase().includes(q)) ||
      (item.topic && item.topic.toLowerCase().includes(q));
    return matchesLevel && matchesSearch;
  });

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-6 animate-fade-in">
      {/* Top Workspace Header & Tab Selector */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600">
            <BookOpenCheck size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 text-xs font-bold rounded-md uppercase tracking-wider">
                {activeLevel} Immersion
              </span>
              <span className="text-xs text-slate-400">• AI Reading Comprehension</span>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
              Japanese Reading Studio & Library
            </h2>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('studio')}
            className={`flex-1 sm:flex-initial px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'studio'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Compass size={14} />
            <span>Practice Studio</span>
          </button>

          <button
            onClick={() => setActiveTab('library')}
            className={`flex-1 sm:flex-initial px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 relative cursor-pointer ${
              activeTab === 'library'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History size={14} />
            <span>Story Library</span>
            {savedHistory.length > 0 && (
              <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-700 text-[10px] font-extrabold rounded-full">
                {savedHistory.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: PRACTICE STUDIO */}
      {/* ========================================================================= */}
      {activeTab === 'studio' && (
        <div className="space-y-6">
          {/* Generator Controls Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Sparkles size={16} className="text-indigo-600" />
                Configure Reading Material ({activeLevel})
              </h3>
              <div className="text-xs text-slate-400">
                Powered by <span className="font-semibold text-slate-700">{activeProvider.name}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Lesson Scope Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Lesson Grammar Scope
                </label>
                <select
                  value={selectedLesson}
                  onChange={(e) => setSelectedLesson(e.target.value)}
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="all">General {activeLevel} (All Lessons Aligned)</option>
                  {totalLessons.map((l) => (
                    <option key={l} value={l}>
                      Minna no Nihongo Lesson {l} (Targeted Vocabulary & Grammar)
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Selecting a specific lesson weaves its grammar structures and vocabulary directly into the story.
                </p>
              </div>

              {/* Topic Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Preset Theme / Topic
                </label>
                <select
                  value={selectedTopic}
                  onChange={(e) => {
                    setSelectedTopic(e.target.value);
                    setCustomTopic('');
                  }}
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  {PRESET_TOPICS.map((t) => (
                    <option key={t.id} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Custom Topic Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Or Enter a Custom Topic / Scenario (Optional)
              </label>
              <input
                type="text"
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                placeholder="e.g. Adopting a cat in Tokyo, Buying a train ticket at Shinjuku station, Lost in Akihabara..."
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Error Banner */}
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5 animate-fade-in">
                <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold block">Generation Error</span>
                  {error}
                </div>
              </div>
            )}

            {/* Generate Action Button */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                <span>{loading ? 'Generating 150-Word Passage & 5 Comprehension Questions...' : 'Generate Reading Material'}</span>
              </button>
            </div>
          </div>

          {/* Reading Material Display */}
          {readingData && (
            <div className="space-y-6 animate-fade-in">
              {/* Passage Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Passage Toolbar */}
                <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 text-[10px] font-bold rounded uppercase">
                        {activeLevel} Passage
                      </span>
                    </div>
                    <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                      <FuriganaText text={readingData.title} mode={furiganaMode} />
                    </h3>
                    {readingData.titleEn && (
                      <p className="text-xs text-indigo-200 mt-0.5 italic">{readingData.titleEn}</p>
                    )}
                  </div>

                  {/* Furigana Mode & Reader Controls */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center bg-white/10 p-1 rounded-xl border border-white/20">
                      <button
                        onClick={() => setFuriganaMode('always')}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                          furiganaMode === 'always'
                            ? 'bg-white text-indigo-950 shadow-sm'
                            : 'text-indigo-200 hover:text-white'
                        }`}
                        title="Always show Furigana over Kanji"
                      >
                        Furigana ON
                      </button>
                      <button
                        onClick={() => setFuriganaMode('hover')}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                          furiganaMode === 'hover'
                            ? 'bg-white text-indigo-950 shadow-sm'
                            : 'text-indigo-200 hover:text-white'
                        }`}
                        title="Show Furigana only when hovering over Kanji"
                      >
                        Hover
                      </button>
                      <button
                        onClick={() => setFuriganaMode('off')}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                          furiganaMode === 'off'
                            ? 'bg-white text-indigo-950 shadow-sm'
                            : 'text-indigo-200 hover:text-white'
                        }`}
                        title="Hide Furigana for full kanji test"
                      >
                        OFF
                      </button>
                    </div>

                    <button
                      onClick={() => setShowTranslation(!showTranslation)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                        showTranslation
                          ? 'bg-white text-indigo-950 border-white'
                          : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
                      }`}
                    >
                      {showTranslation ? <EyeOff size={13} /> : <Eye size={13} />}
                      <span>{showTranslation ? 'Hide English' : 'English'}</span>
                    </button>

                    <button
                      onClick={() => handleCopyText(readingData.japaneseText)}
                      className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 transition-all cursor-pointer"
                      title="Copy Japanese Text"
                    >
                      {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                {/* Japanese Reading Body */}
                <div className="p-6 md:p-8 bg-white text-slate-800 text-base md:text-lg leading-loose space-y-4 tracking-wide selection:bg-indigo-100 selection:text-indigo-900">
                  <p className="whitespace-pre-line">
                    <FuriganaText text={readingData.japaneseText} mode={furiganaMode} />
                  </p>
                </div>

                {/* English Translation Callout */}
                {showTranslation && readingData.englishTranslation && (
                  <div className="p-6 bg-slate-50 border-t border-slate-200 text-slate-600 text-sm leading-relaxed animate-fade-in">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      English Translation
                    </h4>
                    <p className="italic">{readingData.englishTranslation}</p>
                  </div>
                )}

                {/* Grammar & Vocabulary Drawer Toggle */}
                {((readingData.vocabulary && readingData.vocabulary.length > 0) ||
                  (readingData.grammarUsed && readingData.grammarUsed.length > 0)) && (
                  <div className="border-t border-slate-200 bg-slate-50/70">
                    <button
                      onClick={() => setShowGlossary(!showGlossary)}
                      className="w-full px-6 py-3 text-xs font-bold text-slate-600 hover:text-indigo-600 flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Layers size={14} className="text-indigo-600" />
                        Passage Vocabulary & Grammar Breakdown ({readingData.vocabulary?.length || 0} words, {readingData.grammarUsed?.length || 0} patterns)
                      </span>
                      {showGlossary ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {showGlossary && (
                      <div className="p-6 pt-2 border-t border-slate-200/80 grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                        {/* Vocabulary List */}
                        {readingData.vocabulary && readingData.vocabulary.length > 0 && (
                          <div>
                            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              <Tag size={13} className="text-emerald-600" /> Key Vocabulary
                            </h5>
                            <div className="space-y-1.5">
                              {readingData.vocabulary.map((voc, idx) => (
                                <div
                                  key={idx}
                                  className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-200 text-xs"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-900">{voc.word}</span>
                                    <span className="text-slate-400">({voc.reading})</span>
                                  </div>
                                  <span className="text-slate-600">{voc.meaning}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Grammar Patterns */}
                        {readingData.grammarUsed && readingData.grammarUsed.length > 0 && (
                          <div>
                            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              <Layers size={13} className="text-indigo-600" /> Grammar In Use
                            </h5>
                            <div className="space-y-1.5">
                              {readingData.grammarUsed.map((g, idx) => (
                                <div
                                  key={idx}
                                  className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs space-y-0.5"
                                >
                                  <span className="font-bold text-indigo-900 font-mono block">
                                    {g.pattern}
                                  </span>
                                  <span className="text-slate-500 text-[11px] block">{g.note}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Comprehension Quiz Section (Strict 5 Questions) */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <BookOpen size={18} className="text-indigo-600" />
                      5-Question Comprehension Test (読解問題)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Answer the questions below to test your understanding of the passage.
                    </p>
                  </div>

                  {answeredCount > 0 && (
                    <div className="px-3.5 py-1.5 bg-indigo-50 rounded-xl border border-indigo-100 text-xs font-bold text-indigo-900">
                      Score: {correctCount} / {questions.length} ({Math.round((correctCount / questions.length) * 100)}%)
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  {questions.map((q, qIdx) => {
                    const chosenOption = userAnswers[q.id];
                    const isAnswered = chosenOption !== undefined;
                    const isCorrect = chosenOption === q.correctIndex;

                    return (
                      <div
                        key={q.id}
                        className={`p-5 rounded-2xl border transition-all ${
                          isAnswered
                            ? isCorrect
                              ? 'bg-emerald-50/40 border-emerald-200'
                              : 'bg-rose-50/40 border-rose-200'
                            : 'bg-slate-50/60 border-slate-200'
                        }`}
                      >
                        {/* Question Prompt */}
                        <div className="flex items-start gap-3 mb-4">
                          <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0 mt-0.5 shadow-xs">
                            {qIdx + 1}
                          </span>
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm md:text-base leading-relaxed">
                              <FuriganaText text={q.question} mode={furiganaMode} />
                            </h4>
                          </div>
                        </div>

                        {/* Options */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {q.options.map((opt, optIdx) => {
                            const isChosen = chosenOption === optIdx;
                            const isThisCorrect = optIdx === q.correctIndex;

                            let btnStyle = 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/40';

                            if (isAnswered) {
                              if (isThisCorrect) {
                                btnStyle = 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold shadow-xs';
                              } else if (isChosen && !isCorrect) {
                                btnStyle = 'bg-rose-50 border-rose-500 text-rose-950 font-semibold shadow-xs';
                              } else {
                                btnStyle = 'bg-white border-slate-200 text-slate-400 opacity-60';
                              }
                            }

                            return (
                              <button
                                key={optIdx}
                                onClick={() => handleSelectOption(q.id, optIdx)}
                                disabled={isAnswered}
                                className={`p-3 rounded-xl border text-left text-xs md:text-sm transition-all flex items-center justify-between gap-3 cursor-pointer ${btnStyle}`}
                              >
                                <span
                                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                                    isAnswered && isThisCorrect
                                      ? 'bg-emerald-600 text-white'
                                      : isAnswered && isChosen
                                      ? 'bg-rose-600 text-white'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {String.fromCharCode(65 + optIdx)}
                                </span>
                                <span className="flex-1">
                                  <FuriganaText text={opt} mode={furiganaMode} />
                                </span>
                                {isAnswered && isThisCorrect && (
                                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                                )}
                                {isAnswered && isChosen && !isCorrect && (
                                  <XCircle size={16} className="text-rose-600 shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {/* Explanation reveal upon answering with Furigana and toggleable English */}
                        {isAnswered && showExplanations[q.id] && (
                          <div className="mt-4 p-4 bg-slate-50/80 rounded-xl border border-slate-200 text-xs space-y-2 animate-fade-in">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 font-bold text-indigo-950 text-xs">
                                <HelpCircle size={14} className="text-indigo-600 shrink-0" />
                                <span>解説 • Explanation & Evidence:</span>
                              </div>

                              {q.explanationEn && (
                                <button
                                  onClick={() =>
                                    setShowExplanationEn((prev) => ({
                                      ...prev,
                                      [q.id]: !prev[q.id],
                                    }))
                                  }
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all border flex items-center gap-1 cursor-pointer ${
                                    showExplanationEn[q.id]
                                      ? 'bg-indigo-100 border-indigo-300 text-indigo-800'
                                      : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-600'
                                  }`}
                                >
                                  {showExplanationEn[q.id] ? <EyeOff size={11} /> : <Eye size={11} />}
                                  <span>{showExplanationEn[q.id] ? 'Hide English' : 'English Translation'}</span>
                                </button>
                              )}
                            </div>

                            {/* Japanese Explanation with Furigana */}
                            <div className="text-slate-800 text-sm leading-relaxed">
                              <FuriganaText text={q.explanationJp || q.explanation || ''} mode={furiganaMode} />
                            </div>

                            {/* English Translation Callout */}
                            {showExplanationEn[q.id] && q.explanationEn && (
                              <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-600 leading-relaxed italic animate-fade-in">
                                {q.explanationEn}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Quiz Completion Banner */}
                {answeredCount === 5 && (
                  <div className="p-6 bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700 text-white rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-scale-up">
                    <div className="text-center sm:text-left">
                      <h4 className="text-xl font-extrabold flex items-center justify-center sm:justify-start gap-2">
                        <Award size={22} className="text-amber-300" />
                        {correctCount === 5
                          ? '🎌 Perfect Score! 5 / 5!'
                          : correctCount >= 3
                          ? '👏 Great Job! ' + correctCount + ' / 5'
                          : '💪 Good Practice! ' + correctCount + ' / 5'}
                      </h4>
                      <p className="text-xs text-indigo-100 mt-1">
                        You have completed all 5 comprehension questions for this passage.
                      </p>
                    </div>

                    <button
                      onClick={handleGenerate}
                      className="px-5 py-2.5 bg-white hover:bg-slate-100 text-indigo-900 font-bold text-xs rounded-xl shadow-md transition-all shrink-0 flex items-center gap-2 cursor-pointer"
                    >
                      <RefreshCw size={14} />
                      <span>Generate New Passage</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: STORY LIBRARY (PERSISTED HISTORY) */}
      {/* ========================================================================= */}
      {activeTab === 'library' && (
        <div className="space-y-6 animate-fade-in">
          {/* Library Toolbar */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search saved stories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Level Filter */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                {(['ALL', 'N4', 'N3'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setLibraryFilterLevel(lvl)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      libraryFilterLevel === lvl
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
              <span className="text-xs font-medium text-slate-500">
                {filteredLibrary.length} Stories Saved
              </span>

              {savedHistory.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="text-xs text-slate-400 hover:text-rose-600 font-semibold flex items-center gap-1 transition-colors px-2 py-1 cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span>Clear Library</span>
                </button>
              )}
            </div>
          </div>

          {/* Empty Library State */}
          {filteredLibrary.length === 0 && (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto">
                <BookMarked size={28} />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-800">No Saved Stories Yet</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Passages you generate in the Practice Studio will automatically be archived here for future offline reading and reviews.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('studio')}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Compass size={14} />
                <span>Go to Practice Studio</span>
              </button>
            </div>
          )}

          {/* Story Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredLibrary.map((item) => (
              <div
                key={item.id}
                onClick={() => setModalStory(item)}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all p-5 flex flex-col justify-between cursor-pointer group relative overflow-hidden"
              >
                <div className="space-y-3">
                  {/* Card Header & Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded-md uppercase">
                        {item.level}
                      </span>
                      {item.lesson && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-semibold rounded-md">
                          Lesson {item.lesson}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                      className="text-slate-300 hover:text-rose-600 p-1 rounded-lg transition-colors cursor-pointer"
                      title="Delete Story"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Title & Preview */}
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-base group-hover:text-indigo-600 transition-colors line-clamp-2 leading-snug">
                      <FuriganaText text={item.data?.title} mode="always" />
                    </h4>
                    {item.data?.titleEn && (
                      <p className="text-xs text-slate-400 mt-1 italic line-clamp-1">
                        {item.data.titleEn}
                      </p>
                    )}
                  </div>

                  {/* Snippet */}
                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                    <FuriganaText text={item.data?.japaneseText?.slice(0, 120) + '...'} mode="always" />
                  </p>
                </div>

                {/* Footer Metadata & CTA */}
                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Clock size={11} />
                    <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLoadIntoStudio(item);
                      }}
                      className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] rounded-lg transition-colors cursor-pointer"
                      title="Load into Studio for full interactive practice & quiz"
                    >
                      Practice in Studio
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* QUICK READ FOCUS MODAL */}
      {/* ========================================================================= */}
      {modalStory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div
            className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-scale-up my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-0.5 bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 text-[10px] font-bold rounded uppercase">
                    {modalStory.level} Reader
                  </span>
                  {modalStory.lesson && (
                    <span className="text-xs text-slate-300 font-medium">
                      • Lesson {modalStory.lesson}
                    </span>
                  )}
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                  <FuriganaText text={modalStory.data?.title} mode="always" />
                </h3>
                {modalStory.data?.titleEn && (
                  <p className="text-xs text-indigo-200 italic mt-0.5">{modalStory.data.titleEn}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleLoadIntoStudio(modalStory)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Compass size={13} />
                  <span>Open in Studio</span>
                </button>
                <button
                  onClick={() => setModalStory(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1 max-h-[calc(90vh-160px)] scrollbar-thin scrollbar-thumb-slate-300">
              {/* Japanese Text */}
              <div className="text-slate-800 text-base md:text-lg leading-loose space-y-3">
                <FuriganaText text={modalStory.data?.japaneseText} mode="always" />
              </div>

              {/* Translation */}
              {modalStory.data?.englishTranslation && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 leading-relaxed italic">
                  <strong>Translation:</strong> {modalStory.data.englishTranslation}
                </div>
              )}

              {/* Quick Questions in Modal */}
              <div className="pt-4 border-t border-slate-200 space-y-4">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <BookOpen size={16} className="text-indigo-600" />
                  Comprehension Questions ({modalStory.data?.questions?.length || 0})
                </h4>

                <div className="space-y-4">
                  {modalStory.data?.questions?.map((q, idx) => {
                    const sel = modalUserAnswers[q.id];
                    const isAns = sel !== undefined;
                    const isCorr = sel === q.correctIndex;

                    return (
                      <div key={q.id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                        <div className="flex items-start gap-2.5">
                          <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <h5 className="font-bold text-slate-900 text-sm leading-relaxed">
                            <FuriganaText text={q.question} mode="always" />
                          </h5>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {q.options.map((opt, optI) => {
                            let style = 'bg-slate-50 border-slate-200 hover:bg-indigo-50 text-slate-800';
                            if (isAns) {
                              if (optI === q.correctIndex) style = 'bg-emerald-100 border-emerald-500 text-emerald-950 font-bold';
                              else if (sel === optI && !isCorr) style = 'bg-rose-100 border-rose-500 text-rose-950 font-semibold';
                              else style = 'bg-slate-50 border-slate-200 text-slate-400 opacity-60';
                            }
                            return (
                              <button
                                key={optI}
                                onClick={() => handleModalSelectOption(q.id, optI)}
                                disabled={isAns}
                                className={`p-2.5 rounded-lg border text-left text-xs transition-colors flex items-center gap-2 cursor-pointer ${style}`}
                              >
                                <span className="font-bold shrink-0">{String.fromCharCode(65 + optI)}.</span>
                                <FuriganaText text={opt} mode="always" />
                              </button>
                            );
                          })}
                        </div>

                        {isAns && (
                          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-indigo-950 text-xs">解説 • Explanation:</span>
                              {q.explanationEn && (
                                <button
                                  onClick={() =>
                                    setModalShowExplanationEn((prev) => ({
                                      ...prev,
                                      [q.id]: !prev[q.id],
                                    }))
                                  }
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all border flex items-center gap-1 cursor-pointer ${
                                    modalShowExplanationEn[q.id]
                                      ? 'bg-indigo-100 border-indigo-300 text-indigo-800'
                                      : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-600'
                                  }`}
                                >
                                  {modalShowExplanationEn[q.id] ? <EyeOff size={11} /> : <Eye size={11} />}
                                  <span>{modalShowExplanationEn[q.id] ? 'Hide English' : 'English'}</span>
                                </button>
                              )}
                            </div>

                            <div className="text-slate-800 text-xs leading-relaxed">
                              <FuriganaText text={q.explanationJp || q.explanation || ''} mode="always" />
                            </div>

                            {modalShowExplanationEn[q.id] && q.explanationEn && (
                              <div className="p-2 bg-white rounded-lg border border-slate-200 text-xs text-slate-600 italic animate-fade-in">
                                {q.explanationEn}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setModalStory(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer"
              >
                Close Reader
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
