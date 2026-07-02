import React from 'react';

export function Marker({
  children,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-sm font-medium ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function MarkerIcon({
  children,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={`flex items-center justify-center text-[#b4ab8b] ${className}`} {...props}>
      {children}
    </span>
  );
}

export function MarkerContent({
  children,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={`text-gray-300 font-mono tracking-wide ${className}`} {...props}>
      {children}
    </span>
  );
}
