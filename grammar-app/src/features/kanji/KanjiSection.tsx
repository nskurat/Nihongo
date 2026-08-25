import { Search, Sparkles, Loader2, Info, Layers, Hash, Languages, ArrowRight, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MarkdownViewer from '../../components/common/MarkdownViewer';
import { LevelType, KanjiCompound } from '../../types/japanese';
import { useKanji } from './useKanji';
import { useAppStore } from '../../store/useAppStore';

interface KanjiSectionProps {
  activeLevel: LevelType;
  activeLesson: number;
}

export default function KanjiSection({ activeLevel, activeLesson }: KanjiSectionProps) {
  const navigate = useNavigate();
  const { showTranslations } = useAppStore();

  const {
    searchQuery,
    setSearchQuery,
    totalLessons,
    currentLevelData,
    filteredContent,
    currentContent,
    handleGenerateKanjiMnemonic,
    aiKanjiMnemonics,
    loadingKanjiAi,
  } = useKanji(activeLevel, activeLesson);

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in">
      {/* Sidebar / Lesson Selection */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden lg:sticky lg:top-28">
          <div className="p-4 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Languages size={18} className="text-rose-600" />
              <h2 className="font-semibold text-slate-800 text-sm">
                {activeLevel} Kanji ({totalLessons[0] || 1}–{totalLessons[totalLessons.length - 1] || 1})
              </h2>
            </div>
          </div>

          <ul className="flex flex-row lg:flex-col p-2 gap-1.5 overflow-x-auto lg:overflow-y-auto lg:max-h-[70vh] scrollbar-thin scrollbar-thumb-rose-200">
            {totalLessons.map((lesson) => {
              const count = (currentLevelData[lesson] || []).length;
              return (
                <li key={lesson} className="min-w-fit">
                  <button
                    onClick={() => navigate(`/${activeLevel.toLowerCase()}/kanji/${lesson}`)}
                    className={`w-full flex items-center justify-between text-left px-3.5 py-2.5 rounded-lg transition-all text-sm cursor-pointer ${
                      activeLesson === lesson
                        ? 'bg-rose-600 text-white shadow-md font-semibold'
                        : 'text-slate-600 hover:bg-rose-50 hover:text-rose-900'
                    }`}
                  >
                    <span>Lesson {lesson}</span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded-full ${
                          activeLesson === lesson
                            ? 'bg-rose-700/80 text-rose-100'
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
              <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 text-xs font-bold rounded-md uppercase tracking-wide">
                {activeLevel} Level
              </span>
              <span className="text-xs text-slate-400">• Kanji List</span>
            </div>
            <h2 className="text-3xl font-extrabold text-slate-800 border-b-4 border-rose-500 pb-1 inline-block mt-2">
              Lesson {activeLesson}
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search kanji, reading, meaning..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 w-full sm:w-64"
              />
            </div>
            <div className="px-3.5 py-1.5 bg-rose-50 rounded-lg border border-rose-100 text-rose-700 font-semibold text-xs text-center whitespace-nowrap">
              {currentContent.length} Kanji
            </div>
          </div>
        </div>

        {/* Empty State */}
        {filteredContent.length === 0 && (
          <div className="bg-white p-12 rounded-xl border border-dashed border-slate-300 text-center space-y-3">
            <h4 className="text-lg font-bold text-slate-700">No kanji found</h4>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              {searchQuery
                ? `No results match your search "${searchQuery}".`
                : `Kanji for Lesson ${activeLesson} are currently being prepared.`}
            </p>
          </div>
        )}

        {/* Kanji Grid List */}
        <div className="grid grid-cols-1 gap-5">
          {filteredContent.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:border-rose-300 transition-all flex flex-col md:flex-row group"
            >
              {/* Left Canvas - The Kanji itself */}
              <div className="bg-gradient-to-br from-rose-50 to-white md:w-48 p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-rose-100 shrink-0">
                <div className="text-7xl font-bold text-slate-800 drop-shadow-sm mb-3">
                  {item.kanji}
                </div>
                <div className="bg-rose-100/80 text-rose-800 px-3 py-1 rounded-full text-xs font-bold tracking-wide border border-rose-200">
                  {showTranslations ? item.meaning : '••••••••••••'}
                </div>
              </div>

              {/* Right Content */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    {/* Readings */}
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                          <Languages size={12} /> Onyomi
                        </div>
                        <div className="font-semibold text-slate-700">{item.onyomi || '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                          <Layers size={12} /> Kunyomi
                        </div>
                        <div className="font-semibold text-slate-700">{item.kunyomi || '—'}</div>
                      </div>
                    </div>
                    
                    {/* Examples / Compounds */}
                    {item.compounds && item.compounds.length > 0 && (
                      <div className="bg-slate-50/50 rounded-lg p-3 border border-slate-100 h-full">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Hash size={12} /> Compounds
                        </div>
                        <ul className="space-y-1.5">
                          {item.compounds.slice(0, 3).map((ex: KanjiCompound, idx: number) => (
                            <li key={idx} className="flex justify-between items-center text-sm border-b border-slate-200/50 last:border-0 pb-1.5 last:pb-0">
                              <span className="font-bold text-slate-700">{ex.word}</span>
                              <span className="text-slate-500 text-xs">
                                {showTranslations ? ex.meaning : '••••'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* AI Generated Mnemonic */}
                  {aiKanjiMnemonics[item.id] && (
                    <div className="mt-2 bg-rose-50/50 p-3.5 rounded-lg border border-rose-100 text-sm text-slate-700 animate-fade-in shadow-xs mb-4">
                      <div className="font-bold text-rose-800 mb-1.5 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                        <Info size={14} className="text-rose-500" /> Story / Mnemonic Hook
                      </div>
                      <MarkdownViewer content={aiKanjiMnemonics[item.id]} />
                    </div>
                  )}
                </div>

                {/* AI Mnemonic Button */}
                <div className="pt-3 border-t border-slate-100 mt-auto flex items-center justify-between">
                  <button
                    onClick={() => handleGenerateKanjiMnemonic(item)}
                    disabled={loadingKanjiAi[item.id] || !!aiKanjiMnemonics[item.id]}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold transition-colors border border-rose-200/80 disabled:opacity-50 cursor-pointer shadow-2xs"
                  >
                    {loadingKanjiAi[item.id] ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    {loadingKanjiAi[item.id]
                      ? 'Creating Story...'
                      : aiKanjiMnemonics[item.id]
                      ? 'Mnemonic Saved'
                      : 'AI: Create Mnemonic Story'}
                  </button>

                  <a 
                    href={`https://jisho.org/search/${item.kanji}%20%23kanji`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-slate-400 hover:text-rose-600 transition-colors text-xs font-semibold"
                  >
                    <span>Jisho</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
