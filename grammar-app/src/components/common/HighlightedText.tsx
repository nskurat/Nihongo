import { splitHighlights } from '../../features/search/highlight';

interface HighlightedTextProps {
  text: string;
  ranges?: [number, number][];
  lang?: string;
  className?: string;
}

/** Display string with service-supplied match ranges wrapped in <mark>. */
export default function HighlightedText({ text, ranges, lang, className }: HighlightedTextProps) {
  const segments = splitHighlights(text, ranges);
  return (
    <span lang={lang} className={className}>
      {segments.map((seg, i) =>
        seg.mark ? (
          <mark key={i} className="bg-amber-100 text-inherit rounded-sm px-0.5">
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </span>
  );
}
