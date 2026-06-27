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
    return sanitized;
  }, [content]);
  
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    if (!rootRef.current) return;
    
    const existingCursor = rootRef.current.querySelector('.md-streaming-cursor-injected');
    if (existingCursor) {
      existingCursor.remove();
    }

    if (!streaming) return;

    const cursor = document.createElement('span');
    cursor.className = 'inline-block w-[0.5ch] h-[1em] align-middle bg-current rounded-[1px] ml-1 translate-y-[0.1em] animate-[pulse_1s_ease-in-out_infinite] md-streaming-cursor-injected';
    cursor.setAttribute('aria-hidden', 'true');

    const root = rootRef.current;
    const blocks = Array.from(root.querySelectorAll('p, li, pre, td, th, h1, h2, h3, h4, h5, h6, blockquote'));
    const lastBlock = blocks[blocks.length - 1];
    
    if (lastBlock) {
      lastBlock.appendChild(cursor);
    } else {
      root.appendChild(cursor);
    }

    return () => {
      cursor.remove();
    };
  }, [sanitizedContent, streaming]);

  return (
    <div 
      ref={rootRef}
      dir="auto"
      className={`prose prose-invert prose-p:leading-relaxed prose-headings:font-semibold prose-a:text-blue-400 hover:prose-a:text-blue-300 prose-hr:border-white/20 prose-hr:my-8 prose-li:my-1 prose-ul:my-2 prose-ol:my-2 prose-pre:p-0 prose-pre:bg-transparent max-w-none ${className}`.trim()} 
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
