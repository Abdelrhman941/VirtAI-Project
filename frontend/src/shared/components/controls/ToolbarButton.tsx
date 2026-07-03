import React, { ReactNode } from 'react';

export interface ToolbarButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  label: string;
}

export function ToolbarButton({ icon, label, className = '', ...props }: ToolbarButtonProps) {
  return (
    <button
      {...props}
      className={`flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-transparent border border-white/10 text-white/90 hover:bg-white/10 transition-colors duration-300 ease-in-out shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed cursor-pointer ${className}`}
    >
      {icon}
      <span className="text-[13px] font-semibold tracking-wide font-sans">{label}</span>
    </button>
  );
}
