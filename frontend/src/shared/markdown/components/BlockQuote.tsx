import React from 'react';

export function BlockQuote({ children, ...props }: React.BlockquoteHTMLAttributes<HTMLQuoteElement>) {
  return (
    <blockquote className="border-l-4 border-[#c9c0a0]/40 bg-white/5 py-1 px-5 rounded-r-lg not-italic text-gray-300 my-6" {...props}>
      {children}
    </blockquote>
  );
}
