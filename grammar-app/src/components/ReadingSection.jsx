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
} from 'lucide-react';
import FuriganaText from './FuriganaText';
import { generateReadingPractice, getActiveProviderId, getProvider } from '../services/ai/registry';

const PRESET_TOPICS = [
  { id: 'daily', label: '☕ Daily Life & Routine', value: 'Daily Life, Morning Routine, and Hobbies in Japan' },
  { id: 'travel', label: '🚄 Travel & Sightseeing', value: 'Traveling by Shinkansen, Sightseeing in Kyoto & Tokyo' },
  { id: 'food', label: '🍜 Food & Dining', value: 'Eating at a Japanese Restaurant, Ramen, and Izakaya Etiquette' },
  { id: 'culture', label: '🌸 Festivals & Culture', value: 'Traditional Japanese Festivals (Matsuri), Hanami, and Seasons' },
  { id: 'shopping', label: '🛍️ Shopping & City Life', value: 'Convenience Stores, Department Stores, and Asking for Directions' },
  { id: 'story', label: '📖 Mystery / Short Story', value: 'An engaging short mystery story with a heartwarming resolution' },
];

import { readingRepository } from '../services/ai/readingStorage';

export default function ReadingSection({
  activeLevel = 'N4',
  grammarData = {},
  vocabData = {},
  onOpenKeyModal,
}) {
  const [selectedLesson, setSelectedLesson] = useState('all');
  const [selectedTopic, setSelectedTopic] = useState(PRESET_TOPICS[0].value);
  const [customTopic, setCustomTopic] = useState('');
  const [furiganaMode, setFuriganaMode] = useState('always'); // 'always' | 'hover' | 'off'
  const [showTranslation, setShowTranslation] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Generation state
  const [loading, setLoading] = useState(false);
  const [readingData, setReadingData] = useState(null);
  const [savedHistory, setSavedHistory] = useState([]);

  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Quiz state
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

  const handleClearHistory = async () => {
    const cleared = await readingRepository.clearHistory();
    setSavedHistory(cleared);
  };

  const handleDeleteHistoryItem = async (id, e) => {
    e.stopPropagation();
    const updated = await readingRepository.deleteFromHistory(id);
    setSavedHistory(updated);
  };

  const handleLoadFromHistory = (item) => {
    setReadingData(item.data);
    setUserAnswers({});
    setShowExplanations({});
    setShowHistoryModal(false);
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

  const handleCopyText = () => {
    if (!readingData?.japaneseText) return;
    const plain = readingData.japaneseText.replace(/\[[^\]]+\]/g, '');
    navigator.clipboard.writeText(plain);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Score computation
  const answeredCount = Object.keys(userAnswers).length;
  const correctCount = readingData?.questions
    ? readingData.questions.filter((q) => userAnswers[q.id] === q.correctIndex).length
    : 0;

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-8 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 text-xs font-bold rounded-md uppercase tracking-wide">
              {activeLevel} Reading Generator
            </span>
            <span className="text-xs text-slate-400">• Cached & Persistent Library</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Interactive Japanese Reading Practice
          </h2>
          <p className="text-slate-500 text-sm mt-1 max-w-2xl leading-relaxed">
            Generate ~150-word passages customized by JLPT level, specific Minna no Nihongo lessons, and themes with interactive Furigana and 5-question quizzes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-stretch md:self-auto justify-end">
          {/* Saved History Button */}
          <button
            onClick={() => setShowHistoryModal(true)}
            className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-2 transition-colors shadow-2xs"
            title="Browse previously generated reading passages"
          >
            <History size={15} className="text-indigo-600" />
            <span>Library ({savedHistory.length})</span>
          </button>

          <div className="px-3.5 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>{activeProvider.name}</span>
          </div>
        </div>
      </div>

      {/* Control & Customization Panel */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
          <Compass size={16} className="text-indigo-600" /> Configure Passage Settings
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
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
            <span>Passages are automatically saved locally to your Library</span>
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
              className="px-3 py-1 bg-rose-600 text-white font-semibold rounded-lg hover:bg-rose-700 transition-colors shrink-0"
            >
              Check AI Key
            </button>
          </div>
        )}
      </div>

      {/* Generated Content Presentation */}
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
                    <Bookmark size={10} /> Saved
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
                    className={`px-2.5 py-1 rounded-md transition-all ${
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
                    className={`px-2.5 py-1 rounded-md transition-all ${
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
                    className={`px-2.5 py-1 rounded-md transition-all ${
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
                  className={`p-1.5 rounded-lg border transition-colors ${
                    showTranslation
                      ? 'bg-indigo-500/40 border-indigo-400 text-white'
                      : 'bg-white/5 border-transparent text-slate-300 hover:text-white'
                  }`}
                  title="Toggle English translation"
                >
                  {showTranslation ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>

                {/* Copy Plain Text */}
                <button
                  onClick={handleCopyText}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-transparent transition-colors"
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
                    className="flex items-center justify-between w-full text-xs font-bold text-slate-600 hover:text-indigo-600 uppercase tracking-wider py-1"
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

          {/* 5-Question Multiple Choice Quiz Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6 md:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Award size={20} className="text-amber-500" /> Reading Comprehension Quiz
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Answer all 5 questions based on the text. Instant feedback and explanations provided.
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
                    {/* Question Header */}
                    <div className="flex items-start gap-3 mb-4">
                      <span className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                        {qIndex + 1}
                      </span>
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-900 text-base leading-snug">
                          <FuriganaText text={q.question} mode={furiganaMode} />
                        </h4>
                        {q.questionEn && (
                          <p className="text-xs text-slate-500 mt-1 italic">{q.questionEn}</p>
                        )}
                      </div>
                    </div>

                    {/* Options Grid */}
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

                    {/* Question Explanation Reveal */}
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
                  className="px-5 py-2.5 bg-white hover:bg-slate-100 text-indigo-900 font-bold text-xs rounded-xl shadow-md transition-all shrink-0 flex items-center gap-2"
                >
                  <RefreshCw size={14} />
                  <span>Generate New Passage</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Saved Readings History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-scale-up flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-300 border border-indigo-400/30">
                  <History size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Saved Reading Library</h3>
                  <p className="text-xs text-slate-300">
                    Instantly reload previously generated reading passages
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            {/* Modal Body / History List */}
            <div className="p-6 space-y-3 overflow-y-auto flex-1 max-h-[60vh]">
              {savedHistory.length === 0 ? (
                <div className="text-center py-12 text-slate-400 space-y-2">
                  <BookOpenCheck size={40} className="mx-auto text-slate-300" />
                  <p className="text-sm font-medium">No saved reading passages yet</p>
                  <p className="text-xs">Generated passages are automatically saved here for quick review.</p>
                </div>
              ) : (
                savedHistory.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleLoadFromHistory(item)}
                    className="p-4 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-300 rounded-xl transition-all cursor-pointer flex justify-between items-start gap-4 group"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded-md uppercase">
                          {item.level}
                        </span>
                        {item.lesson && (
                          <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-medium rounded-md">
                            Lesson {item.lesson}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock size={10} />
                          {new Date(item.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm group-hover:text-indigo-900 transition-colors line-clamp-1">
                        {item.data?.title?.replace(/\[[^\]]+\]/g, '') || 'Reading Passage'}
                      </h4>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {item.data?.japaneseText?.replace(/\[[^\]]+\]/g, '')}
                      </p>
                    </div>

                    <button
                      onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-white transition-colors shrink-0"
                      title="Delete passage from library"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              {savedHistory.length > 0 ? (
                <button
                  onClick={handleClearHistory}
                  className="text-xs text-rose-600 hover:text-rose-700 font-medium px-2 py-1 flex items-center gap-1"
                >
                  <Trash2 size={13} /> Clear Library
                </button>
              ) : (
                <div />
              )}
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
