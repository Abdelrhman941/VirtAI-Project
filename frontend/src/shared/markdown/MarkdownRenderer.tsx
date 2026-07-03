import 'katex/dist/katex.min.css';
import React, { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/shared/utils/cn';
import { markdownComponents } from './components';
import { REHYPE_PLUGINS } from './plugins/rehypePlugins';
import { REMARK_PLUGINS } from './plugins/remarkPlugins';
import { PROSE, type MarkdownVariant } from './theme';
import './theme.css';
import { normalizeMarkdown } from './utils/normalizeMarkdown';

export interface MarkdownRendererProps {
  content: string;
  variant?: MarkdownVariant;
  className?: string;
  dir?: 'auto' | 'ltr' | 'rtl';
}

const MarkdownRendererImpl: React.FC<MarkdownRendererProps> = ({
  content,
  variant = 'chat',
  className,
  dir = 'auto',
}) => {
  const normalized = useMemo(() => normalizeMarkdown(content), [content]);
  return (
    <div dir={dir} className={cn(PROSE.base, PROSE[variant], className)}>
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS as any}
        components={markdownComponents}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
};

MarkdownRendererImpl.displayName = 'MarkdownRendererImpl';

/**
 * Memoized on `content` + `variant`. Re-renders on every streamed delta,
 * but child MDX elements are shallow-equal-stable, so React reconciles cheaply.
 */
export const MarkdownRenderer = memo(MarkdownRendererImpl, (a, b) =>
  a.content === b.content && a.variant === b.variant && a.className === b.className,
);
