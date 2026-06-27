import React, { useCallback } from 'react';
import { useMermaidRender } from '../hooks/useMermaidRender';
import { DiagramData } from '../api/diagramApi';
import { FiDownload, FiX, FiZoomIn, FiZoomOut, FiMaximize } from 'react-icons/fi';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { LoadingState, ErrorState } from '@/shared/components/UIStates';

interface DiagramViewerProps {
  diagramData: DiagramData | null;
  isLoading: boolean;
  onClose: () => void;
}

export function DiagramViewer({ diagramData, isLoading, onClose }: DiagramViewerProps) {
  const { containerRef, svgContent, error, isLoading: isRenderLoading } = useMermaidRender(diagramData?.mermaid_code);

  const handleDownloadPNG = useCallback(() => {
    if (!containerRef.current) return;
    const originalSvg = containerRef.current.querySelector('svg');
    if (!originalSvg) return;
    
    // Clone to avoid mutating the live DOM
    const svgEl = originalSvg.cloneNode(true) as SVGSVGElement;
    
    // Force absolute dimensions so the canvas knows how big to draw
    const viewBox = originalSvg.viewBox?.baseVal;
    const width = viewBox?.width || originalSvg.getBoundingClientRect().width || 800;
    const height = viewBox?.height || originalSvg.getBoundingClientRect().height || 600;
    
    svgEl.setAttribute('width', `${width}px`);
    svgEl.setAttribute('height', `${height}px`);
    
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgEl);
    
    // Ensure XML namespace
    if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    // Safely encode the SVG to bypass Blob/XML parsing limitations in img src
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      if (ctx) {
        // Draw white background for transparent SVGs
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        const pngUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = `tree-map-${diagramData?.id || 'export'}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    };
    
    img.src = url;
  }, [diagramData?.id]);

  return (
    <div className="w-full h-full relative flex flex-col bg-dark overflow-hidden">
      {/* Floating Overlay Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-3 z-50">
        <button
          onClick={handleDownloadPNG}
          disabled={!svgContent}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-dark/60 backdrop-blur-md border border-gold/15 text-sm font-medium text-gold-soft hover:bg-gold/5 hover:border-gold/30 hover:scale-[1.02] transition-[background-color,border-color,transform] duration-300 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FiDownload size={16} />
          <span>Download Tree Map</span>
        </button>
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-dark/60 backdrop-blur-md border border-gold/15 text-sm font-medium text-gold-soft hover:bg-gold/5 hover:border-gold/30 hover:scale-[1.02] transition-[background-color,border-color,transform] duration-300 shadow-xl"
        >
          <FiX size={16} />
          <span>Close Tree Map</span>
        </button>
      </div>

      <div className="flex-1 w-full h-full cursor-grab active:cursor-grabbing overflow-hidden relative">
        {(isLoading || (isRenderLoading && !error)) && (
          <LoadingState message="Synthesizing conceptual relationship diagram..." />
        )}
        
        {error && (
          <ErrorState 
            title="Diagram Rendering Failed"
            message="We were unable to render the concept diagram due to a syntax parsing conflict. Please review the chat explanation or attempt to regenerate the layout."
            details={error}
          />
        )}

        {!error && !isLoading && (
          <TransformWrapper
            initialScale={1}
            minScale={0.1}
            maxScale={8}
            centerOnInit={true}
            centerZoomedOut={true}
            limitToBounds={true}
            wheel={{ step: 0.1 }}
            panning={{ velocityDisabled: false }}
            doubleClick={{ step: 0.5 }}
          >
            {({ zoomIn, zoomOut, resetTransform }) => (
              <React.Fragment>
                {/* Floating Zoom Controls */}
                <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-50 bg-dark/60 backdrop-blur-md border border-gold/15 rounded-xl p-2 shadow-xl">
                  <button 
                    onClick={() => zoomIn()} 
                    className="p-3 text-gold-soft hover:bg-gold/10 rounded-lg transition-colors" 
                    title="Zoom In"
                    aria-label="Zoom in"
                  >
                    <FiZoomIn size={20} />
                  </button>
                  <div className="w-full h-px bg-gold/10" />
                  <button 
                    onClick={() => resetTransform()} 
                    className="p-3 text-gold-soft hover:bg-gold/10 rounded-lg transition-colors" 
                    title="Reset Zoom"
                    aria-label="Reset zoom"
                  >
                    <FiMaximize size={20} />
                  </button>
                  <div className="w-full h-px bg-gold/10" />
                  <button 
                    onClick={() => zoomOut()} 
                    className="p-3 text-gold-soft hover:bg-gold/10 rounded-lg transition-colors" 
                    title="Zoom Out"
                    aria-label="Zoom out"
                  >
                    <FiZoomOut size={20} />
                  </button>
                </div>
                
                <TransformComponent 
                  wrapperStyle={{ width: "100%", height: "100%" }} 
                  contentStyle={{ minWidth: "100%", minHeight: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}
                >
                  <div 
                    ref={containerRef} 
                    className="diagram-content-wrapper px-4 md:px-8 [&>svg]:!max-w-none"
                  />
                </TransformComponent>
              </React.Fragment>
            )}
          </TransformWrapper>
        )}
      </div>

    </div>
  );
}
