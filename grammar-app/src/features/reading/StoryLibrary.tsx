import { Compass, Trash2, Clock, Search, BookMarked } from 'lucide-react';
import { stripFurigana } from '../../services/ai/readingParser';
import { openStoryLabel, scoreStory } from '../../services/ai/readingSession';
import { ReadingStudio } from './useReadingStudio';

/** Saved stories: search, level filter, cards with progress, delete and open. */
export default function StoryLibrary({ studio }: { studio: ReadingStudio }) {
  const {
    activeLevel,
    libraryFilterLevel,
    setActiveTab,
    setLibraryFilterLevel,
    searchQuery,
    setSearchQuery,
    setModalStory,
    activeReadings,
    progress,
    savedHistory,
    handleClearHistory,
    handleDeleteHistoryItem,
    handleLoadIntoStudio,
    filteredLibrary,
  } = studio;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Library Toolbar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search saved stories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Level Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            {(['ALL', 'N5', 'N4', 'N3', 'N2', 'N1'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLibraryFilterLevel(lvl)}
                aria-pressed={libraryFilterLevel === lvl}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  libraryFilterLevel === lvl
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <span className="text-xs font-medium text-slate-500">
            {filteredLibrary.length} Stories Saved
          </span>

          {savedHistory.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="text-xs text-slate-400 hover:text-rose-600 font-semibold flex items-center gap-1 transition-colors px-2 py-1 cursor-pointer"
            >
              <Trash2 size={13} />
              <span>Clear Library</span>
            </button>
          )}
        </div>
      </div>

      {/* Cross-level notice: the list no longer matches the header level */}
      {libraryFilterLevel !== activeLevel && (
        <div className="-mt-3 px-1 text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>
            Showing {libraryFilterLevel === 'ALL' ? 'all levels' : `${libraryFilterLevel} stories`} while you are
            on <span className="font-semibold text-slate-700">{activeLevel}</span>. Opening a story from another
            level switches to that level.
          </span>
          <button
            onClick={() => setLibraryFilterLevel(activeLevel)}
            className="font-bold text-indigo-700 hover:text-indigo-900 underline underline-offset-2 cursor-pointer"
          >
            Show {activeLevel} only
          </button>
        </div>
      )}

      {/* Empty Library State */}
      {filteredLibrary.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto">
            <BookMarked size={28} />
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-800">No Saved Stories Yet</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Passages you generate in the Practice Studio will automatically be archived here for future offline reading and reviews.
            </p>
          </div>
          <button
            onClick={() => setActiveTab('studio')}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Compass size={14} />
            <span>Go to Practice Studio</span>
          </button>
        </div>
      )}

      {/* Story Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredLibrary.map((item) => {
          const cleanJpTitle = stripFurigana(item.data?.title) || '日本語の物語';
          const cleanSnippet = stripFurigana(item.data?.japaneseText || '').slice(0, 110);
          const crossLevel = item.level !== activeLevel;
          const isCurrent = activeReadings[item.level]?.storyId === item.id;
          const itemScore = scoreStory(item.data, progress[item.id] ?? {});

          return (
            <div
              key={item.id}
              onClick={() => setModalStory(item)}
              className="bg-white rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all p-5 flex flex-col justify-between cursor-pointer group relative"
            >
              <div className="space-y-3.5">
                {/* Header & Badges */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`px-2.5 py-0.5 text-xs font-bold rounded-lg ${
                        item.level === 'N1'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200/80'
                          : item.level === 'N2'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200/80'
                          : item.level === 'N3'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200/80'
                          : item.level === 'N5'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200/80'
                          : 'bg-indigo-100 text-indigo-800 border border-indigo-200/80'
                      }`}
                    >
                      JLPT {item.level}
                    </span>
                    {item.lesson ? (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200">
                        Lesson {item.lesson}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs font-medium rounded-lg">
                        General
                      </span>
                    )}
                  </div>

                  <button
                    onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                    className="text-slate-300 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                    title="Delete Story"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {/* Titles: Japanese & English */}
                <div className="space-y-1">
                  <h4 className="font-extrabold text-slate-900 text-lg group-hover:text-indigo-600 transition-colors leading-snug tracking-tight">
                    {cleanJpTitle}
                  </h4>

                  {item.data?.titleEn ? (
                    <p className="text-xs font-semibold text-indigo-700 bg-indigo-50/80 px-2.5 py-1 rounded-lg border border-indigo-100/80 inline-block">
                      {item.data.titleEn}
                    </p>
                  ) : item.topic ? (
                    <p className="text-xs font-medium text-slate-500 italic line-clamp-1">
                      {item.topic}
                    </p>
                  ) : null}
                </div>

                {/* Clean Japanese Snippet */}
                <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 text-xs text-slate-600 leading-relaxed">
                  <p className="line-clamp-3">
                    {cleanSnippet}...
                  </p>
                </div>
              </div>

              {/* Footer Metadata & Actions */}
              <div className="pt-3.5 mt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
                <div className="flex flex-col gap-1 text-slate-400 font-medium text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <Clock size={12} />
                    <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                  </span>
                  {(isCurrent || itemScore.answered > 0) && (
                    <span className="text-slate-500">
                      {isCurrent && <span className="font-bold text-indigo-700">Current {item.level}</span>}
                      {isCurrent && itemScore.answered > 0 && ' · '}
                      {itemScore.answered > 0 &&
                        (itemScore.answered === itemScore.total
                          ? `Done ${itemScore.correct}/${itemScore.total}`
                          : `${itemScore.answered}/${itemScore.total} answered`)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLoadIntoStudio(item);
                    }}
                    className="px-3 py-1.5 min-h-10 sm:min-h-0 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-bold text-xs rounded-xl border border-indigo-200 hover:border-indigo-600 transition-all cursor-pointer shadow-2xs"
                    title={
                      crossLevel
                        ? `Switch to ${item.level} and open this story in its Practice Studio`
                        : 'Load into Studio for full interactive practice & quiz'
                    }
                  >
                    {openStoryLabel(item.level, activeLevel)}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
