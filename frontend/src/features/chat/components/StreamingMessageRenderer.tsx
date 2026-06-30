import React from 'react';
import MarkdownRenderer from '@/shared/components/MarkdownRenderer';
import './StreamingMessageRenderer.css';

interface StreamingMessageRendererProps {
  content: string;
  isStreaming: boolean;
}

export const StreamingMessageRenderer = React.memo(function StreamingMessageRenderer({
  content,
  isStreaming
}: StreamingMessageRendererProps) {
  // We use the existing MarkdownRenderer but wrap it to apply the streaming CSS class
  // and append a cursor if streaming. The markdown renderer itself should be fast if memoized,
  // but this component ensures we control the streaming presentation and cursor.
  return (
    <div className={`streaming-message-container ${isStreaming ? 'is-streaming' : ''}`}>
      <MarkdownRenderer content={content} streaming={isStreaming} />
    </div>
  );
});
