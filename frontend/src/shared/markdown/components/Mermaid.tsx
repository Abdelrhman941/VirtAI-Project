import { useEffect, useRef, useState } from 'react';

export function Mermaid({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    const id = `mermaid-${Math.random().toString(36).substring(2, 11)}`;

    (async () => {
      try {
        const mermaidModule = await import('mermaid');
        const mermaid = mermaidModule.default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          securityLevel: 'loose',
        });
        const cleanCode = code.replace(/\\n/g, '\n').trim();
        const { svg: renderedSvg } = await mermaid.render(id, cleanCode);
        if (!cancelled) {
          setSvg(renderedSvg);
        }
      } catch (err) {
        console.error('Mermaid render error in markdown:', err);
        if (!cancelled) {
          setError(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <pre className="overflow-x-auto p-4 text-sm m-0 bg-red-950/20 text-red-400 border border-red-500/20 rounded-lg">
        <code>{code}</code>
      </pre>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-container flex justify-center bg-white/5 p-4 rounded-lg my-4 border border-white/10 [&>svg]:max-w-full [&>svg]:h-auto"
      dangerouslySetInnerHTML={{ __html: svg || '<span class="text-xs text-muted-foreground animate-pulse">Rendering diagram...</span>' }}
    />
  );
}
