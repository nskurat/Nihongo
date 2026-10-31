import { useEffect, useState, type ReactNode } from 'react';

export const LIVE_DELAY_MS = 500;

interface SearchStatusProps {
  /** Visible status line (count + notes). */
  children?: ReactNode;
  /** Message for screen readers; announced once it has been stable for 500 ms. */
  announce: string;
}

/** Visible count line plus a polite, visually hidden live region (03-ux §4.4). */
export default function SearchStatus({ children, announce }: SearchStatusProps) {
  const [spoken, setSpoken] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSpoken(announce), LIVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [announce]);

  return (
    <>
      {children}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {spoken}
      </div>
    </>
  );
}
