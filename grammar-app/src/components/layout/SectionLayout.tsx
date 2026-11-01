import { ReactNode } from 'react';
import { ArrowRight, ListFilter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LevelType } from '../../types/japanese';
import { ContentError } from '../../services/content/ContentSource';
import { useActiveLessonScroll } from '../../features/useActiveLessonScroll';
import SearchReturnBar from '../../features/search/SearchReturnBar';
import SearchAllLevelsLink from '../../features/search/SearchAllLevelsLink';
import { S } from '../../features/search/strings';
import { sectionTheme, sidebarHeading, StudySection } from './sectionTheme';

/**
 * A lesson chunk that failed to load can't be re-imported: the browser's module map keeps
 * the failure for the page's lifetime, so a second `import()` rejects without a request.
 * Reloading is the only retry that can work, and it keeps the URL, so the same lesson opens.
 */
const reloadPage = () => window.location.reload();

interface SectionLayoutProps {
  section: StudySection;
  level: LevelType;
  lesson: number;
  lessons: number[];
  lessonCounts: Record<number, number>;
  loading: boolean;
  error: ContentError | null;
  retry: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  /** Items after filtering / items in the lesson. */
  shownCount: number;
  totalCount: number;
  /** Under the banner heading, e.g. grammar's lesson blurb and missing-sections notice. */
  bannerExtra?: ReactNode;
  /** Bottom of the sidebar, e.g. grammar's "Browse by function" link. */
  sidebarFooter?: ReactNode;
  /** The section's cards. */
  children: ReactNode;
}

/**
 * The shell shared by Grammar, Vocab and Kanji: lesson sidebar, banner with the
 * per-lesson filter and count, and the loading / error / empty panels. Sections
 * supply only their cards (and optional extras); colours and copy come from
 * `sectionTheme`.
 */
export default function SectionLayout({
  section,
  level,
  lesson,
  lessons,
  lessonCounts,
  loading,
  error,
  retry,
  searchQuery,
  onSearchChange,
  shownCount,
  totalCount,
  bannerExtra,
  sidebarFooter,
  children,
}: SectionLayoutProps) {
  const navigate = useNavigate();
  const theme = sectionTheme[section];
  const c = theme.classes;
  const Icon = theme.icon;
  const lessonListRef = useActiveLessonScroll<HTMLUListElement>(lesson, lessons.length);

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in">
      {/* Sidebar / Lesson Selection */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden lg:sticky lg:top-28">
          <div className="p-4 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon size={18} className={c.icon} />
              <h2 className="font-semibold text-slate-800 text-sm">{sidebarHeading(theme, level, lessons)}</h2>
            </div>
            {theme.lessonTotalPill && (
              <span className="text-xs bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full">
                {lessons.length}
              </span>
            )}
          </div>

          <nav aria-label={`${level} lessons`}>
            <ul
              ref={lessonListRef}
              className={`flex flex-row lg:flex-col p-2 gap-1.5 overflow-x-auto lg:overflow-y-auto lg:max-h-[70vh] scrollbar-thin ${c.scrollThumb}`}
            >
              {lessons.map((n) => {
                const active = lesson === n;
                return (
                  <li key={n} className="min-w-fit">
                    <button
                      onClick={() => navigate(`/${level.toLowerCase()}/${section}/${n}`)}
                      aria-current={active ? 'true' : undefined}
                      className={`w-full flex items-center justify-between text-left px-3.5 py-2.5 rounded-lg transition-all text-sm cursor-pointer ${
                        active ? c.lessonActive : c.lessonIdle
                      }`}
                    >
                      <span>Lesson {n}</span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full ${
                            active ? c.countActive : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {lessonCounts[n] || 0}
                        </span>
                        {active && <ArrowRight size={14} className="hidden lg:block" />}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
          {sidebarFooter}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="lg:col-span-3 space-y-6">
        <SearchReturnBar />
        {/* Banner */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 ${c.levelBadge} text-xs font-bold rounded-md uppercase tracking-wide`}>
                {level} Level
              </span>
              <span className="text-xs text-slate-400">• {theme.subtitle}</span>
            </div>
            <h2 className={`text-3xl font-extrabold text-slate-800 border-b-4 ${c.headingBorder} pb-1 inline-block mt-2`}>
              Lesson {lesson}
            </h2>
            {bannerExtra}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            {/* Per-lesson filter (global search lives in the header) */}
            <div className="relative">
              <ListFilter size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                aria-label={S.filterLesson}
                placeholder={S.filterLesson}
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className={`pl-9 pr-3 py-1.5 max-md:py-2.5 text-xs max-md:text-[16px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 ${c.focusRing} w-full ${theme.filterWidth}`}
              />
            </div>
            <div className={`px-3.5 py-1.5 ${c.countBadge} rounded-lg border font-semibold text-xs text-center whitespace-nowrap`}>
              {searchQuery ? `${shownCount} of ${totalCount}` : totalCount} {theme.countNoun}
            </div>
          </div>
        </div>

        {loading && (
          <div className="bg-white p-12 rounded-xl border border-dashed border-slate-300 text-center space-y-3 animate-pulse">
            <h3 className="text-lg font-bold text-slate-700">Loading Lesson {lesson}…</h3>
          </div>
        )}

        {!loading && error && (
          <div className="bg-white p-12 rounded-xl border border-dashed border-red-300 text-center space-y-3">
            <h3 className="text-lg font-bold text-red-700">Couldn't load this lesson</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              {error.kind === 'not-found' ? `Lesson ${lesson} wasn't found.` : 'Something went wrong loading this content.'}
            </p>
            <button
              onClick={error.kind === 'load-failed' ? reloadPage : retry}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 max-md:min-h-10 ${c.retry} font-semibold text-xs rounded-lg border cursor-pointer`}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && shownCount === 0 && (
          <div className="bg-white p-12 rounded-xl border border-dashed border-slate-300 text-center space-y-3">
            <h3 className="text-lg font-bold text-slate-700">{theme.emptyTitle}</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              {searchQuery ? theme.emptySearch(searchQuery, lesson) : theme.emptyPreparing(lesson)}
            </p>
            {searchQuery.trim() && <SearchAllLevelsLink q={searchQuery} />}
          </div>
        )}

        {children}
      </div>
    </main>
  );
}
