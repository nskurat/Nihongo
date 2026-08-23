import React, { useMemo } from 'react';
import { parseFuriganaTokens } from '../services/ai/readingParser';

/**
 * Renders Japanese text with native Furigana Ruby annotations.
 * Keeps Kanji and Kana perfectly aligned on the exact same baseline.
 *
 * @param {string} text - Japanese text containing bracketed readings, e.g. 漢字[かんじ]
 * @param {'always' | 'hover' | 'off'} mode - Furigana display mode
 * @param {string} className - Additional CSS classes
 */
export default function FuriganaText({ text = '', mode = 'always', className = '' }) {
  const tokens = useMemo(() => parseFuriganaTokens(text), [text]);

  return (
    <span className={`furigana-wrapper furigana-mode-${mode} ${className}`}>
      {tokens.map((token, idx) => {
        if (token.type === 'ruby') {
          return (
            <ruby key={idx}>
              {token.base}
              <rt>{token.ruby}</rt>
            </ruby>
          );
        }
        return <span key={idx}>{token.content}</span>;
      })}
    </span>
  );
}
