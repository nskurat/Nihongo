import { useMemo } from 'react';
import { parseFuriganaTokens } from '../services/ai/readingParser';

interface FuriganaTextProps {
  text?: string;
  mode?: 'always' | 'hover' | 'off';
  className?: string;
}

/**
 * Renders Japanese text with native Furigana Ruby annotations.
 * Keeps Kanji and Kana perfectly aligned on the exact same baseline.
 */
export default function FuriganaText({ text = '', mode = 'always', className = '' }: FuriganaTextProps) {
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
