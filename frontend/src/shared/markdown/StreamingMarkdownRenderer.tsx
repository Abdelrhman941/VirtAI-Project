import React, { memo, useMemo } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import type { MarkdownVariant } from './theme';
import { splitForStreaming } from './utils/splitForStreaming';
import { StreamingCursor } from './utils/streamingCursor';

export interface StreamingMarkdownRendererProps {
  content: string;
  variant?: MarkdownVariant;
  className?: string;
  streaming?: boolean;
}

const Impl: React.FC<StreamingMarkdownRendererProps> = ({
  content,
  variant = 'chat',
  className,
  streaming = false,
}) => {
  const { prefix, tail } = useMemo(() => splitForStreaming(content), [content]);
  return (
    <div className={className}>
      {prefix && <MarkdownRenderer content={prefix} variant={variant} />}
      <MarkdownRenderer content={tail} variant={variant} />
      {streaming && <StreamingCursor />}
    </div>
  );
};

Impl.displayName = 'StreamingMarkdownRendererImpl';

export const StreamingMarkdownRenderer = memo(Impl);
