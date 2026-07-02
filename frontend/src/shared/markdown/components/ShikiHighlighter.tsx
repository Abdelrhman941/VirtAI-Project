import { useEffect, useState } from 'react';

const LANGS = ['ts', 'tsx', 'js', 'jsx', 'python', 'bash', 'json', 'sql', 'markdown'] as const;

export default function ShikiHighlighter({ code, lang }: { code: string; lang?: string }) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const shiki = await import('shiki/bundle/web');
        const highlighter = await shiki.createHighlighter({
          themes: ['github-dark-dimmed'],
          langs: LANGS as unknown as string[],
        });
        if (cancelled) return;
        const safeLang = (LANGS as readonly string[]).includes(lang ?? '') ? lang! : 'text';
        const out = highlighter.codeToHtml(code, { lang: safeLang, theme: 'github-dark-dimmed' });
        setHtml(out);
      } catch (err) {
        console.error('Failed to load Shiki highlighter:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [code, lang]);

  return (
    <div
      className="shiki-container [&_pre]:!bg-transparent [&_pre]:!p-4 [&_pre]:!m-0 [&_pre]:overflow-x-auto text-sm"
      dangerouslySetInnerHTML={html ? { __html: html } : { __html: `<pre><code>${escapeHtml(code)}</code></pre>` }}
    />
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
