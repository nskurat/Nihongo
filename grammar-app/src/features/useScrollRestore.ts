import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const positions = new Map<string, number>();
const SETTLE_MS = 120;

/** Whether a scroll position was recorded for this history entry (a Back into it restores). */
export function hasSavedScroll(key: string): boolean {
  return positions.has(key);
}

if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  // Content renders asynchronously, so the browser's own restoration fires too early.
  window.history.scrollRestoration = 'manual';
}

/**
 * Saves window scroll per history entry (`location.key`) while the page is shown and, on a
 * Back/Forward (POP) into that entry, restores it once `ready` (content rendered).
 * Used by the lesson sections and /search (03-ux §7.1). `scrollTopOnPush` scrolls a fresh
 * (PUSH) entry to the top; REPLACE (typing, filters) leaves scroll alone.
 */
export function useScrollRestore(ready: boolean, { scrollTopOnPush = false } = {}): void {
  const { key } = useLocation();
  const navType = useNavigationType();

  // Record once scrolling has settled. A scroll that the *next* page causes (the document
  // shrinking and clamping scrollY during navigation) never settles before this page's
  // cleanup runs, so it can't overwrite the position the learner left at (BUG-08).
  useEffect(() => {
    // A REPLACE (typing, filters) keeps the page where it is: start this entry from there.
    if (navType === 'REPLACE' && !positions.has(key)) positions.set(key, window.scrollY);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(() => positions.set(key, window.scrollY), SETTLE_MS);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
    };
  }, [key, navType]);

  useEffect(() => {
    if (!ready) return;
    if (navType === 'POP') {
      const y = positions.get(key);
      if (y !== undefined) window.scrollTo(0, y);
    } else if (navType === 'PUSH' && scrollTopOnPush) {
      window.scrollTo(0, 0);
    }
    // Only once per entry becoming ready.
  }, [ready, key, navType, scrollTopOnPush]);
}
