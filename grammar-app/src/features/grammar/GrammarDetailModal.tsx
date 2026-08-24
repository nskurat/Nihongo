import { useEffect } from 'react';
import { X, BookOpen, Sparkles, Loader2, Lightbulb, Code2 } from 'lucide-react';
import MarkdownViewer from '../../components/common/MarkdownViewer';
import { GrammarItem, LevelType } from '../../types/japanese';
import { getTagMeta } from '../../utils/tags';

interface GrammarDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: GrammarItem | null;
  activeLevel?: LevelType;
  showTranslations?: boolean;
  onGenerateExplanation?: (item: GrammarItem) => void;
  loadingExplanation?: Record<string | number, boolean>;
  aiExplanation?: Record<string | number, string>;
}

export default function GrammarDetailModal({
  isOpen,
  onClose,
  item,
  activeLevel = 'N4',
  showTranslations = true,
  onGenerateExplanation,
  loadingExplanation = {},
  aiExplanation = {},
}: GrammarDetailModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div
        className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-scale-up my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 relative border-b border-indigo-900/50">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Close modal"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 text-xs font-bold rounded-md uppercase tracking-wider">
              {activeLevel} Grammar Breakdown
            </span>
            <span className="text-xs text-slate-400 font-mono">ID: {item.id}</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {item.title}
          </h2>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-lg text-xs font-mono text-indigo-200 border border-white/10">
              <Code2 size={13} className="text-indigo-400" />
              <span>{item.structure}</span>
            </div>

            {item.meaning && (
              <div className="text-xs text-slate-300 font-medium italic">
                {showTranslations ? `"${item.meaning}"` : '••••••'}
              </div>
            )}
          </div>
        </div>

        {/* Modal Body / Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 max-h-[calc(90vh-180px)] scrollbar-thin scrollbar-thumb-slate-300">
          {/* Grammatical Profile */}
          {item.tags && item.tags.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Grammatical Profile
              </h4>
              <div className="flex flex-wrap gap-2">
                {item.tags.map(tagId => {
                  const meta = getTagMeta(tagId);
                  if (!meta) return null;
                  return (
                    <div
                      key={tagId}
                      className="flex items-baseline gap-1.5 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200/80 text-xs"
                    >
                      <span className="font-semibold text-slate-800">{meta.label}</span>
                      <span className="text-slate-500">{meta.description}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Formatted Markdown Content / Tables */}
          <div>
            <MarkdownViewer content={item.details || item.explanation} />
          </div>

          {/* Example Sentences */}
          {item.examples && item.examples.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-200">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <BookOpen size={14} className="text-indigo-600" /> Contextual Examples
              </h4>
              <div className="space-y-2.5">
                {item.examples.map((ex: { jp: string; en: string }, idx: number) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1"
                  >
                    <div className="font-bold text-slate-900 text-sm leading-relaxed">{ex.jp}</div>
                    {showTranslations && (
                      <div className="text-slate-600 text-xs">{ex.en}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Insights & Nuance in Modal */}
          {onGenerateExplanation && (
            <div className="pt-4 border-t border-slate-200">
              <button
                onClick={() => onGenerateExplanation(item)}
                disabled={loadingExplanation[item.id]}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl border border-indigo-200 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loadingExplanation[item.id] ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <Sparkles size={14} className="text-indigo-600" />
                )}
                {loadingExplanation[item.id]
                  ? 'Generating AI Nuance & Extra Sentences...'
                  : aiExplanation[item.id]
                  ? 'Regenerate AI Nuance Notes'
                  : 'Ask AI: Explain Nuance & Give Practice Sentences'}
              </button>

              {aiExplanation[item.id] && (
                <div className="mt-3 p-4 bg-indigo-50/70 rounded-xl border border-indigo-200/80 text-xs text-indigo-950 space-y-1.5 animate-fade-in leading-relaxed">
                  <div className="flex items-center gap-1.5 font-bold text-indigo-900 mb-1">
                    <Lightbulb size={14} className="text-amber-500" /> AI Linguistic Breakdown:
                  </div>
                  <MarkdownViewer content={aiExplanation[item.id]} className="text-xs text-indigo-950 leading-relaxed" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer"
          >
            Close Breakdown
          </button>
        </div>
      </div>
    </div>
  );
}
