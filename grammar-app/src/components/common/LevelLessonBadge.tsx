import { Link } from 'react-router-dom';
import type { DocType, Level } from '../../services/search/types';

interface LevelLessonBadgeProps {
  level: Level;
  lesson: number;
  type: DocType;
  /** When set, the badge is its own link (collapsed duplicates). */
  to?: string;
  state?: unknown;
  /** Solid (primary occurrence) or outlined (other occurrences). */
  variant?: 'solid' | 'outline';
  onClick?: () => void;
  className?: string;
}

const solid: Record<DocType, string> = {
  grammar: 'bg-indigo-100 text-indigo-800 border-indigo-100',
  vocab: 'bg-emerald-100 text-emerald-800 border-emerald-100',
  kanji: 'bg-rose-100 text-rose-800 border-rose-100',
};
const outline: Record<DocType, string> = {
  grammar: 'bg-white text-indigo-800 border-indigo-300 hover:bg-indigo-50',
  vocab: 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50',
  kanji: 'bg-white text-rose-800 border-rose-300 hover:bg-rose-50',
};

/** `N3 · L12` in the section accent. */
export default function LevelLessonBadge({
  level,
  lesson,
  type,
  to,
  state,
  variant = 'solid',
  onClick,
  className = '',
}: LevelLessonBadgeProps) {
  const cls = `inline-flex items-center justify-center whitespace-nowrap text-[11px] font-bold px-2 py-0.5 rounded-md border ${
    variant === 'solid' ? solid[type] : outline[type]
  } ${className}`;
  const label = `${level} · L${lesson}`;
  if (!to) return <span className={cls}>{label}</span>;
  return (
    <Link
      to={to}
      state={state}
      onClick={onClick}
      aria-label={`${level} lesson ${lesson}`}
      className={`${cls} relative z-10 max-md:min-h-10 max-md:min-w-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2`}
    >
      {label}
    </Link>
  );
}
