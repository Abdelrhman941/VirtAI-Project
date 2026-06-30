import React, { type ComponentPropsWithoutRef } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

// ---------------------------------------------------------------------------
// Component map
// ---------------------------------------------------------------------------

const MdCode: React.FC<ComponentPropsWithoutRef<'code'> & { inline?: boolean }> = ({
  inline,
  className,
  children,
}) => {
  const text = String(children);
  if (inline) {
    return (
      <code className="bg-dark-secondary text-pink-400 px-1.5 py-0.5 rounded text-sm font-mono border border-white/10" dir="auto">
        {text}
      </code>
    );
  }
  const lang = (className ?? '').replace('language-', '');
  return (
    <div className="relative group my-4 rounded-lg overflow-hidden border border-white/10 bg-[#0d1117]">
      {lang && (
        <div className="absolute top-0 right-0 px-3 py-1 text-xs font-mono text-gray-400 bg-white/5 border-b border-l border-white/10 rounded-bl-lg select-none uppercase z-10">
          {lang}
        </div>
      )}
      <pre className="overflow-x-auto p-4 text-sm m-0 bg-transparent" dir="ltr">
        <code className={className}>{text}</code>
      </pre>
    </div>
  );
};

const MARKDOWN_COMPONENTS: Components = {
  code: MdCode as Components['code'],
};

const REMARK_PLUGINS = [remarkGfm, remarkMath];
const REHYPE_PLUGINS = [rehypeKatex];

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

const PROSE_CLASSES = [
  'prose',
  'prose-invert',
  'max-w-none',
  // Text & Colors
  'text-gray-300',
  'prose-p:leading-relaxed',
  'prose-p:my-4',
  'prose-strong:text-white',
  'prose-strong:font-semibold',
  // Headings
  'prose-headings:text-white',
  'prose-headings:font-bold',
  'prose-headings:tracking-tight',
  'prose-h1:text-3xl',
  'prose-h1:mt-10',
  'prose-h1:mb-6',
  'prose-h1:border-b',
  'prose-h1:border-white/10',
  'prose-h1:pb-4',
  'prose-h2:text-2xl',
  'prose-h2:mt-10',
  'prose-h2:mb-4',
  'prose-h3:text-xl',
  'prose-h3:mt-8',
  'prose-h3:mb-3',
  'prose-h4:text-lg',
  // Links
  'prose-a:text-gold-soft',
  'prose-a:no-underline',
  'hover:prose-a:underline',
  'hover:prose-a:text-gold',
  // Lists (CRITICAL FOR GAPS)
  'prose-ul:my-4',
  'prose-ol:my-4',
  'prose-li:my-0.5',
  '[&_li>p]:my-0', // Extremely important: removes huge gaps in nested lists
  'prose-ul:list-disc',
  'prose-ol:list-decimal',
  '[&_li::marker]:text-white/40',
  // Blockquotes
  'prose-blockquote:border-l-4',
  'prose-blockquote:border-gold-soft/40',
  'prose-blockquote:bg-white/5',
  'prose-blockquote:py-1',
  'prose-blockquote:px-5',
  'prose-blockquote:rounded-r-lg',
  'prose-blockquote:not-italic',
  'prose-blockquote:text-gray-300',
  'prose-blockquote:my-6',
  // Tables
  'prose-table:w-full',
  'prose-table:border-collapse',
  'prose-table:my-6',
  'prose-th:border',
  'prose-th:border-white/20',
  'prose-th:bg-white/10',
  'prose-th:p-3',
  'prose-th:text-left',
  'prose-th:font-semibold',
  'prose-td:border',
  'prose-td:border-white/10',
  'prose-td:p-3',
  // Code Blocks & Inline Code
  'prose-pre:p-0',
  'prose-pre:m-0',
  'prose-pre:bg-transparent',
  'prose-code:before:content-none',
  'prose-code:after:content-none',
  // Misc
  'prose-hr:border-t-2',
  'prose-hr:border-white/30',
  'prose-hr:my-6',
].join(' ');

export interface MarkdownRendererProps {
  content: string;
  streaming?: boolean;
  className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  streaming = false,
  className = '',
}) => {
  const sanitizedContent = React.useMemo(() => {
    let sanitized = content.replace(/\n{3,}/g, '\n\n');
    sanitized = sanitized.replace(/^((?:[\p{Extended_Pictographic}\p{Emoji_Presentation}]\s*)+)\n+(?=#+\s)/gmu, '$1 ');
    
    // Convert LaTeX math delimiters to markdown math delimiters
    // \[ ... \] -> $$ ... $$
    sanitized = sanitized.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');
    // \( ... \) -> $ ... $
    sanitized = sanitized.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');
    
    return sanitized;
  }, [content]);
  
  const rootRef = React.useRef<HTMLDivElement>(null);

  return (
    <div 
      ref={rootRef}
      dir="auto"
      className={`${PROSE_CLASSES} ${streaming ? 'streaming-active' : ''} ${className}`.trim()} 
    >
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={MARKDOWN_COMPONENTS}
      >
        {sanitizedContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
