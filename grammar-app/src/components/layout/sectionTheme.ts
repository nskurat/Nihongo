import { BookText, Languages, LayoutTemplate, type LucideIcon } from 'lucide-react';

export type StudySection = 'grammar' | 'vocab' | 'kanji';

export interface SectionTheme {
  icon: LucideIcon;
  /** Sidebar heading noun: "N5 Lessons (1–25)", "N5 Vocab (1–25)". */
  sidebarLabel: string;
  /** Banner subtitle after the level badge. */
  subtitle: string;
  /** Unit after the item count: "12 Patterns". */
  countNoun: string;
  emptyTitle: string;
  emptyPreparing: (lesson: number) => string;
  emptySearch: (query: string, lesson: number) => string;
  /** Width of the per-lesson filter box. */
  filterWidth: string;
  /** Lesson-total pill beside the sidebar heading (grammar only, as before). */
  lessonTotalPill: boolean;
  /**
   * Accent classes. Complete literals only - Tailwind v4 generates a class only when it
   * finds it verbatim in source, so `bg-${colour}-600` would silently produce nothing.
   */
  classes: {
    icon: string;
    scrollThumb: string;
    lessonActive: string;
    lessonIdle: string;
    countActive: string;
    levelBadge: string;
    headingBorder: string;
    focusRing: string;
    countBadge: string;
    retry: string;
  };
}

export const sectionTheme: Record<StudySection, SectionTheme> = {
  grammar: {
    icon: LayoutTemplate,
    sidebarLabel: 'Lessons',
    subtitle: 'Grammar Reference',
    countNoun: 'Patterns',
    emptyTitle: 'No grammar patterns found',
    emptyPreparing: (lesson) => `Grammar patterns for Lesson ${lesson} are currently being prepared.`,
    emptySearch: (q, lesson) => `No results match your search "${q}" in Lesson ${lesson}.`,
    filterWidth: 'sm:w-56',
    lessonTotalPill: true,
    classes: {
      icon: 'text-indigo-600',
      scrollThumb: 'scrollbar-thumb-indigo-200',
      lessonActive: 'bg-indigo-600 text-white shadow-md font-semibold',
      lessonIdle: 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-900',
      countActive: 'bg-indigo-700/80 text-indigo-100',
      levelBadge: 'bg-indigo-100 text-indigo-800',
      headingBorder: 'border-indigo-500',
      focusRing: 'focus:ring-indigo-500',
      countBadge: 'bg-indigo-50 border-indigo-100 text-indigo-700',
      retry: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200',
    },
  },
  vocab: {
    icon: BookText,
    sidebarLabel: 'Vocab',
    subtitle: 'Vocabulary List',
    countNoun: 'Words',
    emptyTitle: 'No vocabulary found',
    emptyPreparing: (lesson) => `Vocabulary for Lesson ${lesson} is currently being prepared.`,
    emptySearch: (q) => `No results match your search "${q}".`,
    filterWidth: 'sm:w-64',
    lessonTotalPill: false,
    classes: {
      icon: 'text-emerald-600',
      scrollThumb: 'scrollbar-thumb-emerald-200',
      lessonActive: 'bg-emerald-600 text-white shadow-md font-semibold',
      lessonIdle: 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-900',
      countActive: 'bg-emerald-700/80 text-emerald-100',
      levelBadge: 'bg-emerald-100 text-emerald-800',
      headingBorder: 'border-emerald-500',
      focusRing: 'focus:ring-emerald-500',
      countBadge: 'bg-emerald-50 border-emerald-100 text-emerald-700',
      retry: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200',
    },
  },
  kanji: {
    icon: Languages,
    sidebarLabel: 'Kanji',
    subtitle: 'Kanji List',
    countNoun: 'Kanji',
    emptyTitle: 'No kanji found',
    emptyPreparing: (lesson) => `Kanji for Lesson ${lesson} are currently being prepared.`,
    emptySearch: (q) => `No results match your search "${q}".`,
    filterWidth: 'sm:w-64',
    lessonTotalPill: false,
    classes: {
      icon: 'text-rose-600',
      scrollThumb: 'scrollbar-thumb-rose-200',
      lessonActive: 'bg-rose-600 text-white shadow-md font-semibold',
      lessonIdle: 'text-slate-600 hover:bg-rose-50 hover:text-rose-900',
      countActive: 'bg-rose-700/80 text-rose-100',
      levelBadge: 'bg-rose-100 text-rose-800',
      headingBorder: 'border-rose-500',
      focusRing: 'focus:ring-rose-500',
      countBadge: 'bg-rose-50 border-rose-100 text-rose-700',
      retry: 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200',
    },
  },
};

/** "N4 Lessons (1–25)"; just "N4 Lessons" while the list is loading or failed. */
export function sidebarHeading(theme: SectionTheme, level: string, lessons: number[]): string {
  const base = `${level} ${theme.sidebarLabel}`;
  return lessons.length ? `${base} (${lessons[0]}–${lessons[lessons.length - 1]})` : base;
}
