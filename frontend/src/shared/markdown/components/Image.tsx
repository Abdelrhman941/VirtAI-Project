import React from 'react';

export function Image({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      src={src}
      alt={alt || 'Image'}
      loading="lazy"
      decoding="async"
      className="rounded-md border border-white/10 max-w-full h-auto my-4"
      {...props}
    />
  );
}
