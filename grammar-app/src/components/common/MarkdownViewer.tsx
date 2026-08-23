import { useMemo } from 'react';
import { marked } from 'marked';

interface MarkdownViewerProps {
  content?: string;
  className?: string;
}

export default function MarkdownViewer({ content = '', className = '' }: MarkdownViewerProps) {
  const html = useMemo(() => {
    if (!content) return '';
    try {
      return marked.parse(content, { async: false }) as string;
    } catch {
      return content;
    }
  }, [content]);

  return (
    <div
      className={`prose prose-slate prose-xs max-w-none prose-p:leading-relaxed prose-headings:font-bold prose-code:text-indigo-600 prose-code:bg-indigo-50/70 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
