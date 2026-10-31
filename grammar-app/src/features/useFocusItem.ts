import { useEffect, useState } from 'react';
import { useLocation, useNavigationType, useSearchParams } from 'react-router-dom';
import { hasSavedScroll } from './useScrollRestore';
import { prefersReducedMotion } from './search/useMediaQuery';

export const FOCUS_HIGHLIGHT_MS = 2500;

interface FocusItemResult {
  /** The `?focus=` uid, if any. */
  focusUid: string | null;
  /** True for ~2.5 s after the item was scrolled into view. */
  highlighting: boolean;
}

/**
 * Deep-link target from search (03-ux §2 F1, §5.4): reads `?focus=<uid>`, waits until the
 * card with `data-uid` has rendered (`ready`), scrolls it into view, moves focus to it (or
 * to its `[data-focus-target]`, e.g. grammar's Deep Dive button) and plays the highlight.
 * `clearFilter` runs when a new focus arrives so the per-lesson filter never hides it.
 */
export function useFocusItem(ready: boolean, clearFilter?: () => void): FocusItemResult {
  const [params] = useSearchParams();
  const focusUid = params.get('focus');
  const { key } = useLocation();
  const navType = useNavigationType();
  const [handled, setHandled] = useState<string | null>(null);
  const [highlightUid, setHighlightUid] = useState<string | null>(null);
  const [clearedFor, setClearedFor] = useState<string | null>(null);

  // New focus target → clear the lesson filter (state adjustment during render).
  if (focusUid && clearedFor !== focusUid) {
    setClearedFor(focusUid);
    clearFilter?.();
  }

  useEffect(() => {
    if (!ready || !focusUid || handled === focusUid) return;
    // Back/Forward into an entry with a saved position: scroll restore wins, no replay.
    if (navType === 'POP' && hasSavedScroll(key)) return;
    const card = document.querySelector<HTMLElement>(`[data-uid="${CSS.escape(focusUid)}"]`);
    if (!card) return;
    const reduce = prefersReducedMotion();
    // Defer one frame so layout (sidebar scroll, images) has settled.
    const raf = requestAnimationFrame(() => {
      card.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
      const target = card.querySelector<HTMLElement>('[data-focus-target]') ?? card;
      target.focus({ preventScroll: true });
      setHandled(focusUid);
      setHighlightUid(focusUid);
    });
    return () => cancelAnimationFrame(raf);
  }, [ready, focusUid, handled, navType, key]);

  useEffect(() => {
    if (!highlightUid) return;
    const t = setTimeout(() => setHighlightUid(null), FOCUS_HIGHLIGHT_MS);
    return () => clearTimeout(t);
  }, [highlightUid]);

  return { focusUid, highlighting: !!focusUid && highlightUid === focusUid };
}

/** Card classes for the focus target: amber ring while highlighting, fades out after. */
export function focusCardClass(uid: string, focus: FocusItemResult): string {
  if (uid !== focus.focusUid) return '';
  const base = 'transition-[box-shadow,background-color] duration-700 motion-reduce:transition-none';
  return focus.highlighting ? `${base} ring-2 ring-amber-400 ring-offset-2 bg-amber-50/40` : base;
}
