import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LevelType, SectionType } from '../types/japanese';

interface AppState {
  activeLevel: LevelType;
  activeSection: SectionType;
  activeLesson: number;
  showTranslations: boolean;
  
  // Actions
  setActiveLevel: (level: LevelType) => void;
  setActiveSection: (section: SectionType) => void;
  setActiveLesson: (lesson: number) => void;
  setShowTranslations: (show: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeLevel: 'N3',
      activeSection: 'grammar',
      activeLesson: 1,
      showTranslations: true,

      setActiveLevel: (level: LevelType) => set({ activeLevel: level }),
      setActiveSection: (section: SectionType) => set({ activeSection: section }),
      setActiveLesson: (lesson: number) => set({ activeLesson: lesson }),
      setShowTranslations: (show: boolean) => set({ showTranslations: show }),
    }),
    {
      name: 'app-ui-storage', // unique name
      partialize: (state) => ({ showTranslations: state.showTranslations }), // Only persist showTranslations
    }
  )
);
