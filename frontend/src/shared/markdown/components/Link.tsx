import React from 'react';

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> { }

export function Link({ href, children, ...props }: LinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-[#c9c0a0] no-underline hover:text-[#b4ab8b] hover:underline"
      {...props}
    >
      {children}
    </a>
  );
}
