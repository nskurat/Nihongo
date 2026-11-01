import { useCallback } from 'react';
import { ArtifactData, ArtifactKind, artifactKey, getArtifact } from '../services/ai/artifactCache';
import { AiError, aiErrorMessage, toAiError } from '../services/ai/errors';
import { useAiArtifactStore, useAiUiStore } from '../store/useAiStore';

/** Requests in flight, shared by every caller: a second click joins the first request. */
const inflight = new Map<string, Promise<void>>();

/**
 * Produces the new value for an artifact. Gets the cached value (if any) so a kind that
 * accumulates - grammar examples - can extend it.
 */
export type ArtifactProducer<K extends ArtifactKind> = (current: ArtifactData[K] | undefined) => Promise<ArtifactData[K]>;

export interface AiArtifacts<K extends ArtifactKind> {
  get: (uid: string) => ArtifactData[K] | undefined;
  isLoading: (uid: string) => boolean;
  /** One user-facing line when the last request for this item failed, else null. */
  errorOf: (uid: string) => string | null;
  /** Runs `producer` and caches its result. Never rejects; failures land in errorOf. */
  generate: (uid: string, producer: ArtifactProducer<K>) => Promise<void>;
}

const isEmpty = (data: unknown) => (Array.isArray(data) ? data.length === 0 : !data);

/**
 * AI results of one kind for a list of study items, with their request status. One hook
 * per list rather than per item, because cards render inside `.map()`.
 *
 * A missing key opens AI settings; any other failure is kept per item for the card to
 * show. A result that arrives after the card unmounts is still cached - it was paid for.
 */
export function useAiArtifacts<K extends ArtifactKind>(kind: K): AiArtifacts<K> {
  const artifacts = useAiArtifactStore((s) => s.artifacts);
  const pending = useAiUiStore((s) => s.pending);
  const errors = useAiUiStore((s) => s.errors);

  const generate = useCallback(
    (uid: string, producer: ArtifactProducer<K>) => {
      const key = artifactKey(kind, uid);
      const running = inflight.get(key);
      if (running) return running;

      const ui = useAiUiStore.getState();
      const run = (async () => {
        ui.setPending(key, true);
        ui.setError(key, null);
        try {
          const current = getArtifact(useAiArtifactStore.getState().artifacts, kind, uid);
          const data = await producer(current);
          if (isEmpty(data)) throw new AiError('bad-response', 'The reply was empty.');
          useAiArtifactStore.getState().put(kind, uid, data);
        } catch (err) {
          const error = toAiError(err);
          if (error.kind === 'missing-key') ui.handleApiError(error);
          else ui.setError(key, error);
        } finally {
          ui.setPending(key, false);
          inflight.delete(key);
        }
      })();
      inflight.set(key, run);
      return run;
    },
    [kind]
  );

  return {
    get: (uid) => getArtifact(artifacts, kind, uid),
    isLoading: (uid) => !!pending[artifactKey(kind, uid)],
    errorOf: (uid) => {
      const error = errors[artifactKey(kind, uid)];
      return error ? aiErrorMessage(error) : null;
    },
    generate,
  };
}
