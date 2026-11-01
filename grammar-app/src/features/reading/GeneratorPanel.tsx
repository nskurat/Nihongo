import { Sparkles, Loader2, AlertCircle, History, BookOpen } from 'lucide-react';
import { PRESET_TOPICS } from './useReadingStudio';
import { ReadingStudio } from './useReadingStudio';

/** Studio generator: lesson scope, topic, the Generate button and the no-passage-yet state. */
export default function GeneratorPanel({ studio }: { studio: ReadingStudio }) {
  const {
    activeLevel,
    setActiveTab,
    selectedLesson,
    setSelectedLesson,
    selectedTopic,
    setSelectedTopic,
    customTopic,
    setCustomTopic,
    hydrated,
    generatingLevel,
    totalLessons,
    activeProvider,
    readingData,
    loading,
    generatingHere,
    levelError,
    levelLibraryCount,
    handleGenerate,
  } = studio;

  return (
    <>
      {/* Generator Controls Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Sparkles size={16} className="text-indigo-600" />
            Configure Reading Material ({activeLevel})
          </h3>
          <div className="text-xs text-slate-400">
            Powered by <span className="font-semibold text-slate-700">{activeProvider.name}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Lesson Scope Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Lesson Grammar Scope
            </label>
            <select
              value={selectedLesson}
              onChange={(e) => setSelectedLesson(e.target.value)}
              className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">General {activeLevel} (All Lessons Aligned)</option>
              {totalLessons.map((l) => (
                <option key={l} value={l}>
                  Lesson {l} (Targeted Vocabulary & Grammar)
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              Selecting a specific lesson weaves its grammar structures and vocabulary directly into the story.
            </p>
          </div>

          {/* Topic Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Preset Theme / Topic
            </label>
            <select
              value={selectedTopic}
              onChange={(e) => {
                setSelectedTopic(e.target.value);
                setCustomTopic('');
              }}
              className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {PRESET_TOPICS.map((t) => (
                <option key={t.id} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom Topic Input */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Or Enter a Custom Topic / Scenario (Optional)
          </label>
          <input
            type="text"
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value)}
            placeholder="e.g. Adopting a cat in Tokyo, Buying a train ticket at Shinjuku station, Lost in Akihabara..."
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Error Banner */}
        {levelError && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5 animate-fade-in">
            <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block">Generation Error</span>
              {levelError}
            </div>
          </div>
        )}

        {/* Generate Action Button */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            <span>
              {generatingHere
                ? 'Generating 150-Word Passage & 5 Comprehension Questions...'
                : loading
                ? `Generating ${generatingLevel} passage...`
                : `Generate ${activeLevel} Reading Material`}
            </span>
          </button>
        </div>
      </div>

      {/* Announces async generation results to screen readers */}
      <p className="sr-only" role="status" aria-live="polite">
        {generatingHere ? `Generating ${activeLevel} passage` : readingData ? `${activeLevel} passage ready` : ''}
      </p>

      {/* Empty state: this level has no current passage yet */}
      {!readingData && hydrated && !generatingHere && (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 md:p-10 text-center space-y-4 animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto">
            <BookOpen size={28} />
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-800">No {activeLevel} passage yet</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Use <span className="font-semibold">Generate {activeLevel} Reading Material</span> above to create one
              {' '}(this calls {activeProvider.name} with your API key){levelLibraryCount > 0 ? ', or reopen a saved one.' : '.'}
            </p>
          </div>
          {levelLibraryCount > 0 && (
            <button
              onClick={() => setActiveTab('library')}
              className="px-5 py-2.5 min-h-10 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-bold text-xs rounded-xl border border-indigo-200 hover:border-indigo-600 transition-all inline-flex items-center gap-1.5 cursor-pointer"
            >
              <History size={14} />
              <span>
                Open {activeLevel} library ({levelLibraryCount})
              </span>
            </button>
          )}
        </div>
      )}
    </>
  );
}
