import { Sparkles, Lightbulb, Loader2, BookOpen, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';
import GrammarDetailModal from './GrammarDetailModal';
import MarkdownViewer from '../../components/common/MarkdownViewer';
import AiErrorNote from '../../components/common/AiErrorNote';
import TagBadge from '../../components/common/TagBadge';
import { LevelType } from '../../types/japanese';
import { isSectionAvailable } from '../../utils/levels';
import { SECTIONS } from '../../utils/sections';
import { useGrammar } from './useGrammar';
import { useAppStore } from '../../store/useAppStore';
import { focusCardClass, useFocusItem } from '../useFocusItem';
import { useScrollRestore } from '../useScrollRestore';
import SectionLayout from '../../components/layout/SectionLayout';
import { FromSearchPill } from '../search/SearchReturnBar';
import { buildSearchPath } from '../search/searchUrl';
import { S } from '../search/strings';

interface GrammarSectionProps {
  activeLevel: LevelType;
  activeLesson: number;
}

const OTHER_SECTIONS = SECTIONS.filter((s) => s.id !== 'grammar');

// ["Vocabulary", "kanji", "reading practice"] -> "Vocabulary, kanji and reading practice"
function listSections(labels: string[]): string {
  const [first, ...rest] = labels;
  const sentence = rest.length === 0 ? first : `${[first, ...rest.slice(0, -1)].join(', ')} and ${rest[rest.length - 1]}`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

export default function GrammarSection({ activeLevel, activeLesson }: GrammarSectionProps) {
  const { showTranslations } = useAppStore();
  const missingSections = OTHER_SECTIONS.filter((s) => !isSectionAvailable(activeLevel, s.id)).map((s) => s.noun);

  const {
    searchQuery,
    setSearchQuery,
    selectedDetailItem,
    setSelectedDetailItem,
    totalLessons,
    lessonCounts,
    filteredContent,
    currentContent,
    loading,
    error,
    retry,
    handleGenerateExamples,
    handleExplainNuance,
    examples,
    nuance,
  } = useGrammar(activeLevel, activeLesson);
  const focus = useFocusItem(!loading, () => setSearchQuery(''));
  useScrollRestore(!loading);

  return (
    <>
      <SectionLayout
        section="grammar"
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
        bannerExtra={
          <>
            <p className="text-slate-500 text-sm mt-1">
              Explore grammar patterns, conjugation formulas, nuances, and AI-powered examples.
            </p>
            {missingSections.length > 0 && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5 mt-2">
                {missingSections.length === 3 && `${activeLevel} covers grammar only. `}
                {listSections(missingSections)} {missingSections.length === 1 ? 'is' : 'are'} not available for{' '}
                {activeLevel} yet.
              </p>
            )}
          </>
        }
        sidebarFooter={
          <div className="hidden lg:block border-t border-slate-200 p-2">
            <Link
              to={buildSearchPath({ types: ['grammar'] })}
              state={{ searchEntry: true }}
              className="flex items-center px-3.5 py-2 max-md:min-h-10 rounded-lg text-sm font-semibold text-indigo-700 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            >
              {S.browseByFunction}
            </Link>
          </div>
        }
      >
        {/* Grammar Cards List */}
        {filteredContent.map((item, index) => (
          <div
            key={item.uid}
            data-uid={item.uid}
            tabIndex={-1}
            className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all hover:border-slate-300 scroll-mt-32 max-md:scroll-mt-60 focus:outline-none ${focusCardClass(item.uid, focus)}`}
          >
            {/* Card Header */}
            <div className="bg-gradient-to-r from-indigo-50/80 via-white to-slate-50 p-5 border-b border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="bg-indigo-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold flex-shrink-0 mt-0.5 shadow-sm text-sm">
                  {index + 1}
                </div>
                <div>
                  <h3 className="text-xl md:text-2xl font-bold text-indigo-950">
                    <span lang="ja">{item.title}</span>
                    {focus.focusUid === item.uid && <FromSearchPill />}
                  </h3>
                  <p className="text-indigo-600 font-medium mt-1 text-base flex items-center gap-1.5">
                    {showTranslations ? item.meaning : '••••••••••••'}
                  </p>
                  {/* Tag Badges */}
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {item.tags.map(tagId => (
                        <TagBadge key={tagId} tagId={tagId} to={buildSearchPath({ tag: tagId })} />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* View Deep Dive breakdown button */}
              <button
                onClick={() => setSelectedDetailItem(item)}
                data-focus-target={focus.focusUid === item.uid ? '' : undefined}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 max-md:min-h-10 bg-white hover:bg-indigo-50 text-indigo-700 font-semibold text-xs rounded-lg border border-indigo-200 shadow-2xs transition-all cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
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
              {(examples.get(item.uid)?.length ?? 0) > 0 && (
                <div className="space-y-2 pt-2 border-t border-amber-100 animate-fade-in">
                  <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles size={13} /> AI Practice Examples
                  </h4>
                  <div className="space-y-2">
                    {(examples.get(item.uid) ?? []).map((ex, idx) => (
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
                  disabled={examples.isLoading(item.uid)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 max-md:min-h-10 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-semibold transition-colors border border-amber-200/80 disabled:opacity-50 cursor-pointer"
                >
                  {examples.isLoading(item.uid) ? (
                    <Loader2 className="animate-spin" size={14} />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  {examples.isLoading(item.uid) ? 'Generating...' : 'AI: More Examples'}
                </button>

                <button
                  onClick={() => handleExplainNuance(item)}
                  disabled={nuance.isLoading(item.uid) || !!nuance.get(item.uid)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 max-md:min-h-10 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold transition-colors border border-indigo-200/80 disabled:opacity-50 cursor-pointer"
                >
                  {nuance.isLoading(item.uid) ? (
                    <Loader2 className="animate-spin" size={14} />
                  ) : (
                    <Lightbulb size={14} />
                  )}
                  {nuance.isLoading(item.uid)
                    ? 'Analyzing...'
                    : nuance.get(item.uid)
                    ? 'Nuance Explained'
                    : 'AI: Explain Nuances'}
                </button>
              </div>
              <AiErrorNote message={examples.errorOf(item.uid) ?? nuance.errorOf(item.uid)} />

              {/* AI Nuance Explanation Box */}
              {nuance.get(item.uid) && (
                <div className="mt-4 bg-gradient-to-r from-indigo-50/70 to-slate-50 p-4 md:p-5 rounded-xl border border-indigo-100 text-slate-700 text-xs md:text-sm leading-relaxed shadow-xs">
                  <h5 className="font-bold flex items-center gap-2 mb-2 text-indigo-900 text-sm">
                    <Lightbulb size={16} className="text-amber-500" />
                    Linguist's Note & Nuance
                  </h5>
                  <MarkdownViewer content={nuance.get(item.uid) ?? ''} className="text-xs md:text-sm text-slate-700 leading-relaxed" />
                </div>
              )}
            </div>
          </div>
        ))}
      </SectionLayout>

      {/* Deep Dive Breakdown Modal */}
      {selectedDetailItem && (
        <GrammarDetailModal
          isOpen={!!selectedDetailItem}
          onClose={() => setSelectedDetailItem(null)}
          item={selectedDetailItem}
          activeLevel={activeLevel}
          showTranslations={showTranslations}
          onGenerateExplanation={handleExplainNuance}
          loadingExplanation={nuance.isLoading(selectedDetailItem.uid)}
          aiExplanation={nuance.get(selectedDetailItem.uid)}
          explanationError={nuance.errorOf(selectedDetailItem.uid)}
        />
      )}
    </>
  );
}
