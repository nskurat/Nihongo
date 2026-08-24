import { LayoutTemplate, ArrowRight, Sparkles, Lightbulb, Loader2, Search, BookOpen, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import GrammarDetailModal from './GrammarDetailModal';
import MarkdownViewer from '../../components/common/MarkdownViewer';
import TagBadge from '../../components/common/TagBadge';
import { LevelType } from '../../types/japanese';
import { useGrammar } from './useGrammar';
import { useAppStore } from '../../store/useAppStore';

interface GrammarSectionProps {
  activeLevel: LevelType;
  activeLesson: number;
}

export default function GrammarSection({ activeLevel, activeLesson }: GrammarSectionProps) {
  const navigate = useNavigate();
  const { showTranslations } = useAppStore();
  
  const {
    searchQuery,
    setSearchQuery,
    selectedDetailItem,
    setSelectedDetailItem,
    totalLessons,
    currentLevelData,
    filteredContent,
    currentContent,
    handleGenerateExamples,
    handleExplainNuance,
    generatedExamples,
    aiExplanations,
    loadingExamples,
    loadingExplanations,
  } = useGrammar(activeLevel, activeLesson);

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in">
      {/* Sidebar / Lesson Selection */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden lg:sticky lg:top-28">
          <div className="p-4 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LayoutTemplate size={18} className="text-indigo-600" />
              <h2 className="font-semibold text-slate-800 text-sm">
                {activeLevel} Lessons ({totalLessons[0] || 1}–{totalLessons[totalLessons.length - 1] || 1})
              </h2>
            </div>
            <span className="text-xs bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full">
              {totalLessons.length}
            </span>
          </div>

          <ul className="flex flex-row lg:flex-col p-2 gap-1.5 overflow-x-auto lg:overflow-y-auto lg:max-h-[70vh] scrollbar-thin scrollbar-thumb-indigo-200">
            {totalLessons.map((lesson) => {
              const count = (currentLevelData[lesson] || []).length;
              return (
                <li key={lesson} className="min-w-fit">
                  <button
                    onClick={() => navigate(`/${activeLevel.toLowerCase()}/grammar/${lesson}`)}
                    className={`w-full flex items-center justify-between text-left px-3.5 py-2.5 rounded-lg transition-all text-sm cursor-pointer ${
                      activeLesson === lesson
                        ? 'bg-indigo-600 text-white shadow-md font-semibold'
                        : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-900'
                    }`}
                  >
                    <span>Lesson {lesson}</span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded-full ${
                          activeLesson === lesson
                            ? 'bg-indigo-700/80 text-indigo-100'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {count}
                      </span>
                      {activeLesson === lesson && <ArrowRight size={14} className="hidden lg:block" />}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="lg:col-span-3 space-y-6">
        {/* Banner */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 text-xs font-bold rounded-md uppercase tracking-wide">
                {activeLevel} Level
              </span>
              <span className="text-xs text-slate-400">• Minna no Nihongo Reference</span>
            </div>
            <h2 className="text-3xl font-extrabold text-slate-800 border-b-4 border-indigo-500 pb-1 inline-block mt-2">
              Lesson {activeLesson}
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              Explore grammar patterns, conjugation formulas, nuances, and AI-powered examples.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            {/* Search input */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search grammar, title, formula..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-56"
              />
            </div>
            <div className="px-3.5 py-1.5 bg-indigo-50 rounded-lg border border-indigo-100 text-indigo-700 font-semibold text-xs text-center whitespace-nowrap">
              {currentContent.length} Patterns
            </div>
          </div>
        </div>

        {/* Empty State */}
        {filteredContent.length === 0 && (
          <div className="bg-white p-12 rounded-xl border border-dashed border-slate-300 text-center space-y-3">
            <h4 className="text-lg font-bold text-slate-700">No grammar patterns found</h4>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              {searchQuery
                ? `No results match your search "${searchQuery}" in Lesson ${activeLesson}.`
                : `Grammar patterns for Lesson ${activeLesson} are currently being prepared.`}
            </p>
          </div>
        )}

        {/* Grammar Cards List */}
        {filteredContent.map((item, index) => (
          <div
            key={item.id}
            className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all hover:border-slate-300"
          >
            {/* Card Header */}
            <div className="bg-gradient-to-r from-indigo-50/80 via-white to-slate-50 p-5 border-b border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="bg-indigo-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold flex-shrink-0 mt-0.5 shadow-sm text-sm">
                  {index + 1}
                </div>
                <div>
                  <h3 className="text-xl md:text-2xl font-bold text-indigo-950">{item.title}</h3>
                  <p className="text-indigo-600 font-medium mt-1 text-base flex items-center gap-1.5">
                    {showTranslations ? item.meaning : '••••••••••••'}
                  </p>
                  {/* Tag Badges */}
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {item.tags.map(tagId => (
                        <TagBadge key={tagId} tagId={tagId} />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* View Deep Dive breakdown button */}
              <button
                onClick={() => setSelectedDetailItem(item)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 font-semibold text-xs rounded-lg border border-indigo-200 shadow-2xs transition-all cursor-pointer shrink-0"
              >
                <Layers size={14} />
                <span>Deep Dive</span>
              </button>
            </div>

            {/* Card Body */}
            <div className="p-5 space-y-4">
              {/* Structure Formula */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-200/60 px-2 py-0.5 rounded">
                  Structure
                </span>
                <code className="text-sm text-indigo-900 font-bold font-mono tracking-tight">
                  {item.structure}
                </code>
              </div>

              {/* Formatted Markdown Explanation */}
              <div className="text-slate-600 text-sm leading-relaxed">
                <MarkdownViewer content={item.details || item.explanation} />
              </div>

              {/* Static Example Sentences */}
              {item.examples && item.examples.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <BookOpen size={13} className="text-indigo-600" /> Examples
                  </h4>
                  <div className="space-y-2">
                    {item.examples.map((ex, idx) => (
                      <div key={idx} className="bg-slate-50/60 p-2.5 rounded-lg border border-slate-100">
                        <div className="font-bold text-slate-800 text-sm">{ex.jp}</div>
                        {showTranslations && <div className="text-slate-600 text-xs mt-0.5">{ex.en}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Generated Sentences if generated */}
              {generatedExamples[item.id] && generatedExamples[item.id].length > 0 && (
                <div className="space-y-2 pt-2 border-t border-amber-100 animate-fade-in">
                  <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles size={13} /> AI Practice Examples
                  </h4>
                  <div className="space-y-2">
                    {generatedExamples[item.id].map((ex, idx) => (
                      <div key={idx} className="bg-amber-50/50 p-2.5 rounded-lg border border-amber-100">
                        <div className="font-bold text-slate-900 text-sm">{ex.jp}</div>
                        {showTranslations && <div className="text-slate-600 text-xs mt-0.5">{ex.en}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Controls */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleGenerateExamples(item)}
                  disabled={loadingExamples[item.id]}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-semibold transition-colors border border-amber-200/80 disabled:opacity-50 cursor-pointer"
                >
                  {loadingExamples[item.id] ? (
                    <Loader2 className="animate-spin" size={14} />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  {loadingExamples[item.id] ? 'Generating...' : 'AI: More Examples'}
                </button>

                <button
                  onClick={() => handleExplainNuance(item)}
                  disabled={loadingExplanations[item.id] || !!aiExplanations[item.id]}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold transition-colors border border-indigo-200/80 disabled:opacity-50 cursor-pointer"
                >
                  {loadingExplanations[item.id] ? (
                    <Loader2 className="animate-spin" size={14} />
                  ) : (
                    <Lightbulb size={14} />
                  )}
                  {loadingExplanations[item.id]
                    ? 'Analyzing...'
                    : aiExplanations[item.id]
                    ? 'Nuance Explained'
                    : 'AI: Explain Nuances'}
                </button>
              </div>

              {/* AI Nuance Explanation Box */}
              {aiExplanations[item.id] && (
                <div className="mt-4 bg-gradient-to-r from-indigo-50/70 to-slate-50 p-4 md:p-5 rounded-xl border border-indigo-100 text-slate-700 text-xs md:text-sm leading-relaxed shadow-xs">
                  <h5 className="font-bold flex items-center gap-2 mb-2 text-indigo-900 text-sm">
                    <Lightbulb size={16} className="text-amber-500" />
                    Linguist's Note & Nuance
                  </h5>
                  <MarkdownViewer content={aiExplanations[item.id]} className="text-xs md:text-sm text-slate-700 leading-relaxed" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Deep Dive Breakdown Modal */}
      {selectedDetailItem && (
        <GrammarDetailModal
          isOpen={!!selectedDetailItem}
          onClose={() => setSelectedDetailItem(null)}
          item={selectedDetailItem}
          activeLevel={activeLevel}
          showTranslations={showTranslations}
          onGenerateExplanation={handleExplainNuance}
          loadingExplanation={loadingExplanations}
          aiExplanation={aiExplanations}
        />
      )}
    </main>
  );
}
