import { useState, useEffect } from 'react';
import { Search, Sparkles, Loader2, Info, Layers, Hash, Languages, ArrowRight, ExternalLink } from 'lucide-react';
import MarkdownViewer from './MarkdownViewer';
import { KanjiItem, LevelType } from '../types/japanese';

interface KanjiSectionProps {
  kanjiData?: Record<number, KanjiItem[]>;
  activeLesson: number;
  setActiveLesson: (lesson: number) => void;
  activeLevel: LevelType;
  showTranslations: boolean;
  onGenerateKanjiMnemonic: (item: KanjiItem) => void;
  loadingKanjiAi: Record<string | number, boolean>;
  aiKanjiMnemonics: Record<string | number, string>;
}

export default function KanjiSection({
  kanjiData = {},
  activeLesson,
  setActiveLesson,
  activeLevel,
  showTranslations,
  onGenerateKanjiMnemonic,
  loadingKanjiAi,
  aiKanjiMnemonics,
}: KanjiSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStroke, setSelectedStroke] = useState('all');

  const totalLessons = Object.keys(kanjiData).map(Number).sort((a, b) => a - b);

  // If current active lesson has no kanji for this level, select first available
  useEffect(() => {
    if (totalLessons.length > 0 && !kanjiData[activeLesson]) {
      setActiveLesson(totalLessons[0]);
    }
  }, [kanjiData, activeLesson, totalLessons, setActiveLesson]);

  const currentKanjiList = kanjiData[activeLesson] || [];

  // Stroke count options from current active lesson data
  const strokeOptions = Array.from(new Set(currentKanjiList.map((k) => k.strokes))).sort((a, b) => a - b);

  // Filtering
  const filteredKanji = currentKanjiList.filter((k) => {
    const matchesSearch =
      !searchQuery.trim() ||
      k.kanji.includes(searchQuery.trim()) ||
      k.meaning.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (k.onyomi && k.onyomi.some((on) => on.includes(searchQuery.trim()))) ||
      (k.kunyomi && k.kunyomi.some((kun) => kun.includes(searchQuery.trim())));

    const matchesStroke = selectedStroke === 'all' || k.strokes === Number(selectedStroke);

    return matchesSearch && matchesStroke;
  });

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in">
      {/* Sidebar / Lesson Selection */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden lg:sticky lg:top-28">
          <div className="p-4 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Languages size={18} className="text-amber-600" />
              <h2 className="font-semibold text-slate-800 text-sm">
                {activeLevel} Lessons ({totalLessons[0] || 1}–{totalLessons[totalLessons.length - 1] || 1})
              </h2>
            </div>
            <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
              {totalLessons.length}
            </span>
          </div>

          <ul className="flex flex-row lg:flex-col p-2 gap-1.5 overflow-x-auto lg:overflow-y-auto lg:max-h-[70vh] scrollbar-thin scrollbar-thumb-amber-200">
            {totalLessons.length > 0 ? (
              totalLessons.map((lesson) => {
                const count = (kanjiData[lesson] || []).length;
                return (
                  <li key={lesson} className="min-w-fit">
                    <button
                      onClick={() => setActiveLesson(lesson)}
                      className={`w-full flex items-center justify-between text-left px-3.5 py-2.5 rounded-lg transition-all text-sm cursor-pointer ${
                        activeLesson === lesson
                          ? 'bg-amber-600 text-white shadow-md font-semibold'
                          : 'text-slate-600 hover:bg-amber-50 hover:text-amber-900'
                      }`}
                    >
                      <span>Lesson {lesson}</span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full ${
                            activeLesson === lesson
                              ? 'bg-amber-700/80 text-amber-100'
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
              })
            ) : (
              <div className="p-4 text-xs text-slate-400 text-center">No lessons configured yet</div>
            )}
          </ul>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="lg:col-span-3 space-y-6">
        {/* Banner */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-xs font-bold rounded-md uppercase tracking-wide">
                {activeLevel} Kanji
              </span>
              <span className="text-xs text-slate-400">• Minna no Nihongo</span>
            </div>
            <h2 className="text-3xl font-extrabold text-slate-800 border-b-4 border-amber-500 pb-1 inline-block mt-2">
              Lesson {activeLesson}
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              Master stroke counts, on/kun readings, radicals, compounds, and AI mnemonic stories.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search kanji, reading, meaning..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 w-full sm:w-56"
              />
            </div>

            {/* Stroke Count Filter */}
            {strokeOptions.length > 0 && (
              <select
                value={selectedStroke}
                onChange={(e) => setSelectedStroke(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-700 font-medium cursor-pointer"
              >
                <option value="all">All Strokes</option>
                {strokeOptions.map((stroke) => (
                  <option key={stroke} value={stroke}>
                    {stroke} Strokes
                  </option>
                ))}
              </select>
            )}

            <div className="px-3.5 py-1.5 bg-amber-50 rounded-lg border border-amber-100 text-amber-700 font-semibold text-xs text-center whitespace-nowrap">
              {currentKanjiList.length} Kanji
            </div>
          </div>
        </div>

        {/* Empty State */}
        {filteredKanji.length === 0 && (
          <div className="bg-white p-12 rounded-xl border border-dashed border-slate-300 text-center space-y-3">
            <Info size={36} className="mx-auto text-slate-400" />
            <h4 className="text-lg font-bold text-slate-700">No Kanji Found</h4>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              {searchQuery || selectedStroke !== 'all'
                ? `No kanji match your criteria in Lesson ${activeLesson}.`
                : `Kanji curriculum for Lesson ${activeLesson} is being prepared.`}
            </p>
          </div>
        )}

        {/* Kanji Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredKanji.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col justify-between hover:border-slate-300 transition-all group"
            >
              <div>
                {/* Top Section: Kanji glyph + Core Meaning */}
                <div className="p-5 bg-gradient-to-r from-amber-50/50 via-white to-slate-50 border-b border-amber-100/80 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-3xl font-extrabold text-amber-950 font-serif shadow-inner">
                      {item.kanji}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">
                        {showTranslations ? item.meaning : '••••••'}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        {item.strokes > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded">
                            <Hash size={12} /> {item.strokes} strokes
                          </span>
                        )}
                        {item.radical && (
                          <span className="text-xs text-slate-500 font-medium">Radical: {item.radical}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {(item.strokeOrderLink || item.kanji) && (
                    <a
                      href={item.strokeOrderLink || `https://jisho.org/search/${encodeURIComponent(item.kanji)}%23kanji`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-amber-800 bg-white hover:bg-amber-50 rounded-lg border border-amber-200 transition-all shadow-2xs group/link cursor-pointer"
                      title="View Stroke Order & Dictionary on Jisho.org"
                    >
                      <span>Stroke Order</span>
                      <ExternalLink size={12} className="text-amber-600 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                    </a>
                  )}
                </div>

                {/* Readings & Details */}
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="text-slate-400 font-semibold uppercase block mb-1">On (音読み)</span>
                      <span className="font-bold text-indigo-700 text-sm">
                        {item.onyomi && item.onyomi.length > 0 ? item.onyomi.join('、 ') : '—'}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="text-slate-400 font-semibold uppercase block mb-1">Kun (訓読み)</span>
                      <span className="font-bold text-emerald-700 text-sm">
                        {item.kunyomi && item.kunyomi.length > 0 ? item.kunyomi.join('、 ') : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Context Example Sentence */}
                  {item.exampleJp && (
                    <div className="p-3 bg-amber-50/40 rounded-lg border border-amber-100 text-xs space-y-1">
                      <div className="font-bold text-slate-800 text-sm leading-snug">{item.exampleJp}</div>
                      {showTranslations && item.exampleEn && (
                        <div className="text-slate-600 italic">{item.exampleEn}</div>
                      )}
                    </div>
                  )}

                  {/* Example Compounds */}
                  {item.compounds && item.compounds.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Layers size={13} className="text-amber-500" /> Common Compounds
                      </h4>
                      <div className="space-y-1.5">
                        {item.compounds.map((comp, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between items-center bg-slate-50 px-2.5 py-1.5 rounded-lg text-xs border border-slate-100"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">{comp.word}</span>
                              <span className="text-slate-400">({comp.reading})</span>
                            </div>
                            {showTranslations && (
                              <span className="text-slate-600 font-medium">{comp.meaning}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom AI Interaction */}
              <div className="p-4 bg-slate-50/70 border-t border-slate-100">
                <button
                  onClick={() => onGenerateKanjiMnemonic(item)}
                  disabled={loadingKanjiAi[item.id]}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-white hover:bg-amber-50 text-amber-800 text-xs font-semibold rounded-lg border border-amber-200/80 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
                >
                  {loadingKanjiAi[item.id] ? (
                    <Loader2 className="animate-spin" size={13} />
                  ) : (
                    <Sparkles size={13} className="text-amber-500" />
                  )}
                  {loadingKanjiAi[item.id]
                    ? 'Generating...'
                    : aiKanjiMnemonics[item.id]
                    ? 'Regenerate Mnemonic'
                    : 'AI: Mnemonic & Memory Hook'}
                </button>

                {aiKanjiMnemonics[item.id] && (
                  <div className="mt-3 bg-amber-50 p-3.5 rounded-lg border border-amber-200/70 text-xs text-amber-900 leading-relaxed animate-fade-in">
                    <span className="font-bold block mb-1 text-amber-950">Mnemonic Hook:</span>
                    <MarkdownViewer content={aiKanjiMnemonics[item.id]} className="text-xs text-amber-900 leading-relaxed" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
