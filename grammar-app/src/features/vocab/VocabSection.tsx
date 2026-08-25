import { BookText, ArrowRight, Sparkles, Loader2, Search, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MarkdownViewer from '../../components/common/MarkdownViewer';
import { LevelType } from '../../types/japanese';
import { useVocab } from './useVocab';
import { useAppStore } from '../../store/useAppStore';

interface VocabSectionProps {
  activeLevel: LevelType;
  activeLesson: number;
}

export default function VocabSection({ activeLevel, activeLesson }: VocabSectionProps) {
  const navigate = useNavigate();
  const { showTranslations } = useAppStore();

  const {
    searchQuery,
    setSearchQuery,
    totalLessons,
    currentLevelData,
    filteredContent,
    currentContent,
    handleGenerateVocabHelp,
    aiVocabNotes,
    loadingVocabAi,
  } = useVocab(activeLevel, activeLesson);

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in">
      {/* Sidebar / Lesson Selection */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden lg:sticky lg:top-28">
          <div className="p-4 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookText size={18} className="text-emerald-600" />
              <h2 className="font-semibold text-slate-800 text-sm">
                {activeLevel} Vocab ({totalLessons[0] || 1}–{totalLessons[totalLessons.length - 1] || 1})
              </h2>
            </div>
          </div>

          <ul className="flex flex-row lg:flex-col p-2 gap-1.5 overflow-x-auto lg:overflow-y-auto lg:max-h-[70vh] scrollbar-thin scrollbar-thumb-emerald-200">
            {totalLessons.map((lesson) => {
              const count = (currentLevelData[lesson] || []).length;
              return (
                <li key={lesson} className="min-w-fit">
                  <button
                    onClick={() => navigate(`/${activeLevel.toLowerCase()}/vocab/${lesson}`)}
                    className={`w-full flex items-center justify-between text-left px-3.5 py-2.5 rounded-lg transition-all text-sm cursor-pointer ${
                      activeLesson === lesson
                        ? 'bg-emerald-600 text-white shadow-md font-semibold'
                        : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-900'
                    }`}
                  >
                    <span>Lesson {lesson}</span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded-full ${
                          activeLesson === lesson
                            ? 'bg-emerald-700/80 text-emerald-100'
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
              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-md uppercase tracking-wide">
                {activeLevel} Level
              </span>
              <span className="text-xs text-slate-400">• Vocabulary List</span>
            </div>
            <h2 className="text-3xl font-extrabold text-slate-800 border-b-4 border-emerald-500 pb-1 inline-block mt-2">
              Lesson {activeLesson}
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search word, reading, meaning..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full sm:w-64"
              />
            </div>
            <div className="px-3.5 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100 text-emerald-700 font-semibold text-xs text-center whitespace-nowrap">
              {currentContent.length} Words
            </div>
          </div>
        </div>

        {/* Empty State */}
        {filteredContent.length === 0 && (
          <div className="bg-white p-12 rounded-xl border border-dashed border-slate-300 text-center space-y-3">
            <h4 className="text-lg font-bold text-slate-700">No vocabulary found</h4>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              {searchQuery
                ? `No results match your search "${searchQuery}".`
                : `Vocabulary for Lesson ${activeLesson} is currently being prepared.`}
            </p>
          </div>
        )}

        {/* Vocabulary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredContent.map((item) => (
            <div
              key={item.uid}
              className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:border-emerald-300 transition-all flex flex-col justify-between group"
            >
              <div className="p-4 md:p-5 flex-grow">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <span className="text-xs font-bold text-slate-400 block mb-0.5 tracking-wider">
                      {item.reading}
                    </span>
                    <h3 className="text-2xl font-bold text-emerald-950 leading-none">
                      {item.word}
                    </h3>
                  </div>

                </div>

                <p className="text-slate-700 font-medium text-sm border-l-2 border-emerald-400 pl-3 py-0.5">
                  {showTranslations ? item.meaning : '••••••••••••'}
                </p>

                {/* AI Explanation Note if it exists */}
                {aiVocabNotes[item.id!] && (
                  <div className="mt-4 bg-emerald-50/50 p-3 rounded-lg border border-emerald-100 text-xs text-slate-700 animate-fade-in">
                    <div className="font-bold text-emerald-800 mb-1 flex items-center gap-1">
                      <Info size={14} /> Usage Note
                    </div>
                    <MarkdownViewer content={aiVocabNotes[item.id!]} />
                  </div>
                )}
              </div>

              {/* Action Bar */}
              <div className="bg-slate-50/80 px-4 py-2.5 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => handleGenerateVocabHelp(item)}
                  disabled={loadingVocabAi[item.id!] || !!aiVocabNotes[item.id!]}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold transition-colors border border-slate-200 hover:border-emerald-200 disabled:opacity-50 cursor-pointer shadow-2xs"
                >
                  {loadingVocabAi[item.id!] ? (
                    <Loader2 className="animate-spin" size={13} />
                  ) : (
                    <Sparkles size={13} />
                  )}
                  {loadingVocabAi[item.id!]
                    ? 'Thinking...'
                    : aiVocabNotes[item.id!]
                    ? 'Note Generated'
                    : 'AI: Explain Usage'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
