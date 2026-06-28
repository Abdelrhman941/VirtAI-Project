import { useEffect, useRef, useState } from 'react';

export function useMermaidRender(mermaidCode: string | undefined, id: string = 'mermaid-svg') {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const renderMermaid = async () => {
      if (!mermaidCode || !containerRef.current) {
        setSvgContent(null);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Dynamically import mermaid to avoid bloating the main bundle
        const mermaidModule = await import('mermaid');
        const mermaid = mermaidModule.default;

        mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'strict',
        });

        // Ensure escaped newlines are converted to actual newlines
        // Sometimes LLMs return literal '\n' instead of an actual newline character
        const cleanCode = mermaidCode.replace(/\\n/g, '\n').trim();

        // Use mermaid.render safely
        // mermaid.render returns an object with svg in newer versions: { svg: string }
        const { svg } = await mermaid.render(id, cleanCode);

        if (isMounted) {
          setSvgContent(svg);
          setIsLoading(false);

          // Inject the SVG directly into the container safely
          if (containerRef.current) {
            containerRef.current.innerHTML = svg;
          }
        }
      } catch (err: any) {
        console.error("Mermaid Render Error:", err);
        if (isMounted) {
          setError(err?.message || "Failed to render diagram. The syntax might be invalid.");
          setSvgContent(null);
          setIsLoading(false);
          if (containerRef.current) {
            containerRef.current.innerHTML = '';
          }
        }
      }
    };

    renderMermaid();

    return () => {
      isMounted = false;
    };
  }, [mermaidCode, id]);

  return { containerRef, svgContent, error, isLoading };
}
