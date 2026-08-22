import React, { useState } from 'react';
import { LayoutTemplate, ArrowRight, CheckCircle, Info, MessageCircle, Sparkles, Lightbulb, Loader2, Search } from 'lucide-react';

export default function GrammarSection({
  grammarData,
  activeLesson,
  setActiveLesson,
  showTranslations,
  onGenerateExamples,
  onExplainNuance,
  loadingExamples,
  loadingExplanations,
  generatedExamples,
  aiExplanations,
  activeLevel,
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const totalLessons = Object.keys(grammarData).map(Number).sort((a, b) => a - b);
  const currentContent = grammarData[activeLesson] || [];

  // Filter grammar points if search is active
  const filteredContent = searchQuery.trim()
    ? currentContent.filter(
        (item) =>
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.meaning.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.structure.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : currentContent;

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
              const count = (grammarData[lesson] || []).length;
              return (
                <li key={lesson} className="min-w-fit">
                  <button
                    onClick={() => setActiveLesson(lesson)}
                    className={`w-full flex items-center justify-between text-left px-3.5 py-2.5 rounded-lg transition-all text-sm ${
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
        {/* Lesson Banner */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 text-xs font-bold rounded-md uppercase tracking-wide">
                {activeLevel} Grammar
              </span>
              <span className="text-xs text-slate-400">• Minna no Nihongo</span>
            </div>
            <h2 className="text-3xl font-extrabold text-slate-800 border-b-4 border-indigo-500 pb-1 inline-block mt-2">
              Lesson {activeLesson}
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              Grammar structures, explanations, and usage guidelines.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            {/* Search filter within lesson */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search grammar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-48"
              />
            </div>
            <div className="px-3.5 py-1.5 bg-indigo-50 rounded-lg border border-indigo-100 text-indigo-700 font-semibold text-xs text-center whitespace-nowrap">
              {currentContent.length} Grammar Points
            </div>
          </div>
        </div>

        {/* Empty State */}
        {filteredContent.length === 0 && (
          <div className="bg-white p-12 rounded-xl border border-dashed border-slate-300 text-center space-y-3">
            <Info size={36} className="mx-auto text-slate-400" />
            <h4 className="text-lg font-bold text-slate-700">No grammar points found</h4>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              {searchQuery
                ? `No grammar matches "${searchQuery}" in Lesson ${activeLesson}. Try searching another keyword.`
                : `Content for Lesson ${activeLesson} is being prepared. You can browse other lessons in the sidebar.`}
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
            <div className="bg-gradient-to-r from-indigo-50/80 via-white to-slate-50 p-5 border-b border-indigo-100">
              <div className="flex items-start gap-3">
                <div className="bg-indigo-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold flex-shrink-0 mt-0.5 shadow-sm text-sm">
                  {index + 1}
                </div>
                <div>
                  <h3 className="text-xl md:text-2xl font-bold text-indigo-950">{item.title}</h3>
                  <p className="text-indigo-600 font-medium mt-1 text-base flex items-center gap-1.5">
                    <CheckCircle size={16} /> {item.meaning}
                  </p>
                </div>
              </div>
            </div>

            {/* Card Body */}
            <div className="p-5 md:p-7 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 h-full">
                  <h4 className="font-semibold text-slate-700 mb-2 text-sm flex items-center gap-2">
                    <Info size={16} className="text-indigo-500" /> Structure / Formula
                  </h4>
                  <p className="font-mono text-xs md:text-sm text-slate-900 bg-white p-2.5 border border-slate-200 rounded-lg shadow-2xs">
                    {item.structure}
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 h-full">
                  <h4 className="font-semibold text-slate-700 mb-2 text-sm flex items-center gap-2">
                    <MessageCircle size={16} className="text-indigo-500" /> Explanation
                  </h4>
                  <p className="text-xs md:text-sm text-slate-700 leading-relaxed">
                    {item.explanation}
                  </p>
                </div>
              </div>

              {/* Examples */}
              <div>
                <h4 className="font-semibold text-slate-800 text-sm mb-3 border-b border-slate-100 pb-2">
                  Example Sentences
                </h4>
                <ul className="space-y-3">
                  {[...item.examples, ...(generatedExamples[item.id] || [])].map((ex, i) => (
                    <li
                      key={i}
                      className="flex gap-3 p-3.5 hover:bg-slate-50/80 rounded-xl transition-colors group border border-transparent hover:border-slate-200"
                    >
                      <div className="text-indigo-400 font-bold mt-0.5 text-xs">
                        {i >= item.examples.length ? (
                          <Sparkles size={16} className="text-amber-500" />
                        ) : (
                          `${String.fromCharCode(65 + i)}.`
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-base text-slate-900 font-medium tracking-wide">
                          {ex.jp}
                        </p>
                        {showTranslations ? (
                          <p className="text-slate-600 text-xs md:text-sm mt-1">
                            {ex.en}
                          </p>
                        ) : (
                          <div className="mt-1.5 h-6 w-full md:w-3/4 bg-slate-100 rounded-md opacity-40 group-hover:opacity-100 transition-opacity flex items-center px-2 text-xs text-slate-400 italic">
                            Translation hidden (hover to check)
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>

                {/* AI Interaction Buttons */}
                <div className="mt-6 flex flex-wrap gap-2.5 border-t border-slate-100 pt-4">
                  <button
                    onClick={() => onGenerateExamples(item)}
                    disabled={loadingExamples[item.id]}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-semibold transition-colors border border-amber-200/80 disabled:opacity-50"
                  >
                    {loadingExamples[item.id] ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    {loadingExamples[item.id] ? 'Generating...' : 'AI: More Examples'}
                  </button>

                  <button
                    onClick={() => onExplainNuance(item)}
                    disabled={loadingExplanations[item.id] || aiExplanations[item.id]}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold transition-colors border border-indigo-200/80 disabled:opacity-50"
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
                    <h5 className="font-bold flex items-center gap-2 mb-1.5 text-indigo-900 text-sm">
                      <Lightbulb size={16} className="text-amber-500" />
                      Linguist's Note & Nuance
                    </h5>
                    {aiExplanations[item.id]}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
