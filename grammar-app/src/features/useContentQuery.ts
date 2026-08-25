import { useCallback, useEffect, useState } from 'react';
import { contentRepository } from '../services/content/StaticContentSource';
import { ContentError } from '../services/content/ContentSource';
import { Level, ContentSection, StudyItem } from '../types/content';

interface ContentQueryResult<T> {
  items: T[];
  loading: boolean;
  error: ContentError | null;
  retry: () => void;
}

interface QueryState<T> {
  key: string;
  items: T[];
  error: ContentError | null;
}

const EMPTY_STATE: QueryState<never> = { key: '', items: [], error: null };

/**
 * Loads one lesson's items through the content repository. `loading` is
 * derived by comparing the request this state was written for against the
 * request the current render actually wants, rather than an explicit
 * setState(true) at the top of the effect - the effect body itself never
 * calls setState synchronously (react-hooks/set-state-in-effect), only from
 * inside the promise callbacks once the fetch actually settles.
 */
export function useContentQuery<T extends StudyItem>(
  level: Level,
  section: ContentSection,
  lesson: number
): ContentQueryResult<T> {
  const [retryToken, setRetryToken] = useState(0);
  const key = `${level}:${section}:${lesson}:${retryToken}`;
  const [state, setState] = useState<QueryState<T>>(EMPTY_STATE);

  useEffect(() => {
    let cancelled = false;

    contentRepository.getItems<T>(level, section, lesson).then(
      (items) => {
        if (!cancelled) setState({ key, items, error: null });
      },
      (err: unknown) => {
        if (!cancelled) {
          setState({
            key,
            items: [],
            error: err instanceof ContentError ? err : new ContentError('load-failed', err),
          });
        }
      }
    );

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` encodes level/section/lesson/retryToken already
  }, [key]);

  const retry = useCallback(() => setRetryToken((t) => t + 1), []);
  const loading = state.key !== key;

  return {
    items: loading ? [] : state.items,
    loading,
    error: loading ? null : state.error,
    retry,
  };
}
