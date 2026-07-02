import React from 'react';

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto my-6 rounded-lg border border-white/10">
      <table className="w-full border-collapse text-left text-sm [&_th]:p-3 [&_th]:bg-white/10 [&_th]:border-b [&_th]:border-white/20 [&_th]:font-semibold [&_td]:p-3 [&_td]:border-b [&_td]:border-white/10 [&_tr:last-child_td]:border-none">
        {children}
      </table>
    </div>
  );
}
