import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GrammarExampleSentence } from '../services/ai/registry';
import {
  V5_REPLACED_KANJI_UIDS,
  V6_FIRST_SHIFTED_VOCAB_UIDS,
  V7_FIRST_SHIFTED_VOCAB_UIDS,
  withoutKeys,
  withoutShiftedUids,
} from './aiCacheMigration';

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
      // v3: N4 uids were renumbered (n4-grammar-30-1 became n4-grammar-5-1), so
      // v2 entries would attach cached text to the wrong item.
      // v4: the level audit moved, dropped and renumbered N3/N4 grammar points, so
      // v3 entries would do the same.
      // v5: the N3 kanji review reused 24 kanji slots; only their cached mnemonics
      // are dropped, so a v4 cache otherwise survives intact.
      // v6: redundant vocab rows were removed and later uids in those lessons shifted;
      // only vocab notes under shifted uids are dropped.
      // v7: cumulative N5/N4 coverage shifted N2/N1 (and one N3) vocab uids; same treatment.
      version: 7,
      migrate: (persisted, version) => {
        const state = persisted as AiCacheState | undefined;
        if (version >= 4 && version <= 6 && state) {
          const kanji = version === 4 ? withoutKeys(state.aiKanjiMnemonics ?? {}, V5_REPLACED_KANJI_UIDS) : state.aiKanjiMnemonics ?? {};
          let notes = state.aiVocabNotes ?? {};
          if (version < 6) notes = withoutShiftedUids(notes, V6_FIRST_SHIFTED_VOCAB_UIDS);
          notes = withoutShiftedUids(notes, V7_FIRST_SHIFTED_VOCAB_UIDS);
          return { ...state, aiKanjiMnemonics: kanji, aiVocabNotes: notes } as AiCacheState;
        }
        return {
          generatedExamples: {},
          aiExplanations: {},
          aiVocabNotes: {},
          aiKanjiMnemonics: {},
        } as AiCacheState;
      },
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
