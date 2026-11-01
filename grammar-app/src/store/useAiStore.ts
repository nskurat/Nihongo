import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ArtifactCache, ArtifactData, ArtifactKind, putArtifact } from '../services/ai/artifactCache';
import { AiError, isMissingKey, toAiError } from '../services/ai/errors';
import { migrateAiCache } from './aiCacheMigration';

/**
 * Everything AI has generated for study items, persisted so a paid-for result is never
 * requested twice. One map for every kind (see services/ai/artifactCache.ts), capped by
 * entry count and size, least-recently-generated evicted first.
 */
interface AiArtifactState {
  artifacts: ArtifactCache;
  put: <K extends ArtifactKind>(kind: K, uid: string, data: ArtifactData[K]) => void;
}

export const useAiArtifactStore = create<AiArtifactState>()(
  persist(
    (set) => ({
      artifacts: {},
      put: (kind, uid, data) => set((state) => ({ artifacts: putArtifact(state.artifacts, kind, uid, data, Date.now()) })),
    }),
    {
      // Same key as before: v7 data (four maps) migrates in place, nothing lost.
      name: 'ai-generation-cache',
      // v1–v3 keyed by ids that collided across levels or were renumbered (start empty);
      // v4–v7 survive minus uids later content changes reassigned (aiCacheMigration.ts);
      // v8 replaces the four per-feature maps with one artifact map; v9 renames vocab
      // notes whose uids moved (core expressions, vocab dedupe).
      version: 9,
      partialize: (state) => ({ artifacts: state.artifacts }),
      migrate: (persisted, version) => migrateAiCache(persisted, version) as unknown as AiArtifactState,
    }
  )
);

/** Ephemeral AI UI state: request status per artifact, the key modal, the last error. */
interface AiUiState {
  /** artifactKey → a request is in flight. */
  pending: Record<string, boolean>;
  /** artifactKey → the last failure (cleared when a retry starts). */
  errors: Record<string, AiError>;
  showKeyModal: boolean;
  apiError: string;

  setPending: (key: string, pending: boolean) => void;
  setError: (key: string, error: AiError | null) => void;
  setShowKeyModal: (show: boolean) => void;
  setApiError: (error: string) => void;
  /** A missing key opens AI settings; anything else is remembered for the settings modal. */
  handleApiError: (error: unknown) => void;
}

export const useAiUiStore = create<AiUiState>((set) => ({
  pending: {},
  errors: {},
  showKeyModal: false,
  apiError: '',

  setPending: (key, pending) => set((state) => ({ pending: { ...state.pending, [key]: pending } })),
  setError: (key, error) =>
    set((state) => {
      const errors = { ...state.errors };
      if (error) errors[key] = error;
      else delete errors[key];
      return { errors };
    }),
  setShowKeyModal: (show) => set({ showKeyModal: show }),
  setApiError: (error) => set({ apiError: error }),

  handleApiError: (error: unknown) => {
    if (isMissingKey(error)) {
      set({ showKeyModal: true, apiError: '' });
    } else {
      set({ apiError: toAiError(error).message });
      console.error('AI Error:', error);
    }
  },
}));
