import { toast } from '@/shared/utils/toast';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FiDownload,
  FiImage,
  FiLoader,
  FiMaximize2,
  FiRefreshCcw,
  FiX,
  FiZoomIn,
} from 'react-icons/fi';
import { getVisualization } from '../api/visualizationApi';
import { getVisualizationTranslations, Locale } from '../i18n/visualizationI18n';
import './VisualizeButton.css';

interface VisualizeButtonProps {
  messageId: string;
  locale?: Locale;
  onExpand?: () => void;
}

export function VisualizeButton({ messageId, locale = 'en', onExpand }: VisualizeButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [isHidden, setIsHidden] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const lastRequestTime = useRef<number>(0);
  const blobUrlRef = useRef<string | null>(null);

  const t = getVisualizationTranslations(locale);

  // Cleanup blob URL on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  // Handle ESC key for Lightbox
  useEffect(() => {
    if (!isLightboxOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsLightboxOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isLightboxOpen]);

  const handleVisualize = useCallback(async (force = false) => {
    const now = Date.now();
    if (now - lastRequestTime.current < 5000 && !force) {
      toast.warning(
        'Please Wait',
        'Please wait a few seconds before requesting another visualization.'
      );
      return;
    }

    lastRequestTime.current = now;
    setIsLoading(true);
    setImageError(null);

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setImageUrl(null);
    setSvgContent(null);

    try {
      const cleanId = messageId.replace('-assistant', '').replace('-user', '');
      const response = await getVisualization(cleanId, force);

      if (response.unavailable) {
        if (response.reason === 'not_configured') {
          setIsHidden(true);
        } else if (response.reason && response.reason in t) {
          setImageError(t[response.reason as keyof typeof t]);
        } else {
          setImageError(t.unknown_error);
        }
      } else if (response.image_url) {
        let finalUrl = response.image_url as any;
        if (typeof finalUrl === 'string' && finalUrl.startsWith('{')) {
          try {
            const parsed = JSON.parse(finalUrl);
            finalUrl = parsed.url || parsed.image_url || parsed.src || finalUrl;
          } catch (e) {}
        }
        if (typeof finalUrl === 'object' && finalUrl !== null) {
          finalUrl = finalUrl.url || finalUrl.image_url || finalUrl.src || '';
        }

        if (typeof finalUrl === 'string') {
          const trimmed = finalUrl.trim();
          if (trimmed.includes('<svg')) {
            setSvgContent(trimmed);
          } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
            // Fetch with auth token
            const { default: apiClient } = await import('@/core/api/apiClient');
            const res = await apiClient.get(trimmed, { responseType: 'blob' });
            
            // Check if the blob is actually an SVG by reading its text
            const text = await res.data.text();
            if (text.includes('<svg')) {
              setSvgContent(text);
            } else {
              const blobUrl = URL.createObjectURL(res.data);
              blobUrlRef.current = blobUrl;
              setImageUrl(blobUrl);
            }
          } else {
            try {
              // Extract raw base64 — strip data URI prefix if present
              const base64Data = trimmed.startsWith('data:image/png;base64,')
                ? trimmed.split(',')[1]
                : trimmed;

              // Strip ALL whitespace/newlines before atob()
              const cleanBase64 = base64Data.replace(/[\s\r\n]+/g, '');

              const byteChars = atob(cleanBase64);
              const byteArray = new Uint8Array(byteChars.length);
              for (let i = 0; i < byteChars.length; i++) {
                byteArray[i] = byteChars.charCodeAt(i);
              }
              const blob = new Blob([byteArray], { type: 'image/png' });
              const blobUrl = URL.createObjectURL(blob);

              blobUrlRef.current = blobUrl;
              setImageUrl(blobUrl);
            } catch (err) {
              console.error('[VIZ] Failed to parse base64:', err);
              // Fallback: try using as data URI directly
              const dataUri = trimmed.startsWith('data:')
                ? trimmed
                : `data:image/png;base64,${trimmed}`;
              setImageUrl(dataUri);
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      setImageError(t.unknown_error);
    } finally {
      setIsLoading(false);
    }
  }, [messageId, t]);

  const handleDownload = useCallback(() => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `visualization-${messageId.slice(0, 8)}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [imageUrl, messageId]);

  const handleClose = () => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setImageUrl(null);
    setSvgContent(null);
    setImageError(null);
  };

  if (isHidden) return null;

  return (
    <div className="visualize-container mt-4 animate-in fade-in duration-300 mx-auto max-w-2xl w-full">
      {/* Idle / Error — show button */}
      {!imageUrl && !svgContent && !isLoading && (
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-colors duration-200 bg-white/5 text-[#D4B47A] border border-[#D4B47A]/30 hover:border-[#D4B47A] hover:bg-[#D4B47A]/10 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleVisualize}
          title={t.visualize}
          aria-label={t.visualize}
        >
          <FiImage size={14} />
          <span>{imageError ? 'Retry Visualization' : t.visualize}</span>
        </button>
      )}

      {/* Error message */}
      {imageError && !isLoading && (
        <div className="text-red-400 text-xs mt-2 px-2">
          <span>{imageError}</span>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="w-full flex flex-col gap-2">
          <button
            type="button"
            className="flex w-fit items-center gap-1.5 px-3 py-1.5 text-xs rounded-full bg-white/5 text-[#D4B47A] border border-[#D4B47A]/30 opacity-70 cursor-not-allowed"
            disabled
          >
            <FiLoader className="animate-spin" size={14} />
            <span>{t.generating}</span>
          </button>
          <div className="w-full h-52 bg-white/5 animate-pulse rounded-lg border border-white/10 mt-2" />
        </div>
      )}

      {/* Result card */}
      {(imageUrl || svgContent) && !isLoading && (
        <div className="visualize-card bg-white/5 rounded-lg border border-white/10 overflow-hidden mt-2 min-h-[200px] flex flex-col">
          {/* Header */}
          <div className="visualize-header flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2 text-[#D4B47A] text-xs font-medium">
              <FiImage size={14} />
              <span>Visualization</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleDownload}
                className="text-white/40 hover:text-[#D4B47A] transition-colors p-1.5 rounded-md hover:bg-white/5"
                title="Download"
              >
                <FiDownload size={14} />
              </button>
              <button
                onClick={() => handleVisualize(true)}
                className="text-white/40 hover:text-[#D4B47A] transition-colors p-1.5 rounded-md hover:bg-white/5"
                title="Regenerate"
              >
                <FiRefreshCcw size={14} />
              </button>
              <button
                onClick={() => setIsLightboxOpen(true)}
                className="text-white/40 hover:text-[#D4B47A] transition-colors p-1.5 rounded-md hover:bg-white/5"
                title="Fullscreen"
              >
                <FiMaximize2 size={14} />
              </button>
              <button
                onClick={handleClose}
                className="text-white/40 hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/5"
                title="Close"
              >
                <FiX size={14} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="visualize-content p-4 overflow-x-auto flex-1 flex items-center justify-center">
            {svgContent ? (
              <div
                className="relative group cursor-zoom-in w-full flex justify-center [&>svg]:w-full [&>svg]:max-w-full [&>svg]:h-auto bg-white rounded-md p-4"
                dangerouslySetInnerHTML={{ __html: svgContent }}
                onClick={() => setIsLightboxOpen(true)}
              />
            ) : imageUrl ? (
              <div
                className="relative group cursor-zoom-in w-full flex justify-center"
                onClick={() => setIsLightboxOpen(true)}
              >
                <img
                  src={imageUrl}
                  alt="Message Visualization"
                  className="rounded-md object-contain max-h-[400px] max-w-full bg-white"
                  onLoad={onExpand}
                  onError={() => setImageError('Failed to render image.')}
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-md pointer-events-none">
                  <FiZoomIn size={24} className="text-white drop-shadow-md" />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {isLightboxOpen && (imageUrl || svgContent) && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4 sm:p-8 cursor-zoom-out"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div className="absolute top-4 right-4 flex items-center gap-3 z-[10000]">
            <button
              className="p-2.5 text-white bg-black rounded-full hover:bg-neutral-800 transition-colors border border-white/20 shadow-md"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload();
              }}
              title="Download"
            >
              <FiDownload size={20} />
            </button>
            <button
              className="p-2.5 text-white bg-black rounded-full hover:bg-neutral-800 transition-colors border border-white/20 shadow-md"
              onClick={(e) => {
                e.stopPropagation();
                setIsLightboxOpen(false);
              }}
              title="Close"
            >
              <FiX size={20} />
            </button>
          </div>
          {svgContent ? (
            <div
              className="max-w-[90vw] max-h-[90vh] w-full h-full flex items-center justify-center [&>svg]:max-w-full [&>svg]:max-h-full cursor-default rounded-md shadow-2xl bg-white p-8"
              dangerouslySetInnerHTML={{ __html: svgContent }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : imageUrl ? (
            <img
              src={imageUrl}
              alt="Fullscreen Visualization"
              className="max-w-[90vw] max-h-[90vh] object-contain cursor-default rounded-md shadow-2xl bg-white"
              onClick={(e) => e.stopPropagation()}
            />
          ) : null}
        </div>,
        document.body
      )}
    </div>
  );
}
