import { useEffect, useRef } from 'react';
import { Eye, EyeOff, GraduationCap, Bot } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getActiveProviderId, getProvider, getStoredApiKey } from '../../services/ai/registry';
import { LevelType, SectionType } from '../../types/japanese';
import { useAppStore } from '../../store/useAppStore';
import { useAiUiStore } from '../../store/useAiStore';
import { parseLevel, getDefaultLesson, clampLessonForLevel, isSectionAvailable } from '../../utils/levels';
import { SECTIONS } from '../../utils/sections';
import HeaderSearch, { MobileSearchButton, type SearchEntryState } from './HeaderSearch';
import { isSearchPath, SEARCH_PATH } from '../../features/search/searchUrl';
import { prefetchSearchIndex } from '../../features/search/searchClient';
import { searchNav } from '../../features/search/searchUiStore';
import { MD_QUERY, useMediaQuery } from '../../features/search/useMediaQuery';

const LESSON_SECTIONS = ['grammar', 'vocab', 'kanji', 'reading'];

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const { showTranslations, setShowTranslations, lastLesson, setLastLesson } = useAppStore();
  const { setShowKeyModal } = useAiUiStore();
  const onSearch = isSearchPath(location.pathname);
  const isDesktop = useMediaQuery(MD_QUERY);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Extract route parameters directly from location.pathname
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const rawLevel = pathSegments[0]?.toUpperCase();
  const rawSection = pathSegments[1]?.toLowerCase();
  const rawLesson = pathSegments[2];

  // On /search there is no lesson in the path: the last visited lesson stands in (its level
  // is the ranking level the badge shows, and the pills/tabs navigate relative to it).
  const activeLevel: LevelType = onSearch ? lastLesson.level : parseLevel(rawLevel);
  const activeSection: SectionType = onSearch
    ? lastLesson.section
    : ((LESSON_SECTIONS.includes(rawSection) ? rawSection : 'grammar') as SectionType);
  const activeLesson = onSearch ? String(lastLesson.lesson) : rawLesson || String(getDefaultLesson(activeLevel));
  const isLessonRoute = !onSearch && /^n[1-5]$/i.test(rawLevel ?? '') && LESSON_SECTIONS.includes(rawSection);

  useEffect(() => {
    if (!isLessonRoute) return;
    const lesson = clampLessonForLevel(activeLevel, parseInt(activeLesson, 10));
    if (lastLesson.level !== activeLevel || lastLesson.section !== activeSection || lastLesson.lesson !== lesson) {
      setLastLesson({ level: activeLevel, section: activeSection, lesson });
    }
  }, [isLessonRoute, activeLevel, activeSection, activeLesson, lastLesson, setLastLesson]);

  const openSearch = () => {
    // Focus synchronously inside the tap so iOS opens the keyboard, then route.
    searchInputRef.current?.focus();
    prefetchSearchIndex(lastLesson.level);
    if (searchNav.entering) return;
    searchNav.entering = true;
    const entry: SearchEntryState = { searchEntry: true };
    navigate(SEARCH_PATH, { state: entry });
  };

  const levels: Array<{ id: LevelType; label: string; desc: string }> = (
    [
      { id: 'N5', label: 'JLPT N5', desc: 'Beginner I' },
      { id: 'N4', label: 'JLPT N4', desc: 'Beginner II' },
      { id: 'N3', label: 'JLPT N3', desc: 'Intermediate I' },
      { id: 'N2', label: 'JLPT N2', desc: 'Upper Intermediate' },
      { id: 'N1', label: 'JLPT N1', desc: 'Advanced' },
    ] as const
  ).map((lvl) => ({
    ...lvl,
    desc: isSectionAvailable(lvl.id, 'vocab') ? lvl.desc : `${lvl.desc} (grammar only)`,
  }));

  const sections = SECTIONS.filter((sec) => isSectionAvailable(activeLevel, sec.id));

  const provider = getProvider(getActiveProviderId());
  const hasKey = !provider.requiresKey || !!getStoredApiKey(provider.id);

  const handleLevelChange = (newLevel: LevelType) => {
    // When switching levels, default to their starting lesson if current isn't valid for new level
    const newLesson = clampLessonForLevel(newLevel, parseInt(activeLesson, 10));
    const newSection = isSectionAvailable(newLevel, activeSection) ? activeSection : 'grammar';

    // Reading's Story Library stays open across a level switch; its filter is dropped so it
    // follows the new level.
    const keepLibrary =
      newSection === 'reading' && new URLSearchParams(location.search).get('view') === 'library';

    navigate(`/${newLevel.toLowerCase()}/${newSection}/${newLesson}${keepLibrary ? '?view=library' : ''}`);
  };

  const handleSectionChange = (newSection: SectionType) => {
    navigate(`/${activeLevel.toLowerCase()}/${newSection}/${activeLesson}`);
  };

  return (
    <header className="bg-indigo-600 text-white shadow-lg sticky top-0 z-20 transition-all">
      {/* Top Banner */}
      <div
        className={`max-w-6xl mx-auto px-4 py-3 md:py-4 flex flex-col md:flex-row justify-between items-center gap-3 border-b border-indigo-500/50 ${
          onSearch ? 'max-md:hidden' : ''
        }`}
      >
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-3 max-md:w-full">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/20">
              <GraduationCap size={24} className="text-indigo-100" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                Japanese Study Guide <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500 border border-indigo-400/80">{activeLevel}</span>
              </h1>
              <p className="text-indigo-200 text-xs font-medium max-md:hidden">
                JLPT N5–N1 Interactive Reference & AI Practice
              </p>
            </div>
            <div className="ml-auto md:hidden">
              <MobileSearchButton onOpen={openSearch} />
            </div>
          </div>

          {/* Level Switcher (Pill Selector) */}
          <div className="flex items-center bg-indigo-800/60 p-1 rounded-xl border border-indigo-400/30 max-md:w-full">
            {levels.map((lvl) => (
              <button
                key={lvl.id}
                onClick={() => handleLevelChange(lvl.id)}
                className={`px-3 py-1 max-md:min-h-10 max-md:flex-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeLevel === lvl.id
                    ? 'bg-white text-indigo-700 shadow-md transform scale-105'
                    : 'text-indigo-200 hover:text-white hover:bg-white/10'
                }`}
                title={lvl.desc}
              >
                {lvl.id}
              </button>
            ))}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={() => setShowKeyModal(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 max-md:min-h-10 rounded-full text-xs font-medium border shadow-sm transition-all cursor-pointer ${
              hasKey
                ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100 border-emerald-400'
                : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 border-amber-400'
            }`}
            title="Configure AI Provider & API Keys"
          >
            <Bot size={14} />
            <span>{hasKey ? `${provider.name} Ready` : `Set ${provider.name} Key`}</span>
          </button>

          <button
            onClick={() => setShowTranslations(!showTranslations)}
            className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-700 transition-colors px-3 py-1.5 max-md:min-h-10 rounded-full text-xs font-medium border border-indigo-400 shadow-sm cursor-pointer"
          >
            {showTranslations ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>{showTranslations ? 'Hide English' : 'Show English'}</span>
          </button>
        </div>
      </div>

      {/* Sub-Header Section Navigation Tabs */}
      <div className="max-w-6xl mx-auto px-4 flex items-center gap-3">
        <nav
          aria-label="Sections"
          className={`flex gap-1 overflow-x-auto scrollbar-none min-w-0 ${onSearch ? 'max-md:hidden' : ''}`}
        >
        {sections.map((sec) => {
          const Icon = sec.icon;
          const isActive = !onSearch && activeSection === sec.id;
          return (
            <button
              key={sec.id}
              onClick={() => handleSectionChange(sec.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center gap-2 px-5 py-2.5 font-semibold text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'border-white text-white bg-white/10 rounded-t-lg'
                  : 'border-transparent text-indigo-200 hover:text-white hover:bg-white/5 rounded-t-lg'
              }`}
            >
              <Icon size={16} />
              <span>{sec.label}</span>
            </button>
          );
        })}
        </nav>
        <HeaderSearch onSearch={onSearch} isDesktop={isDesktop} inputRef={searchInputRef} />
      </div>
    </header>
  );
}
