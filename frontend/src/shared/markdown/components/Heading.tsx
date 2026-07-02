import React from 'react';

function getAnchorId(children: React.ReactNode): string {
  const text = React.Children.toArray(children)
    .map((child) => {
      if (typeof child === 'string' || typeof child === 'number') {
        return String(child);
      }
      return '';
    })
    .join('');

  return text
    .toLowerCase()
    .replace(/[^\w\s-]+/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export function Heading(level: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') {
  const Tag = level;
  const HeadingComponent = ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
    const id = getAnchorId(children);
    return (
      <Tag id={id} className="scroll-mt-24" {...props}>
        {children}
      </Tag>
    );
  };
  HeadingComponent.displayName = `Heading(${level})`;
  return HeadingComponent;
}
