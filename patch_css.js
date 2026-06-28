const fs = require('fs');
const file = '/mnt/d/A/Projects/VirtAI-Project/frontend/src/shared/components/MarkdownRenderer.css';
let code = fs.readFileSync(file, 'utf8');

// The file got messed up. Let's fix the variables block cleanly.
const cssRoot = code.split('.md-root {')[1].split('}')[0];

const newRoot = `
  /* Typography basics */
  --md-font-body: 'General Sans', 'Noto Sans Arabic', 'Segoe UI', system-ui, sans-serif;
  --md-font-mono: 'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, monospace;

  --md-font-size: 1rem;          /* 16px - Stronger base size */
  --md-line-height: 1.6;         /* Elegant, readable spacing */
  --md-letter-spacing: 0.005em;

  /* Heading scale */
  --md-h1-size: 1.45rem;
  --md-h2-size: 1.22rem;
  --md-h3-size: 1.1rem;
  --md-h4-size: 0.98rem;
  --md-h5-size: 0.92rem;
  --md-h6-size: 0.875rem;
  --md-heading-weight: 650;
  --md-heading-line-height: 1.3;

  /* Vertical rhythm - Premium Obsidian/ChatGPT scaling */
  --md-block-gap: 1.0em;         /* Clean separation between blocks */
  --md-para-gap: 0.75em;         /* Balanced paragraph rhythm */
  --md-heading-above: 1.5em;     /* Strong structural hierarchy */
  --md-heading-below: 0.5em;     /* Anchors heading to content */
  --md-list-gap: 0.25em;         /* Lists are cohesive but readable */
  --md-code-margin: 0.75em;      

  /* Color palette */
  --md-text: rgba(255, 255, 255, 0.88);
  --md-text-muted: rgba(255, 255, 255, 0.65);
  --md-heading: rgba(255, 255, 255, 0.95);
  --md-link: #60a5fa;
  --md-link-hover: #93c5fd;
  
  --md-bg-code-inline: rgba(255, 255, 255, 0.08);
  --md-bg-code-block: #0d1117;
  --md-border-code: rgba(255, 255, 255, 0.12);
  
  --md-border-table: rgba(255, 255, 255, 0.15);
  --md-bg-table-head: rgba(255, 255, 255, 0.05);
  --md-bg-table-row: transparent;
  --md-bg-table-row-alt: rgba(255, 255, 255, 0.02);
  
  --md-border-blockquote: rgba(255, 255, 255, 0.2);
  --md-text-blockquote: rgba(255, 255, 255, 0.75);

  --md-cursor-color: #f8fafc;
`;

code = code.replace(cssRoot, newRoot);
fs.writeFileSync(file, code);
console.log('patched CSS variables');
