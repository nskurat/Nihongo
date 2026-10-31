import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LevelType, SectionType } from '../types/japanese';

export interface LastLesson {
  level: LevelType;
  section: SectionType;
  lesson: number;
}

interface AppState {
  showTranslations: boolean;
  /**
   * The lesson visited last. Its level is the search ranking level and the header badge on
   * /search; leaving search with no in-app history returns here (docs/search/03-ux.md §1.3).
   */
  lastLesson: LastLesson;

  // Actions
  setShowTranslations: (show: boolean) => void;
  setLastLesson: (last: LastLesson) => void;
}

export const DEFAULT_LAST_LESSON: LastLesson = { level: 'N3', section: 'grammar', lesson: 1 };

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      showTranslations: true,
      lastLesson: DEFAULT_LAST_LESSON,

      setShowTranslations: (show: boolean) => set({ showTranslations: show }),
      setLastLesson: (last: LastLesson) => set({ lastLesson: last }),
    }),
    {
      name: 'app-ui-storage', // unique name
      partialize: (state) => ({ showTranslations: state.showTranslations, lastLesson: state.lastLesson }),
    }
  )
);
