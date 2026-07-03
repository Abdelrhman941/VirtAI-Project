import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/**
 * Button that copies text to clipboard and shows a brief confirmation.
 * @param {{ content: string }} props
 */
export default function CopyButton({ content }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  return (
    <button
      type="button"
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-all duration-200 ${copied
        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
        : 'bg-white/5 text-white/50 border border-white/10 hover:border-[#D4B47A] hover:text-[#D4B47A]'
        }`}
      onClick={copied ? undefined : handleCopy}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
      aria-label="Copy message"
      disabled={copied}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      <span>{copied ? 'Copied!' : 'Copy'}</span>
    </button>
  );
}
