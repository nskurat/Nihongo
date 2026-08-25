import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  showTranslations: boolean;

  // Actions
  setShowTranslations: (show: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      showTranslations: true,

      setShowTranslations: (show: boolean) => set({ showTranslations: show }),
    }),
    {
      name: 'app-ui-storage', // unique name
      partialize: (state) => ({ showTranslations: state.showTranslations }), // Only persist showTranslations
    }
  )
);
