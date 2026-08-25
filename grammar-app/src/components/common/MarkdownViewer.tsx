import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface MarkdownViewerProps {
  content?: string;
  className?: string;
}

export default function MarkdownViewer({ content = '', className = '' }: MarkdownViewerProps) {
  const html = useMemo(() => {
    if (!content) return '';
    try {
      const parsed = marked.parse(content, { async: false }) as string;
      return DOMPurify.sanitize(parsed);
    } catch {
      return DOMPurify.sanitize(content);
    }
  }, [content]);

  return (
    <div
      className={`markdown-prose ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
