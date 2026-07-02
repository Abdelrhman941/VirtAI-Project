import { defaultSchema } from 'rehype-sanitize';

const codeAttrs = defaultSchema.attributes?.code ?? [];
const spanAttrs = defaultSchema.attributes?.span ?? [];

/**
 * Sanitize schema for RAG output.
 * - Preserves code language classes (`language-*`) for Shiki.
 * - Preserves KaTeX-generated inline styles + math roles on span nodes.
 * - Explicitly blocks iframe/object/embed/script even though rehype-sanitize
 *   defaults already do; making it explicit protects us if defaults change.
 */
export const virtaiSanitizeSchema = {
  ...defaultSchema,
  tagNames: (defaultSchema.tagNames ?? []).filter(
    (t) => !['iframe', 'object', 'embed', 'script'].includes(t),
  ),
  attributes: {
    ...defaultSchema.attributes,
    code: [...codeAttrs, ['className', /^language-./]],
    span: [...spanAttrs, ['className', /^katex/], 'style', 'aria-hidden'],
  },
};
