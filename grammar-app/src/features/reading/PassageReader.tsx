import { Eye, EyeOff, RefreshCw, Award, Layers, ChevronDown, ChevronUp, Tag, Copy, Check, BookOpen } from 'lucide-react';
import FuriganaText from '../../components/common/FuriganaText';
import { ReadingVocabEntry, ReadingGrammarNote } from '../../types/ai';
import QuestionList, { StartOverButton } from './QuestionList';
import { ReadingStudio } from './useReadingStudio';

/** The current level's passage: reader toolbar, text, translation, glossary and the quiz. */
export default function PassageReader({ studio }: { studio: ReadingStudio }) {
  const {
    furiganaMode,
    setFuriganaMode,
    showTranslation,
    setShowTranslation,
    showGlossary,
    setShowGlossary,
    copied,
    resetCount,
    activeReading,
    readingData,
    userAnswers,
    handleStartOver,
    handleGenerate,
    handleSelectOption,
    handleCopyText,
    questions,
    answeredCount,
    correctCount,
  } = studio;

  return (
    <>
      {/* Reading Material Display */}
      {readingData && activeReading && (
        <div className="space-y-6 animate-fade-in">
          {/* Passage Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Passage Toolbar */}
            <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 text-[10px] font-bold rounded uppercase">
                    {activeReading.level} Passage
                  </span>
                  {activeReading.lesson && (
                    <span className="text-[11px] text-indigo-200 font-medium">• Lesson {activeReading.lesson}</span>
                  )}
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
                          {readingData.vocabulary.map((voc: ReadingVocabEntry, idx: number) => (
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
                          {readingData.grammarUsed.map((g: ReadingGrammarNote, idx: number) => (
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
                <div className="flex items-center gap-2">
                  <div className="px-3.5 py-1.5 bg-indigo-50 rounded-xl border border-indigo-100 text-xs font-bold text-indigo-900">
                    Score: {correctCount} / {questions.length} ({Math.round((correctCount / questions.length) * 100)}%)
                  </div>
                  <StartOverButton onClick={() => handleStartOver(activeReading.storyId)} />
                </div>
              )}
            </div>

            <QuestionList
              key={`${activeReading.storyId}:${resetCount}`}
              questions={questions}
              answers={userAnswers}
              onAnswer={handleSelectOption}
              furiganaMode={furiganaMode}
            />

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
    </>
  );
}
