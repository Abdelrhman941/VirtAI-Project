export const PROSE = {
  base: 'prose prose-invert max-w-none text-foreground/90',
  chat: 'prose-sm prose-p:leading-[1.7] prose-p:my-3 prose-headings:mt-6 prose-headings:mb-3',
  explain: 'prose-base prose-p:leading-[1.8] prose-p:my-4 prose-headings:mt-10 prose-headings:mb-4',
  summary: 'prose-sm prose-p:leading-relaxed',
} as const;

export type MarkdownVariant = keyof typeof PROSE;
