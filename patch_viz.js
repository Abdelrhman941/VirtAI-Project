const fs = require('fs');
const file = 'frontend/src/features/chat/components/VisualizeButton.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "if (trimmed.startsWith('<svg')) {",
  "if (trimmed.includes('<svg')) {"
);

code = code.replace(
  "let finalUrl = response.image_url as any;",
  `let finalUrl = response.image_url as any;
        if (typeof finalUrl === 'string' && finalUrl.startsWith('{')) {
          try {
            const parsed = JSON.parse(finalUrl);
            finalUrl = parsed.url || parsed.image_url || parsed.src || finalUrl;
          } catch(e) {}
        }`
);

fs.writeFileSync(file, code);
