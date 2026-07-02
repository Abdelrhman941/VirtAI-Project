import rehypeKatex from 'rehype-katex';
import rehypeSanitize from 'rehype-sanitize';
import { virtaiSanitizeSchema } from './sanitizeSchema';

export const REHYPE_PLUGINS = [
  rehypeKatex,
  [rehypeSanitize, virtaiSanitizeSchema] as const,
];
