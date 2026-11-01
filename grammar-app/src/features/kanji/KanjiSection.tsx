import { Sparkles, Loader2, Info, Layers, Hash, Languages, ExternalLink } from 'lucide-react';
import MarkdownViewer from '../../components/common/MarkdownViewer';
import { LevelType, KanjiCompound } from '../../types/japanese';
import { useKanji } from './useKanji';
import { useAppStore } from '../../store/useAppStore';
import { focusCardClass, useFocusItem } from '../useFocusItem';
import { useScrollRestore } from '../useScrollRestore';
import SectionLayout from '../../components/layout/SectionLayout';
import { FromSearchPill } from '../search/SearchReturnBar';

interface KanjiSectionProps {
  activeLevel: LevelType;
  activeLesson: number;
}

export default function KanjiSection({ activeLevel, activeLesson }: KanjiSectionProps) {
  const { showTranslations } = useAppStore();

  const {
    searchQuery,
    setSearchQuery,
    totalLessons,
    lessonCounts,
    filteredContent,
    currentContent,
    loading,
    error,
    retry,
    handleGenerateKanjiMnemonic,
    aiKanjiMnemonics,
    loadingKanjiAi,
  } = useKanji(activeLevel, activeLesson);
  const focus = useFocusItem(!loading, () => setSearchQuery(''));
  useScrollRestore(!loading);

  return (
    <SectionLayout
      section="kanji"
      level={activeLevel}
      lesson={activeLesson}
      lessons={totalLessons}
      lessonCounts={lessonCounts}
      loading={loading}
      error={error}
      retry={retry}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      shownCount={filteredContent.length}
      totalCount={currentContent.length}
    >
      {/* Kanji Grid List */}
      <div className="grid grid-cols-1 gap-5">
        {filteredContent.map((item) => (
          <div
            key={item.uid}
            data-uid={item.uid}
            tabIndex={-1}
            className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:border-rose-300 transition-all flex flex-col md:flex-row group scroll-mt-32 max-md:scroll-mt-60 focus:outline-none ${focusCardClass(item.uid, focus)}`}
          >
            {/* Left Canvas - The Kanji itself */}
            <div className="bg-gradient-to-br from-rose-50 to-white md:w-48 p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-rose-100 shrink-0">
              {focus.focusUid === item.uid && (
                <div className="mb-2 -ml-2">
                  <FromSearchPill />
                </div>
              )}
              <div lang="ja" className="text-7xl font-bold text-slate-800 drop-shadow-sm mb-3">
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
                      <div className="font-semibold text-slate-700">{item.onyomi?.length ? item.onyomi.join('、') : '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <Layers size={12} /> Kunyomi
                      </div>
                      <div className="font-semibold text-slate-700">{item.kunyomi?.length ? item.kunyomi.join('、') : '—'}</div>
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
                              {showTranslations ? (ex.meaning ?? '—') : '••••'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* AI Generated Mnemonic */}
                {aiKanjiMnemonics[item.uid] && (
                  <div className="mt-2 bg-rose-50/50 p-3.5 rounded-lg border border-rose-100 text-sm text-slate-700 animate-fade-in shadow-xs mb-4">
                    <div className="font-bold text-rose-800 mb-1.5 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                      <Info size={14} className="text-rose-500" /> Story / Mnemonic Hook
                    </div>
                    <MarkdownViewer content={aiKanjiMnemonics[item.uid]} />
                  </div>
                )}
              </div>

              {/* AI Mnemonic Button */}
              <div className="pt-3 border-t border-slate-100 mt-auto flex items-center justify-between">
                <button
                  onClick={() => handleGenerateKanjiMnemonic(item)}
                  disabled={loadingKanjiAi[item.uid] || !!aiKanjiMnemonics[item.uid]}
                  className="flex items-center gap-1.5 px-3 py-1.5 max-md:min-h-10 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold transition-colors border border-rose-200/80 disabled:opacity-50 cursor-pointer shadow-2xs"
                >
                  {loadingKanjiAi[item.uid] ? (
                    <Loader2 className="animate-spin" size={14} />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  {loadingKanjiAi[item.uid]
                    ? 'Creating Story...'
                    : aiKanjiMnemonics[item.uid]
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
    </SectionLayout>
  );
}
