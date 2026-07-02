import type { Components } from 'react-markdown';
import { BlockQuote } from './BlockQuote';
import { CodeBlock } from './CodeBlock';
import { Heading } from './Heading';
import { Image } from './Image';
import { InlineCode } from './InlineCode';
import { Link } from './Link';
import { ListItem } from './ListItem';
import { Mermaid } from './Mermaid';
import { Table } from './Table';

export const markdownComponents: Components = {
  code: ({ className, children, ...props }) => {
    const text = String(children).replace(/\n$/, '');
    const match = /language-(\w+)/.exec(className || '');
    const inline = !match;
    if (inline) return InlineCode({ children: text });
    const lang = match ? match[1] : undefined;
    if (lang === 'mermaid') return Mermaid({ code: text });
    return CodeBlock({ code: text, lang });
  },
  a: Link as any,
  table: Table as any,
  blockquote: BlockQuote as any,
  img: Image as any,
  li: ListItem as any,
  h1: Heading('h1') as any,
  h2: Heading('h2') as any,
  h3: Heading('h3') as any,
  h4: Heading('h4') as any,
  h5: Heading('h5') as any,
  h6: Heading('h6') as any,
};
