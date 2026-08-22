import React from 'react';
import { BookOpen, BookText, Sparkles, Eye, EyeOff, Key, GraduationCap, Languages, Bot } from 'lucide-react';
import { getActiveProviderId, getProvider, getStoredApiKey } from '../services/ai/registry';

export default function Header({
  activeLevel,
  setActiveLevel,
  activeSection,
  setActiveSection,
  showTranslations,
  setShowTranslations,
  onOpenKeyModal,
}) {
  const levels = [
    { id: 'N4', label: 'JLPT N4', desc: 'Beginner II' },
    { id: 'N3', label: 'JLPT N3', desc: 'Intermediate I' },
  ];

  const sections = [
    { id: 'grammar', label: 'Grammar', icon: BookOpen },
    { id: 'vocab', label: 'Vocabulary', icon: BookText },
    { id: 'kanji', label: 'Kanji', icon: Languages },
  ];

  const provider = getProvider(getActiveProviderId());
  const hasKey = !provider.requiresKey || !!getStoredApiKey(provider.id);

  return (
    <header className="bg-indigo-600 text-white shadow-lg sticky top-0 z-20 transition-all">
      {/* Top Banner */}
      <div className="max-w-6xl mx-auto px-4 py-3 md:py-4 flex flex-col md:flex-row justify-between items-center gap-3 border-b border-indigo-500/50">
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/20">
              <GraduationCap size={24} className="text-indigo-100" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                Nihongo Portal <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500 border border-indigo-400/80">{activeLevel}</span>
              </h1>
              <p className="text-indigo-200 text-xs font-medium">
                Minna no Nihongo Reference & Practice
              </p>
            </div>
          </div>

          {/* Level Switcher (Pill Selector) */}
          <div className="flex items-center bg-indigo-800/60 p-1 rounded-xl border border-indigo-400/30">
            {levels.map((lvl) => (
              <button
                key={lvl.id}
                onClick={() => setActiveLevel(lvl.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
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
            onClick={onOpenKeyModal}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border shadow-sm transition-all ${
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
            className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-700 transition-colors px-3 py-1.5 rounded-full text-xs font-medium border border-indigo-400 shadow-sm"
          >
            {showTranslations ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>{showTranslations ? 'Hide English' : 'Show English'}</span>
          </button>
        </div>
      </div>

      {/* Sub-Header Section Navigation Tabs */}
      <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto scrollbar-none">
        {sections.map((sec) => {
          const Icon = sec.icon;
          const isActive = activeSection === sec.id;
          return (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
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
      </div>
    </header>
  );
}
