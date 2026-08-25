import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GrammarExampleSentence } from '../services/ai/registry';

// State that should be persisted across sessions (so we don't spam the API)
interface AiCacheState {
  generatedExamples: Record<string, GrammarExampleSentence[]>;
  aiExplanations: Record<string, string>;
  aiVocabNotes: Record<string, string>;
  aiKanjiMnemonics: Record<string, string>;

  // Actions
  addExamples: (id: string, examples: GrammarExampleSentence[]) => void;
  setExplanation: (id: string, explanation: string) => void;
  setVocabNote: (id: string, note: string) => void;
  setKanjiMnemonic: (id: string, mnemonic: string) => void;
}

export const useAiCacheStore = create<AiCacheState>()(
  persist(
    (set) => ({
      generatedExamples: {},
      aiExplanations: {},
      aiVocabNotes: {},
      aiKanjiMnemonics: {},

      addExamples: (id, newExamples) =>
        set((state) => ({
          generatedExamples: {
            ...state.generatedExamples,
            [id]: [...(state.generatedExamples[id] || []), ...newExamples],
          },
        })),

      setExplanation: (id, explanation) =>
        set((state) => ({
          aiExplanations: { ...state.aiExplanations, [id]: explanation },
        })),

      setVocabNote: (id, note) =>
        set((state) => ({
          aiVocabNotes: { ...state.aiVocabNotes, [id]: note },
        })),

      setKanjiMnemonic: (id, mnemonic) =>
        set((state) => ({
          aiKanjiMnemonics: { ...state.aiKanjiMnemonics, [id]: mnemonic },
        })),
    }),
    {
      name: 'ai-generation-cache', // unique name for localStorage
      // v1 cached entries by the data's own id, which collides across levels
      // (N5 and N3 grammar both start at "1-1") - see utils/uid.ts. Cached
      // text isn't worth migrating; v2 keys are shaped differently anyway,
      // so a version bump with no old-shape entries just starts empty.
      version: 2,
      migrate: () =>
        ({
          generatedExamples: {},
          aiExplanations: {},
          aiVocabNotes: {},
          aiKanjiMnemonics: {},
        }) as AiCacheState,
    }
  )
);

// State for ephemeral data like loading indicators and modal toggles
interface AiUiState {
  loadingExamples: Record<string, boolean>;
  loadingExplanations: Record<string, boolean>;
  loadingVocabAi: Record<string, boolean>;
  loadingKanjiAi: Record<string, boolean>;
  
  showKeyModal: boolean;
  apiError: string;

  // Actions
  setLoadingExamples: (id: string, loading: boolean) => void;
  setLoadingExplanations: (id: string, loading: boolean) => void;
  setLoadingVocabAi: (id: string, loading: boolean) => void;
  setLoadingKanjiAi: (id: string, loading: boolean) => void;
  
  setShowKeyModal: (show: boolean) => void;
  setApiError: (error: string) => void;
  handleApiError: (error: unknown) => void;
}

export const useAiUiStore = create<AiUiState>((set) => ({
  loadingExamples: {},
  loadingExplanations: {},
  loadingVocabAi: {},
  loadingKanjiAi: {},
  showKeyModal: false,
  apiError: '',

  setLoadingExamples: (id, loading) =>
    set((state) => ({ loadingExamples: { ...state.loadingExamples, [id]: loading } })),
  
  setLoadingExplanations: (id, loading) =>
    set((state) => ({ loadingExplanations: { ...state.loadingExplanations, [id]: loading } })),
  
  setLoadingVocabAi: (id, loading) =>
    set((state) => ({ loadingVocabAi: { ...state.loadingVocabAi, [id]: loading } })),
  
  setLoadingKanjiAi: (id, loading) =>
    set((state) => ({ loadingKanjiAi: { ...state.loadingKanjiAi, [id]: loading } })),

  setShowKeyModal: (show) => set({ showKeyModal: show }),
  setApiError: (error) => set({ apiError: error }),
  
  // Centralized error handler
  handleApiError: (error: unknown) => {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg === 'MISSING_KEY') {
      set({ showKeyModal: true, apiError: '' });
    } else {
      set({ apiError: msg });
      console.error('AI Error:', error);
    }
  },
}));
