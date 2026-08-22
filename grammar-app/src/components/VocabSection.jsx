import React, { useState, useEffect } from 'react';
import { BookText, ArrowRight, Sparkles, Loader2, Search, Info, Volume2, Tag, Bookmark } from 'lucide-react';

export default function VocabSection({
  vocabData = {},
  activeLesson,
  setActiveLesson,
  showTranslations,
  activeLevel,
  onGenerateVocabHelp,
  loadingVocabAi,
  aiVocabNotes,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'

  const totalLessons = Object.keys(vocabData).map(Number).sort((a, b) => a - b);

  // If current active lesson has no vocabulary for this level, select first available
  useEffect(() => {
    if (totalLessons.length > 0 && !vocabData[activeLesson]) {
      setActiveLesson(totalLessons[0]);
    }
  }, [vocabData, activeLesson, totalLessons.length, setActiveLesson]);

  const currentVocabList = vocabData[activeLesson] || [];

  // Filter vocabulary by search query
  const filteredVocab = searchQuery.trim()
    ? currentVocabList.filter(
        (v) =>
          v.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
          v.reading.toLowerCase().includes(searchQuery.toLowerCase()) ||
          v.meaning.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (v.romaji && v.romaji.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : currentVocabList;

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in">
      {/* Sidebar / Lesson Selection */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden lg:sticky lg:top-28">
          <div className="p-4 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookText size={18} className="text-indigo-600" />
              <h2 className="font-semibold text-slate-800 text-sm">
                {activeLevel} Lessons ({totalLessons[0] || 1}–{totalLessons[totalLessons.length - 1] || 1})
              </h2>
            </div>
            <span className="text-xs bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full">
              {totalLessons.length}
            </span>
          </div>

          <ul className="flex flex-row lg:flex-col p-2 gap-1.5 overflow-x-auto lg:overflow-y-auto lg:max-h-[70vh] scrollbar-thin scrollbar-thumb-indigo-200">
            {totalLessons.length > 0 ? (
              totalLessons.map((lesson) => {
                const count = (vocabData[lesson] || []).length;
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
              })
            ) : (
              <div className="p-4 text-xs text-slate-400 text-center">No lessons configured yet</div>
            )}
          </ul>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="lg:col-span-3 space-y-6">
        {/* Banner */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-md uppercase tracking-wide">
                {activeLevel} Vocabulary
              </span>
              <span className="text-xs text-slate-400">• Minna no Nihongo</span>
            </div>
            <h2 className="text-3xl font-extrabold text-slate-800 border-b-4 border-emerald-500 pb-1 inline-block mt-2">
              Lesson {activeLesson}
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              Core vocabulary, readings, parts of speech, and contextual example sentences.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search word, kana, meaning..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full sm:w-56"
              />
            </div>
            <div className="px-3.5 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100 text-emerald-700 font-semibold text-xs text-center whitespace-nowrap">
              {currentVocabList.length} Words
            </div>
          </div>
        </div>

        {/* Empty State */}
        {filteredVocab.length === 0 && (
          <div className="bg-white p-12 rounded-xl border border-dashed border-slate-300 text-center space-y-3">
            <Info size={36} className="mx-auto text-slate-400" />
            <h4 className="text-lg font-bold text-slate-700">No vocabulary found</h4>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              {searchQuery
                ? `No vocabulary matches "${searchQuery}" in Lesson ${activeLesson}.`
                : `Vocabulary content for Lesson ${activeLesson} is being prepared. Structure is in place and will be updated soon.`}
            </p>
          </div>
        )}

        {/* Vocab Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredVocab.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between hover:border-slate-300 transition-all group"
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-xs text-slate-400 font-medium">{item.reading}</span>
                    <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">{item.word}</h3>
                    {item.romaji && (
                      <span className="text-xs font-mono text-slate-400 italic">/{item.romaji}/</span>
                    )}
                  </div>
                  {item.pos && (
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full border border-slate-200">
                      {item.pos}
                    </span>
                  )}
                </div>

                <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                    Meaning
                  </div>
                  <div className="text-slate-800 font-medium text-sm">
                    {showTranslations ? (
                      item.meaning
                    ) : (
                      <span className="text-slate-400 italic text-xs">Hidden (Click to show)</span>
                    )}
                  </div>
                </div>

                {item.exampleJp && (
                  <div className="mt-3 text-xs border-t border-slate-100 pt-3">
                    <p className="text-slate-900 font-medium">{item.exampleJp}</p>
                    {showTranslations && item.exampleEn && (
                      <p className="text-slate-500 mt-0.5">{item.exampleEn}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => onGenerateVocabHelp(item)}
                  disabled={loadingVocabAi[item.id]}
                  className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors border border-emerald-200/60 disabled:opacity-50"
                >
                  {loadingVocabAi[item.id] ? (
                    <Loader2 className="animate-spin" size={13} />
                  ) : (
                    <Sparkles size={13} />
                  )}
                  {loadingVocabAi[item.id] ? 'Generating...' : 'AI: Usage Note'}
                </button>
              </div>

              {aiVocabNotes[item.id] && (
                <div className="mt-3 bg-emerald-50/70 p-3 rounded-lg border border-emerald-100 text-xs text-slate-700 leading-relaxed animate-fade-in">
                  <span className="font-bold text-emerald-900 block mb-1">AI Note:</span>
                  {aiVocabNotes[item.id]}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
