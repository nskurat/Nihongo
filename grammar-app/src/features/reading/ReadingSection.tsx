import { useRef } from 'react';
import { BookOpenCheck, Compass, History } from 'lucide-react';
import { LevelType } from '../../types/japanese';
import { useReadingStudio } from './useReadingStudio';
import GeneratorPanel from './GeneratorPanel';
import PassageReader from './PassageReader';
import StoryLibrary from './StoryLibrary';
import StoryModal from './StoryModal';
import { rovingIndex } from '../../utils/rovingFocus';
import type { ReadingView } from '../../services/ai/readingSession';

const TABS: { id: ReadingView; label: string; icon: typeof Compass }[] = [
  { id: 'studio', label: 'Practice Studio', icon: Compass },
  { id: 'library', label: 'Story Library', icon: History },
];
const tabId = (view: ReadingView) => `reading-tab-${view}`;
const panelId = (view: ReadingView) => `reading-panel-${view}`;

interface ReadingSectionProps {
  activeLevel?: LevelType;
}

/** Reading Studio & Story Library: the header and tab switcher, composing the views. */
export default function ReadingSection({ activeLevel = 'N4' }: ReadingSectionProps) {
  const studio = useReadingStudio(activeLevel);
  const { activeTab, setActiveTab, savedHistory, modalStory, contentError } = studio;
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-6 animate-fade-in">
      {/* Top Workspace Header & Tab Selector */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600">
            <BookOpenCheck size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 text-xs font-bold rounded-md uppercase tracking-wider">
                {activeLevel} Immersion
              </span>
              <span className="text-xs text-slate-400">• AI Reading Comprehension</span>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
              Japanese Reading Studio & Library
            </h2>
          </div>
        </div>

        {/* Tab Switcher: a WAI-ARIA tablist (arrows / Home / End move between tabs) */}
        <div
          role="tablist"
          aria-label="Reading views"
          className="flex items-center bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full sm:w-auto"
        >
          {TABS.map((tab, i) => {
            const selected = activeTab === tab.id;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                role="tab"
                id={tabId(tab.id)}
                aria-selected={selected}
                aria-controls={panelId(tab.id)}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => {
                  const next = rovingIndex(e.key, i, TABS.length);
                  if (next === null) return;
                  e.preventDefault();
                  setActiveTab(TABS[next].id);
                  tabRefs.current[next]?.focus();
                }}
                className={`flex-1 sm:flex-initial px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 relative cursor-pointer ${
                  selected ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TabIcon size={14} aria-hidden="true" />
                <span>{tab.label}</span>
                {tab.id === 'library' && savedHistory.length > 0 && (
                  <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-700 text-[10px] font-extrabold rounded-full">
                    {savedHistory.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: PRACTICE STUDIO */}
      {/* ========================================================================= */}
      {activeTab === 'studio' && (
        <div role="tabpanel" id={panelId('studio')} aria-labelledby={tabId('studio')} className="space-y-6">
          {contentError && (
            <div role="alert" className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
              Couldn't load the {activeLevel} lessons, so passages can't target a lesson right now. General
              passages still work.
            </div>
          )}
          <GeneratorPanel studio={studio} />
          <PassageReader studio={studio} />
        </div>
      )}

      {activeTab === 'library' && (
        <div role="tabpanel" id={panelId('library')} aria-labelledby={tabId('library')}>
          <StoryLibrary studio={studio} />
        </div>
      )}

      {modalStory && <StoryModal studio={studio} />}
    </main>
  );
}
