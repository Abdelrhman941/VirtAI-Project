import React, { useState, useCallback, useRef } from 'react';
import { FiImage, FiLoader } from 'react-icons/fi';
import { getVisualization } from '../api/visualizationApi';
import { getVisualizationTranslations, Locale } from '../i18n/visualizationI18n';
import { toast } from '@/shared/utils/toast';
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
  const [imageError, setImageError] = useState(false);
  const lastRequestTime = useRef<number>(0);

  const t = getVisualizationTranslations(locale);

  const handleVisualize = useCallback(async () => {
    // Client-side debounce of at least 5 seconds
    const now = Date.now();
    if (now - lastRequestTime.current < 5000) {
      toast.warning('Please Wait', 'Please wait a few seconds before requesting another visualization.');
      return;
    }
    
    lastRequestTime.current = now;
    setIsLoading(true);

    try {
      // Strip UI suffixes to provide a pure UUID to the backend
      const cleanId = messageId.replace('-assistant', '').replace('-user', '');
      const response = await getVisualization(cleanId);
      
      if (response.unavailable) {
        if (response.reason === 'not_configured') {
          setIsHidden(true);
        } else if (response.reason && response.reason in t) {
          toast.error('Visualization Failed', t[response.reason as keyof typeof t]);
        } else {
          toast.error('Visualization Failed', t.unknown_error);
        }
      } else if (response.image_url) {
        let finalUrl = response.image_url as any;
        if (typeof finalUrl === 'string' && finalUrl.startsWith('{')) {
          try {
            const parsed = JSON.parse(finalUrl);
            finalUrl = parsed.url || parsed.image_url || parsed.src || finalUrl;
          } catch(e) {}
        }
        if (typeof finalUrl === 'object' && finalUrl !== null) {
          finalUrl = finalUrl.url || finalUrl.image_url || finalUrl.src || '';
        }
        
        if (typeof finalUrl === 'string') {
          const trimmed = finalUrl.trim();
          if (trimmed.includes('<svg')) {
            setSvgContent(trimmed);
          } else {
            setImageUrl(trimmed);
          }
          setImageError(false);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Error', t.unknown_error);
    } finally {
      setIsLoading(false);
    }
  }, [messageId, t]);

  if (isHidden) return null;

  if (svgContent) {
    return (
      <div 
        className="visualize-result w-full mt-4" 
        dangerouslySetInnerHTML={{ __html: svgContent }} 
      />
    );
  }

  if (imageUrl) {
    if (imageError) {
      return (
        <span className="flex items-center text-red-500 text-xs px-2 h-full">Failed to load image</span>
      );
    }

    return (
      <div className="visualize-result mt-4 w-full">
        <img 
          src={imageUrl} 
          alt="Message Visualization" 
          className="visualize-image rounded-md border border-white/10 max-w-full"
          onLoad={onExpand}
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-all duration-200 bg-white/5 text-white/50 border border-white/10 hover:border-[#D4B47A] hover:text-[#D4B47A] disabled:opacity-50 disabled:cursor-not-allowed"
      onClick={isLoading ? undefined : handleVisualize}
      disabled={isLoading}
      title={t.visualize}
      aria-label={t.visualize}
    >
      {isLoading ? <FiLoader className="animate-spin" size={14} /> : <FiImage size={14} />}
      <span>{isLoading ? t.generating : t.visualize}</span>
    </button>
  );
}
