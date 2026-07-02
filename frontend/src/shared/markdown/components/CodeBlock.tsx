import { cn } from '@/shared/utils/cn';
import { toast } from '@/shared/utils/toast';
import { Check, Copy } from 'lucide-react';
import { lazy, Suspense, useCallback, useState } from 'react';

const ShikiHighlighter = lazy(() => import('./ShikiHighlighter'));

interface Props { code: string; lang?: string; }

export function CodeBlock({ code, lang }: Props) {
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(() => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Copied', 'Code copied to clipboard');
    setTimeout(() => setCopied(false), 1400);
  }, [code]);

  return (
    <div className="relative group my-4 rounded-lg overflow-hidden border border-white/10 bg-[#0d1117]" dir="ltr">
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.03] border-b border-white/10">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {lang || 'text'}
        </span>
        <button
          type="button"
          onClick={onCopy}
          aria-label="Copy code"
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px]',
            'text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors',
          )}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <Suspense fallback={<pre className="overflow-x-auto p-4 text-sm m-0 bg-transparent"><code>{code}</code></pre>}>
        <ShikiHighlighter code={code} lang={lang} />
      </Suspense>
    </div>
  );
}
