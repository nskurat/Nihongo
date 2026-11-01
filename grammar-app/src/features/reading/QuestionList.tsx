import { useState } from 'react';
import { CheckCircle2, XCircle, Eye, EyeOff, HelpCircle, RotateCcw } from 'lucide-react';
import FuriganaText from '../../components/common/FuriganaText';
import { ReadingQuestion } from '../../types/ai';

type FuriganaMode = 'always' | 'hover' | 'off';

/**
 * The studio quiz and the library reader render the same questions; only the density
 * and two labels differ. Every class string is a complete literal (Tailwind v4).
 */
const VARIANTS = {
  studio: {
    list: 'space-y-6',
    card: 'p-5 rounded-2xl border transition-all',
    cardIdle: 'bg-slate-50/60 border-slate-200',
    cardRight: 'bg-emerald-50/40 border-emerald-200',
    cardWrong: 'bg-rose-50/40 border-rose-200',
    promptRow: 'flex items-start gap-3 mb-4',
    number: 'w-7 h-7 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0 mt-0.5 shadow-xs',
    prompt: 'font-bold text-slate-900 text-sm md:text-base leading-relaxed',
    options: 'grid grid-cols-1 sm:grid-cols-2 gap-2.5',
    option: 'p-3 rounded-xl border text-left text-xs md:text-sm transition-all flex items-center justify-between gap-3 cursor-pointer',
    explanation: 'mt-4 p-4 bg-slate-50/80 rounded-xl border border-slate-200 text-xs space-y-2 animate-fade-in',
    explanationTitle: '解説 • Explanation & Evidence:',
    explanationText: 'text-slate-800 text-sm leading-relaxed',
    englishLabel: 'English Translation',
    english: 'p-2.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-600 leading-relaxed italic animate-fade-in',
  },
  compact: {
    list: 'space-y-4',
    card: 'p-4 rounded-xl border bg-white space-y-3',
    cardIdle: 'border-slate-200',
    cardRight: 'border-slate-200',
    cardWrong: 'border-slate-200',
    promptRow: 'flex items-start gap-2.5',
    number: 'w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0 mt-0.5',
    prompt: 'font-bold text-slate-900 text-sm leading-relaxed',
    options: 'grid grid-cols-1 sm:grid-cols-2 gap-2',
    option: 'p-2.5 rounded-lg border text-left text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer',
    explanation: 'p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2',
    explanationTitle: '解説 • Explanation:',
    explanationText: 'text-slate-800 text-xs leading-relaxed',
    englishLabel: 'English',
    english: 'p-2 bg-white rounded-lg border border-slate-200 text-xs text-slate-600 italic animate-fade-in',
  },
} as const;

interface QuestionListProps {
  questions: ReadingQuestion[];
  /** Chosen option index per question id. */
  answers: Record<number, number>;
  onAnswer: (questionId: number, optionIndex: number) => void;
  furiganaMode?: FuriganaMode;
  variant?: keyof typeof VARIANTS;
}

/**
 * Multiple-choice questions for one story. Answered questions lock, mark the right
 * and chosen options, and reveal the explanation with an optional English toggle.
 * The toggles are local state: the parent re-keys the list to clear them.
 */
export default function QuestionList({
  questions,
  answers,
  onAnswer,
  furiganaMode = 'always',
  variant = 'studio',
}: QuestionListProps) {
  const v = VARIANTS[variant];
  const [showEnglish, setShowEnglish] = useState<Record<number, boolean>>({});

  return (
    <div className={v.list}>
      {questions.map((q, qIdx) => {
        const chosen = answers[q.id];
        const isAnswered = chosen !== undefined;
        const isCorrect = chosen === q.correctIndex;

        return (
          <div key={q.id} className={`${v.card} ${isAnswered ? (isCorrect ? v.cardRight : v.cardWrong) : v.cardIdle}`}>
            <div className={v.promptRow}>
              <span className={v.number}>{qIdx + 1}</span>
              <h4 className={v.prompt}>
                <FuriganaText text={q.question} mode={furiganaMode} />
              </h4>
            </div>

            <div className={v.options}>
              {q.options.map((opt, optIdx) => {
                const isChosen = chosen === optIdx;
                const isThisCorrect = optIdx === q.correctIndex;

                let style = 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/40';
                if (isAnswered) {
                  if (isThisCorrect) style = 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold shadow-xs';
                  else if (isChosen && !isCorrect) style = 'bg-rose-50 border-rose-500 text-rose-950 font-semibold shadow-xs';
                  else style = 'bg-white border-slate-200 text-slate-400 opacity-60';
                }

                return (
                  <button
                    key={optIdx}
                    onClick={() => onAnswer(q.id, optIdx)}
                    disabled={isAnswered}
                    className={`${v.option} ${style}`}
                  >
                    <span
                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                        isAnswered && isThisCorrect
                          ? 'bg-emerald-600 text-white'
                          : isAnswered && isChosen
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {String.fromCharCode(65 + optIdx)}
                    </span>
                    <span className="flex-1">
                      <FuriganaText text={opt} mode={furiganaMode} />
                    </span>
                    {isAnswered && isThisCorrect && <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />}
                    {isAnswered && isChosen && !isCorrect && <XCircle size={16} className="text-rose-600 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {isAnswered && (
              <div className={v.explanation}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-bold text-indigo-950 text-xs">
                    <HelpCircle size={14} className="text-indigo-600 shrink-0" />
                    <span>{v.explanationTitle}</span>
                  </div>

                  {q.explanationEn && (
                    <button
                      onClick={() => setShowEnglish((prev) => ({ ...prev, [q.id]: !prev[q.id] }))}
                      aria-pressed={!!showEnglish[q.id]}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all border flex items-center gap-1 cursor-pointer ${
                        showEnglish[q.id]
                          ? 'bg-indigo-100 border-indigo-300 text-indigo-800'
                          : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-600'
                      }`}
                    >
                      {showEnglish[q.id] ? <EyeOff size={11} /> : <Eye size={11} />}
                      <span>{showEnglish[q.id] ? 'Hide English' : v.englishLabel}</span>
                    </button>
                  )}
                </div>

                <div className={v.explanationText}>
                  <FuriganaText text={q.explanationJp || q.explanation || ''} mode={furiganaMode} />
                </div>

                {showEnglish[q.id] && q.explanationEn && <div className={v.english}>{q.explanationEn}</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Clears one story's answers (and so its score). Shown only while the story has answers. */
export function StartOverButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Clear your answers for this story and start the questions again"
      className="px-3 py-1.5 min-h-10 sm:min-h-0 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer"
    >
      <RotateCcw size={13} />
      <span>Start over</span>
    </button>
  );
}
