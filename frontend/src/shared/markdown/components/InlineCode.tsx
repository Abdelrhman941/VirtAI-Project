import React from 'react';

export function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-white/5 text-pink-400 px-1.5 py-0.5 rounded text-[0.9em] font-mono border border-white/10" dir="auto">
      {children}
    </code>
  );
}
