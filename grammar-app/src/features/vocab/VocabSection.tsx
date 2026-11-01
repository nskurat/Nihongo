import { Sparkles, Loader2, Info } from 'lucide-react';
import MarkdownViewer from '../../components/common/MarkdownViewer';
import AiErrorNote from '../../components/common/AiErrorNote';
import { LevelType } from '../../types/japanese';
import { useVocab } from './useVocab';
import { useAppStore } from '../../store/useAppStore';
import { focusCardClass, useFocusItem } from '../useFocusItem';
import { useScrollRestore } from '../useScrollRestore';
import SectionLayout from '../../components/layout/SectionLayout';
import { FromSearchPill } from '../search/SearchReturnBar';

interface VocabSectionProps {
  activeLevel: LevelType;
  activeLesson: number;
}

export default function VocabSection({ activeLevel, activeLesson }: VocabSectionProps) {
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
    handleGenerateVocabHelp,
    vocabNotes,
  } = useVocab(activeLevel, activeLesson);
  const focus = useFocusItem(!loading, () => setSearchQuery(''));
  useScrollRestore(!loading);

  return (
    <SectionLayout
      section="vocab"
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
      {/* Vocabulary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredContent.map((item) => (
          <div
            key={item.uid}
            data-uid={item.uid}
            tabIndex={-1}
            className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:border-emerald-300 transition-all flex flex-col justify-between group scroll-mt-32 max-md:scroll-mt-60 focus:outline-none ${focusCardClass(item.uid, focus)}`}
          >
            <div className="p-4 md:p-5 flex-grow">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <span className="text-xs font-bold text-slate-400 block mb-0.5 tracking-wider">
                    {item.reading}
                  </span>
                  <h3 className="text-2xl font-bold text-emerald-950 leading-none">
                    <span lang="ja">{item.word}</span>
                    {focus.focusUid === item.uid && <FromSearchPill />}
                  </h3>
                </div>

              </div>

              <p className="text-slate-700 font-medium text-sm border-l-2 border-emerald-400 pl-3 py-0.5">
                {showTranslations ? item.meaning : '••••••••••••'}
              </p>

              {/* Example Sentence */}
              {item.exampleJp && (
                <div className="mt-3 bg-slate-50/60 p-2.5 rounded-lg border border-slate-100">
                  <div className="font-bold text-slate-800 text-sm">{item.exampleJp}</div>
                  {showTranslations && item.exampleEn && (
                    <div className="text-slate-600 text-xs mt-0.5">{item.exampleEn}</div>
                  )}
                </div>
              )}

              {/* AI Explanation Note if it exists */}
              {vocabNotes.get(item.uid) && (
                <div className="mt-4 bg-emerald-50/50 p-3 rounded-lg border border-emerald-100 text-xs text-slate-700 animate-fade-in">
                  <div className="font-bold text-emerald-800 mb-1 flex items-center gap-1">
                    <Info size={14} /> Usage Note
                  </div>
                  <MarkdownViewer content={vocabNotes.get(item.uid) ?? ''} />
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="bg-slate-50/80 px-4 py-2.5 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => handleGenerateVocabHelp(item)}
                disabled={vocabNotes.isLoading(item.uid) || !!vocabNotes.get(item.uid)}
                className="flex items-center gap-1.5 px-3 py-1.5 max-md:min-h-10 bg-white hover:bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold transition-colors border border-slate-200 hover:border-emerald-200 disabled:opacity-50 cursor-pointer shadow-2xs"
              >
                {vocabNotes.isLoading(item.uid) ? (
                  <Loader2 className="animate-spin" size={13} />
                ) : (
                  <Sparkles size={13} />
                )}
                {vocabNotes.isLoading(item.uid)
                  ? 'Thinking...'
                  : vocabNotes.get(item.uid)
                  ? 'Note Generated'
                  : 'AI: Explain Usage'}
              </button>
            </div>
            {vocabNotes.errorOf(item.uid) && (
              <div className="bg-slate-50/80 px-4 pb-3">
                <AiErrorNote message={vocabNotes.errorOf(item.uid)} />
              </div>
            )}
          </div>
        ))}
      </div>
    </SectionLayout>
  );
}
