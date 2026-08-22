import React, { useState } from 'react';
import { Search, Sparkles, Loader2, Info, Layers, Hash } from 'lucide-react';

export default function KanjiSection({
  kanjiData,
  activeLevel,
  showTranslations,
  onGenerateKanjiMnemonic,
  loadingKanjiAi,
  aiKanjiMnemonics,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStroke, setSelectedStroke] = useState('all');

  const kanjiList = kanjiData[activeLevel] || [];

  // Stroke count options from active data
  const strokeOptions = Array.from(new Set(kanjiList.map((k) => k.strokes))).sort((a, b) => a - b);

  // Filtering
  const filteredKanji = kanjiList.filter((k) => {
    const matchesSearch =
      !searchQuery.trim() ||
      k.kanji.includes(searchQuery.trim()) ||
      k.meaning.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.onyomi.some((on) => on.includes(searchQuery.trim())) ||
      k.kunyomi.some((kun) => kun.includes(searchQuery.trim()));

    const matchesStroke = selectedStroke === 'all' || k.strokes === Number(selectedStroke);

    return matchesSearch && matchesStroke;
  });

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-6 animate-fade-in">
      {/* Banner & Control Bar */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-xs font-bold rounded-md uppercase tracking-wide">
              {activeLevel} Kanji
            </span>
            <span className="text-xs text-slate-400">• Character & Reading Mastery</span>
          </div>
          <h2 className="text-3xl font-extrabold text-slate-800 border-b-4 border-amber-500 pb-1 inline-block mt-2">
            {activeLevel} Kanji Database
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Browse essential kanji characters, Onyomi/Kunyomi readings, stroke counts, and high-frequency compounds.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search bar */}
          <div className="relative flex-1 md:w-56">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search kanji, reading, meaning..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 w-full"
            />
          </div>

          {/* Stroke count filter */}
          <select
            value={selectedStroke}
            onChange={(e) => setSelectedStroke(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-700 font-medium"
          >
            <option value="all">All Strokes</option>
            {strokeOptions.map((st) => (
              <option key={st} value={st}>
                {st} Strokes
              </option>
            ))}
          </select>

          <div className="px-3.5 py-2 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 font-semibold text-xs text-center whitespace-nowrap">
            {filteredKanji.length} Kanji
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filteredKanji.length === 0 && (
        <div className="bg-white p-12 rounded-xl border border-dashed border-slate-300 text-center space-y-3">
          <Info size={36} className="mx-auto text-slate-400" />
          <h4 className="text-lg font-bold text-slate-700">No Kanji found</h4>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            {searchQuery
              ? `No kanji matched your search query "${searchQuery}".`
              : `Kanji content for ${activeLevel} will be expanded soon.`}
          </p>
        </div>
      )}

      {/* Kanji Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredKanji.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:border-amber-300 hover:shadow-md transition-all flex flex-col justify-between group"
          >
            <div>
              {/* Header Box */}
              <div className="bg-gradient-to-br from-amber-50/50 via-white to-slate-50 p-5 border-b border-amber-100 flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white rounded-xl shadow-inner border border-amber-200 flex items-center justify-center text-4xl font-serif font-black text-slate-900 group-hover:scale-105 transition-transform">
                    {item.kanji}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">
                      {showTranslations ? item.meaning : '••••••'}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded">
                        <Hash size={12} /> {item.strokes} strokes
                      </span>
                      {item.radical && (
                        <span className="text-xs text-slate-500 font-medium">Radical: {item.radical}</span>
                      )}
                    </div>
                  </div>
                </div>
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
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-white hover:bg-amber-50 text-amber-800 text-xs font-semibold rounded-lg border border-amber-200/80 transition-colors shadow-2xs disabled:opacity-50"
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
                <div className="mt-3 bg-amber-50 p-3 rounded-lg border border-amber-200/70 text-xs text-amber-900 leading-relaxed animate-fade-in">
                  <span className="font-bold block mb-1">Mnemonic Hook:</span>
                  {aiKanjiMnemonics[item.id]}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
