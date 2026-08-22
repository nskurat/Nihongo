import React, { useMemo } from 'react';
import { marked } from 'marked';

// Configure marked with standard GFM support
marked.setOptions({
  gfm: true,
  breaks: true,
});

export default function MarkdownViewer({ content = '', className = '' }) {
  const htmlContent = useMemo(() => {
    if (!content) return '';
    try {
      return marked.parse(content);
    } catch (err) {
      console.error('Markdown parse error:', err);
      return content;
    }
  }, [content]);

  return (
    <div
      className={`markdown-prose text-slate-800 leading-relaxed text-sm ${className}`}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}
