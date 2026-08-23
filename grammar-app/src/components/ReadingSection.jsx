import React, { useState, useEffect } from 'react';
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
  BookOpen,
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
  Bookmark,
  Search,
  BookMarked,
  Filter,
  ExternalLink,
} from 'lucide-react';
import FuriganaText from './FuriganaText';
import { generateReadingPractice, getActiveProviderId, getProvider } from '../services/ai/registry';
import { readingRepository } from '../services/ai/readingStorage';

const PRESET_TOPICS = [
  { id: 'daily', label: '☕ Daily Life & Routine', value: 'Daily Life, Morning Routine, and Hobbies in Japan' },
  { id: 'travel', label: '🚄 Travel & Sightseeing', value: 'Traveling by Shinkansen, Sightseeing in Kyoto & Tokyo' },
  { id: 'food', label: '🍜 Food & Dining', value: 'Eating at a Japanese Restaurant, Ramen, and Izakaya Etiquette' },
  { id: 'culture', label: '🌸 Festivals & Culture', value: 'Traditional Japanese Festivals (Matsuri), Hanami, and Seasons' },
  { id: 'shopping', label: '🛍️ Shopping & City Life', value: 'Convenience Stores, Department Stores, and Asking for Directions' },
  { id: 'story', label: '📖 Mystery / Short Story', value: 'An engaging short mystery story with a heartwarming resolution' },
];

export default function ReadingSection({
  activeLevel = 'N4',
  grammarData = {},
  vocabData = {},
  onOpenKeyModal,
}) {
  // Navigation tabs inside reading section: 'studio' | 'library'
  const [activeTab, setActiveTab] = useState('studio');

  // Generator configuration
  const [selectedLesson, setSelectedLesson] = useState('all');
  const [selectedTopic, setSelectedTopic] = useState(PRESET_TOPICS[0].value);
  const [customTopic, setCustomTopic] = useState('');

  // Reader display options
  const [furiganaMode, setFuriganaMode] = useState('always'); // 'always' | 'hover' | 'off'
  const [showTranslation, setShowTranslation] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);

  // Library filter & search
  const [searchQuery, setSearchQuery] = useState('');
  const [libraryFilterLevel, setLibraryFilterLevel] = useState('ALL'); // 'ALL' | 'N4' | 'N3'

  // Focus Modal for viewing a story directly from library
  const [modalStory, setModalStory] = useState(null);
  const [modalUserAnswers, setModalUserAnswers] = useState({});

  // Active Passage & Library State
  const [loading, setLoading] = useState(false);
  const [readingData, setReadingData] = useState(null);
  const [savedHistory, setSavedHistory] = useState([]);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Quiz state for studio
  const [userAnswers, setUserAnswers] = useState({}); // { [questionId]: selectedIndex }
  const [showExplanations, setShowExplanations] = useState({}); // { [questionId]: boolean }

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

  const handleDeleteHistoryItem = async (id, e) => {
    e.stopPropagation();
    const updated = await readingRepository.deleteFromHistory(id);
    setSavedHistory(updated);
    if (modalStory?.id === id) {
      setModalStory(null);
    }
  };

  const handleLoadIntoStudio = (item) => {
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
    } catch (err) {
      if (err.message === 'MISSING_KEY') {
        onOpenKeyModal();
      } else {
        setError(err.message || 'Failed to generate reading practice.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (questionId, optionIndex) => {
    if (userAnswers[questionId] !== undefined) return;
    setUserAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
    setShowExplanations((prev) => ({ ...prev, [questionId]: true }));
  };

  const handleModalSelectOption = (questionId, optionIndex) => {
    if (modalUserAnswers[questionId] !== undefined) return;
    setModalUserAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleCopyText = (text) => {
    if (!text) return;
    const plain = text.replace(/\[[^\]]+\]/g, '');
    navigator.clipboard.writeText(plain);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Score computation for Studio
  const answeredCount = Object.keys(userAnswers).length;
  const correctCount = readingData?.questions
    ? readingData.questions.filter((q) => userAnswers[q.id] === q.correctIndex).length
    : 0;

  // Filtered library list
  const filteredHistory = savedHistory.filter((item) => {
    if (libraryFilterLevel !== 'ALL' && item.level !== libraryFilterLevel) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const title = (item.data?.title || '').toLowerCase();
    const topic = (item.topic || '').toLowerCase();
    const text = (item.data?.japaneseText || '').toLowerCase();
    return title.includes(query) || topic.includes(query) || text.includes(query);
  });

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-8 animate-fade-in">
      {/* Top Header Banner & View Tabs */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 text-xs font-bold rounded-md uppercase tracking-wide">
              {activeLevel} Reading Portal
            </span>
            <span className="text-xs text-slate-400">• Japanese Immersion & Comprehension</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Japanese Reading Practice & Story Library
          </h2>
          <p className="text-slate-500 text-sm mt-1 max-w-2xl leading-relaxed">
            Generate ~150-word passages customized by lesson & theme, read with interactive Furigana, and take authentic 5-question comprehension quizzes.
          </p>
        </div>

        {/* Studio / Library Toggle Pills */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 self-stretch md:self-auto">
          <button
            onClick={() => setActiveTab('studio')}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'studio'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles size={14} />
            <span>Practice Studio</span>
          </button>

          <button
            onClick={() => setActiveTab('library')}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'library'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookMarked size={14} />
            <span>Story Library ({savedHistory.length})</span>
          </button>
        </div>
      </div>

      {/* VIEW TAB 1: PRACTICE STUDIO */}
      {activeTab === 'studio' && (
        <div className="space-y-8 animate-fade-in">
          {/* Generator Control Panel */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Compass size={16} className="text-indigo-600" /> Configure New Passage
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Target Lesson Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Layers size={14} className="text-indigo-500" /> Target Lesson Scope
                </label>
                <select
                  value={selectedLesson}
                  onChange={(e) => setSelectedLesson(e.target.value)}
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">🌟 General {activeLevel} Level (All Lessons)</option>
                  {totalLessons.map((l) => (
                    <option key={l} value={l}>
                      Lesson {l} Target Grammar & Vocab
                    </option>
                  ))}
                </select>
              </div>

              {/* Theme Preset Selector */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Tag size={14} className="text-indigo-500" /> Passage Theme / Topic
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_TOPICS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedTopic(p.value);
                        setCustomTopic('');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        selectedTopic === p.value && !customTopic
                          ? 'bg-indigo-600 text-white shadow-2xs font-semibold'
                          : 'bg-slate-50 hover:bg-indigo-50 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Custom Topic Input */}
            <div>
              <input
                type="text"
                placeholder="Or type a custom topic (e.g. 'Visiting a Cat Cafe in Akihabara', 'First day at a Japanese company')..."
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Generator Button */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100">
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-500" />
                <span>Generates ~150-word passage with 5 pure Japanese comprehension questions</span>
              </div>

              <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
                <span>{loading ? 'Crafting Passage & Quiz...' : 'Generate Reading Practice ⚡'}</span>
              </button>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5 animate-fade-in">
                <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold block mb-0.5">Generation Issue:</span>
                  {error}
                </div>
                <button
                  onClick={() => onOpenKeyModal()}
                  className="px-3 py-1 bg-rose-600 text-white font-semibold rounded-lg hover:bg-rose-700 transition-colors shrink-0 cursor-pointer"
                >
                  Check AI Key
                </button>
              </div>
            )}
          </div>

          {/* Active Reading Passage Presentation */}
          {readingData && (
            <div className="space-y-8 animate-fade-in">
              {/* Main Reading Passage Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Top Toolbar */}
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2.5 py-0.5 bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 text-xs font-bold rounded-md">
                        {activeLevel} Reading
                      </span>
                      {selectedLesson !== 'all' && (
                        <span className="px-2.5 py-0.5 bg-white/10 text-slate-300 text-xs font-medium rounded-md">
                          Lesson {selectedLesson}
                        </span>
                      )}
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-semibold rounded-md flex items-center gap-1">
                        <Bookmark size={10} /> Saved in Library
                      </span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold tracking-tight">
                      <FuriganaText text={readingData.title} mode={furiganaMode} className="text-white" />
                    </h3>
                    {readingData.titleEn && (
                      <p className="text-xs text-slate-300 mt-0.5 italic">{readingData.titleEn}</p>
                    )}
                  </div>

                  {/* View Controls (Furigana Modes & Tools) */}
                  <div className="flex flex-wrap items-center gap-2 bg-white/10 p-1.5 rounded-xl border border-white/10">
                    {/* Furigana Mode Pills */}
                    <div className="flex bg-black/20 p-0.5 rounded-lg text-xs font-medium">
                      <button
                        onClick={() => setFuriganaMode('always')}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          furiganaMode === 'always'
                            ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                            : 'text-slate-300 hover:text-white'
                        }`}
                        title="Always show furigana above kanji"
                      >
                        Furigana: On
                      </button>
                      <button
                        onClick={() => setFuriganaMode('hover')}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          furiganaMode === 'hover'
                            ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                            : 'text-slate-300 hover:text-white'
                        }`}
                        title="Hover or tap word to reveal furigana"
                      >
                        Hover
                      </button>
                      <button
                        onClick={() => setFuriganaMode('off')}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          furiganaMode === 'off'
                            ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                            : 'text-slate-300 hover:text-white'
                        }`}
                        title="Hide furigana completely (Exam Mode)"
                      >
                        Off
                      </button>
                    </div>

                    {/* English Translation Toggle */}
                    <button
                      onClick={() => setShowTranslation(!showTranslation)}
                      className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                        showTranslation
                          ? 'bg-indigo-500/40 border-indigo-400 text-white'
                          : 'bg-white/5 border-transparent text-slate-300 hover:text-white'
                      }`}
                      title="Toggle English translation of passage"
                    >
                      {showTranslation ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>

                    {/* Copy Plain Text */}
                    <button
                      onClick={() => handleCopyText(readingData.japaneseText)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-transparent transition-colors cursor-pointer"
                      title="Copy plain Japanese text"
                    >
                      {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>

                {/* Passage Body */}
                <div className="p-6 md:p-8 space-y-6">
                  <div className="text-slate-900 text-lg sm:text-xl font-normal leading-[2.4] sm:leading-[2.6] tracking-wider select-text">
                    <FuriganaText text={readingData.japaneseText} mode={furiganaMode} />
                  </div>

                  {/* English Translation Drawer */}
                  {showTranslation && readingData.englishTranslation && (
                    <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-700 leading-relaxed animate-fade-in">
                      <div className="flex items-center gap-2 font-bold text-slate-900 mb-2 text-xs uppercase tracking-wider">
                        <BookOpen size={14} className="text-indigo-600" /> English Translation:
                      </div>
                      <p className="italic">{readingData.englishTranslation}</p>
                    </div>
                  )}

                  {/* Glossary & Grammar Highlights Accordion */}
                  {((readingData.vocabulary && readingData.vocabulary.length > 0) ||
                    (readingData.grammarUsed && readingData.grammarUsed.length > 0)) && (
                    <div className="border-t border-slate-100 pt-4">
                      <button
                        onClick={() => setShowGlossary(!showGlossary)}
                        className="flex items-center justify-between w-full text-xs font-bold text-slate-600 hover:text-indigo-600 uppercase tracking-wider py-1 cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <HelpCircle size={14} /> Key Vocabulary & Grammar In This Passage (
                          {(readingData.vocabulary?.length || 0) + (readingData.grammarUsed?.length || 0)})
                        </span>
                        {showGlossary ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>

                      {showGlossary && (
                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-in">
                          {readingData.vocabulary?.map((v, i) => (
                            <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
                              <div className="font-bold text-slate-900 text-sm">
                                {v.word}{' '}
                                <span className="text-xs font-normal text-indigo-600">({v.reading})</span>
                              </div>
                              <div className="text-slate-600 mt-0.5">{v.meaning}</div>
                            </div>
                          ))}

                          {readingData.grammarUsed?.map((g, i) => (
                            <div key={i} className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs">
                              <div className="font-bold text-indigo-950 font-mono text-sm">{g.pattern}</div>
                              <div className="text-indigo-900/80 mt-0.5">{g.note}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 5-Question Multiple Choice Comprehension Quiz (Pure Japanese Questions & Options) */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6 md:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <Award size={20} className="text-amber-500" /> 読解テスト • Reading Comprehension Quiz
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Answer all 5 questions in Japanese. Immediate explanation is revealed upon answering.
                    </p>
                  </div>

                  {/* Live Quiz Score Tracker */}
                  <div className="px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-3">
                    <span className="text-xs text-indigo-900 font-medium">
                      Answered: <strong>{answeredCount} / 5</strong>
                    </span>
                    <span className="text-xs text-emerald-700 font-bold bg-white px-2.5 py-1 rounded-lg border border-emerald-200">
                      {correctCount} Correct
                    </span>
                  </div>
                </div>

                {/* Questions List */}
                <div className="space-y-6">
                  {readingData.questions.map((q, qIndex) => {
                    const selected = userAnswers[q.id];
                    const isAnswered = selected !== undefined;
                    const isCorrect = selected === q.correctIndex;

                    return (
                      <div
                        key={q.id}
                        className={`p-5 rounded-2xl border transition-all ${
                          isAnswered
                            ? isCorrect
                              ? 'bg-emerald-50/40 border-emerald-200'
                              : 'bg-rose-50/40 border-rose-200'
                            : 'bg-slate-50/70 border-slate-200'
                        }`}
                      >
                        {/* Question Header (Strictly Japanese, no English translation) */}
                        <div className="flex items-start gap-3 mb-4">
                          <span className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                            {qIndex + 1}
                          </span>
                          <div className="flex-1">
                            <h4 className="font-bold text-slate-900 text-base leading-relaxed">
                              <FuriganaText text={q.question} mode={furiganaMode} />
                            </h4>
                          </div>
                        </div>

                        {/* Options Grid (Pure Japanese Options) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {q.options.map((opt, optIdx) => {
                            const isChosen = selected === optIdx;
                            const isThisCorrect = optIdx === q.correctIndex;

                            let buttonStyles = 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800';

                            if (isAnswered) {
                              if (isThisCorrect) {
                                buttonStyles = 'border-emerald-500 bg-emerald-100/70 text-emerald-950 font-bold shadow-xs';
                              } else if (isChosen && !isCorrect) {
                                buttonStyles = 'border-rose-500 bg-rose-100/70 text-rose-950 font-semibold';
                              } else {
                                buttonStyles = 'border-slate-200 bg-white/60 text-slate-400 opacity-60';
                              }
                            }

                            return (
                              <button
                                key={optIdx}
                                onClick={() => handleSelectOption(q.id, optIdx)}
                                disabled={isAnswered}
                                className={`flex items-center gap-3 p-3.5 rounded-xl border text-left text-xs sm:text-sm transition-all cursor-pointer ${buttonStyles}`}
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

                        {/* Explanation reveal upon answering */}
                        {isAnswered && showExplanations[q.id] && (
                          <div className="mt-4 p-3.5 bg-white rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1 animate-fade-in">
                            <div className="flex items-center gap-1.5 font-bold text-indigo-900 mb-0.5">
                              <HelpCircle size={13} className="text-indigo-600" /> Explanation & Evidence:
                            </div>
                            <p className="leading-relaxed">{q.explanation}</p>
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

      {/* VIEW TAB 2: STORY LIBRARY (LIST / CARD VIEW) */}
      {activeTab === 'library' && (
        <div className="space-y-6 animate-fade-in">
          {/* Library Search & Filter Bar */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search saved stories by title, topic, or keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Level Filter Chips & Clear Action */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-medium">
                {['ALL', 'N4', 'N3'].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setLibraryFilterLevel(lvl)}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      libraryFilterLevel === lvl
                        ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {lvl === 'ALL' ? 'All Levels' : `JLPT ${lvl}`}
                  </button>
                ))}
              </div>

              {savedHistory.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1 font-medium cursor-pointer"
                  title="Clear all stories from library"
                >
                  <Trash2 size={13} />
                  <span>Clear All</span>
                </button>
              )}
            </div>
          </div>

          {/* Stories Grid */}
          {filteredHistory.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <BookOpenCheck size={48} className="mx-auto text-slate-300" />
              <h4 className="text-base font-bold text-slate-700">No Stories in Library</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {searchQuery
                  ? 'No stories matched your search query. Try clearing the search filter.'
                  : 'Generated reading passages are automatically saved here so you can review them and take quizzes anytime.'}
              </p>
              <button
                onClick={() => setActiveTab('studio')}
                className="mt-2 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles size={14} /> Go to Practice Studio
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredHistory.map((item) => {
                const plainTitle = item.data?.title?.replace(/\[[^\]]+\]/g, '') || 'Reading Passage';
                const plainSnippet = item.data?.japaneseText?.replace(/\[[^\]]+\]/g, '').slice(0, 120) + '...';
                const questionCount = item.data?.questions?.length || 5;

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between group"
                  >
                    <div className="space-y-3">
                      {/* Top Badges & Date */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded-md">
                            {item.level}
                          </span>
                          {item.lesson && (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-semibold rounded-md">
                              Lesson {item.lesson}
                            </span>
                          )}
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200/60 text-[10px] font-medium rounded-md truncate max-w-[140px]">
                            {item.topic}
                          </span>
                        </div>

                        <span className="text-[10px] text-slate-400 flex items-center gap-1 shrink-0">
                          <Clock size={10} />
                          {new Date(item.timestamp).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Title */}
                      <h4 className="font-bold text-slate-900 text-base group-hover:text-indigo-600 transition-colors line-clamp-1">
                        <FuriganaText text={item.data?.title} mode="always" />
                      </h4>

                      {/* Japanese Snippet Preview */}
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                        {plainSnippet}
                      </p>

                      {/* Metadata Chips */}
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                        <span>📝 {questionCount} Quiz Questions</span>
                        {item.data?.vocabulary?.length > 0 && (
                          <span>• 📚 {item.data.vocabulary.length} Vocab terms</span>
                        )}
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="pt-4 mt-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {/* Quick Focus Modal */}
                        <button
                          onClick={() => {
                            setModalStory(item);
                            setModalUserAnswers({});
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <BookOpen size={13} /> Quick Read Modal
                        </button>

                        {/* Open in Full Studio */}
                        <button
                          onClick={() => handleLoadIntoStudio(item)}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>Open in Studio</span>
                          <ExternalLink size={12} />
                        </button>
                      </div>

                      {/* Delete */}
                      <button
                        onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete story from library"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* QUICK READ FOCUS MODAL */}
      {modalStory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-scale-up flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 text-xs font-bold rounded-md">
                    {modalStory.level}
                  </span>
                  {modalStory.lesson && (
                    <span className="px-2 py-0.5 bg-white/10 text-slate-300 text-xs font-medium rounded-md">
                      Lesson {modalStory.lesson}
                    </span>
                  )}
                  <span className="text-xs text-slate-400">• {modalStory.topic}</span>
                </div>
                <h3 className="text-xl font-bold">
                  <FuriganaText text={modalStory.data?.title} mode="always" className="text-white" />
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleLoadIntoStudio(modalStory)}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Open in Studio</span>
                  <ExternalLink size={13} />
                </button>
                <button
                  onClick={() => setModalStory(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 md:p-8 space-y-6 overflow-y-auto max-h-[70vh]">
              {/* Passage Text */}
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-slate-900 text-base sm:text-lg leading-[2.4] tracking-wider select-text">
                <FuriganaText text={modalStory.data?.japaneseText} mode="always" />
              </div>

              {/* 5-Question Quiz in Modal */}
              <div className="space-y-4 pt-2">
                <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Award size={18} className="text-amber-500" /> Comprehension Questions (
                  {modalStory.data?.questions?.length || 0})
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
                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700">
                            <strong>Explanation:</strong> {q.explanation}
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
