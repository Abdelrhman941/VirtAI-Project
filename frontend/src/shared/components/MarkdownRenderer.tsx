import React, { type ComponentPropsWithoutRef } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './MarkdownRenderer.css';

// ---------------------------------------------------------------------------
// Semantic component overrides
// ---------------------------------------------------------------------------

type WithChildren = { children?: React.ReactNode };

// Heading factory
function makeHeading(level: 1 | 2 | 3 | 4 | 5 | 6) {
  const Tag = `h${level}` as React.ElementType;
  const HeadingComponent: React.FC<WithChildren> = ({ children }) => (
    <Tag className={`md-h${level}`} dir="auto">
      {children}
    </Tag>
  );
  HeadingComponent.displayName = `MdH${level}`;
  return HeadingComponent;
}

const MdParagraph: React.FC<WithChildren> = ({ children }) => (
  <p className="md-p" dir="auto">
    {children}
  </p>
);

const MdUl: React.FC<WithChildren> = ({ children }) => (
  <ul className="md-ul" dir="auto">{children}</ul>
);

const MdOl: React.FC<
  WithChildren & { start?: number; ordered?: boolean }
> = ({ children, start }) => (
  <ol className="md-ol" start={start} dir="auto">
    {children}
  </ol>
);

const MdLi: React.FC<WithChildren & { checked?: boolean | null }> = ({
  children,
  checked,
}) => {
  if (checked !== null && checked !== undefined) {
    // Task list item
    return (
      <li className="md-task-item" dir="auto">
        <span
          className={`md-checkbox ${checked ? 'md-checkbox--checked' : ''}`}
          role="checkbox"
          aria-checked={checked}
        >
          {checked ? (
            <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <polyline
                points="2,6 5,9 10,3"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
        </span>
        <span className="md-task-content" dir="auto">{children}</span>
      </li>
    );
  }
  return (
    <li className="md-li" dir="auto">
      {children}
    </li>
  );
};

const MdBlockquote: React.FC<WithChildren> = ({ children }) => (
  <blockquote className="md-blockquote" dir="auto">
    {children}
  </blockquote>
);

type CodeProps = ComponentPropsWithoutRef<'code'> & {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
};

const MdCode: React.FC<CodeProps> = ({ inline, className, children }) => {
  const text = String(children);

  if (inline) {
    return (
      <code className="md-inline-code" dir="auto">
        {text}
      </code>
    );
  }
  // Extract language from className like "language-python"
  const lang = (className ?? '').replace('language-', '');
  return (
    <pre className="md-pre" data-lang={lang || undefined} dir="auto">
      {lang && <span className="md-pre-lang" dir="auto">{lang}</span>}
      <code className="md-code-block" dir="auto">
        {text}
      </code>
    </pre>
  );
};

const MdTable: React.FC<WithChildren> = ({ children }) => (
  <div className="md-table-wrapper" role="region" aria-label="Table" dir="auto">
    <table className="md-table">{children}</table>
  </div>
);

const MdThead: React.FC<WithChildren> = ({ children }) => (
  <thead className="md-thead">{children}</thead>
);

const MdTbody: React.FC<WithChildren> = ({ children }) => (
  <tbody className="md-tbody">{children}</tbody>
);

const MdTr: React.FC<WithChildren> = ({ children }) => (
  <tr className="md-tr">{children}</tr>
);

const MdTh: React.FC<WithChildren & { align?: 'left' | 'center' | 'right' | null }> = ({
  children,
  align,
}) => (
  <th
    className="md-th"
    style={align ? { textAlign: align === 'left' ? 'start' : align === 'right' ? 'end' : 'center' } : undefined}
    dir="auto"
  >
    {children}
  </th>
);

const MdTd: React.FC<WithChildren & { align?: 'left' | 'center' | 'right' | null }> = ({
  children,
  align,
}) => (
  <td
    className="md-td"
    style={align ? { textAlign: align === 'left' ? 'start' : align === 'right' ? 'end' : 'center' } : undefined}
    dir="auto"
  >
    {children}
  </td>
);

const MdHr: React.FC = () => <hr className="md-hr" />;

const MdA: React.FC<
  ComponentPropsWithoutRef<'a'> & { children?: React.ReactNode }
> = ({ href, children, ...rest }) => {
  return (
    <a
      className="md-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      dir="auto"
      {...rest}
    >
      {children}
    </a>
  );
};

const MdImg: React.FC<ComponentPropsWithoutRef<'img'>> = ({
  src,
  alt,
  ...rest
}) => (
  <span className="md-img-wrapper" dir="auto">
    <img className="md-img" src={src} alt={alt ?? ''} loading="lazy" {...rest} />
    {alt && <span className="md-img-caption" dir="auto">{alt}</span>}
  </span>
);

const MdStrong: React.FC<WithChildren> = ({ children }) => (
  <strong className="md-strong" dir="auto">{children}</strong>
);

const MdEm: React.FC<WithChildren> = ({ children }) => (
  <em className="md-em" dir="auto">{children}</em>
);

const MdDel: React.FC<WithChildren> = ({ children }) => (
  <del className="md-del" dir="auto">{children}</del>
);

// ---------------------------------------------------------------------------
// Component map
// ---------------------------------------------------------------------------

const MARKDOWN_COMPONENTS: Components = {
  h1: makeHeading(1),
  h2: makeHeading(2),
  h3: makeHeading(3),
  h4: makeHeading(4),
  h5: makeHeading(5),
  h6: makeHeading(6),
  p: MdParagraph as Components['p'],
  ul: MdUl as Components['ul'],
  ol: MdOl as Components['ol'],
  li: MdLi as Components['li'],
  blockquote: MdBlockquote as Components['blockquote'],
  code: MdCode as Components['code'],
  table: MdTable as Components['table'],
  thead: MdThead as Components['thead'],
  tbody: MdTbody as Components['tbody'],
  tr: MdTr as Components['tr'],
  th: MdTh as Components['th'],
  td: MdTd as Components['td'],
  hr: MdHr as Components['hr'],
  a: MdA as Components['a'],
  img: MdImg as Components['img'],
  strong: MdStrong as Components['strong'],
  em: MdEm as Components['em'],
  del: MdDel as Components['del'],
};

const REMARK_PLUGINS = [remarkGfm];

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export interface MarkdownRendererProps {
  /** The raw markdown string to render */
  content: string;
  /** If true, appends a blinking cursor after the content (streaming mode) */
  streaming?: boolean;
  /** Optional extra class for the root element */
  className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  streaming = false,
  className = '',
}) => {
  const sanitizedContent = React.useMemo(() => {
    let sanitized = content.replace(/\n{3,}/g, '\n\n');
    // If an emoji (or multiple) is alone on a line right before a heading, merge it into the heading
    sanitized = sanitized.replace(/^((?:[\p{Extended_Pictographic}\p{Emoji_Presentation}]\s*)+)\n+(?=#+\s)/gmu, '$1 ');
    return sanitized;
  }, [content]);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    if (!rootRef.current) return;
    
    // Always clean up existing cursor first
    const existingCursor = rootRef.current.querySelector('.md-streaming-cursor-injected');
    if (existingCursor) {
      existingCursor.remove();
    }

    if (!streaming) return;

    // Create cursor element
    const cursor = document.createElement('span');
    cursor.className = 'md-streaming-cursor md-streaming-cursor-injected';
    cursor.setAttribute('aria-hidden', 'true');

    // Find the best place to insert the cursor
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
    <div className={`md-root ${streaming ? 'md-streaming' : ''} ${className}`.trim()} dir="auto" ref={rootRef}>
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        components={MARKDOWN_COMPONENTS}
      >
        {sanitizedContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
