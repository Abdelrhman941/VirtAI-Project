const fs = require('fs');
const file = '/mnt/d/A/Projects/VirtAI-Project/frontend/src/widgets/Classroom/hooks/useClassroomChat.ts';
let code = fs.readFileSync(file, 'utf8');

// Replace the current refs block
code = code.replace(`  const deltaBufferRef = useRef<string>('');
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const streamStartTimeRef = useRef<number>(0);`, 
`  const deltaBufferRef = useRef<string>('');
  const fullAccumulatorRef = useRef<string>('');
  const isStreamingVisibleRef = useRef<boolean>(false);
  const lastFlushTimeRef = useRef<number>(0);
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);`);

// Replace flushBuffer definition
code = code.replace(`    const flushBuffer = () => {
      const flush = deltaBufferRef.current;
      deltaBufferRef.current = '';
      flushTimeoutRef.current = null;
      if (flush) {
        dispatch({ type: 'CHAT_DELTA', payload: { delta: flush } });
      }
      
      // Schedule next flush if we are still streaming (this shouldn't be called directly unless streaming continues, but we handle it via the delta event)
    };`, 
`    const flushBuffer = () => {
      const flush = deltaBufferRef.current;
      deltaBufferRef.current = '';
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
        flushTimeoutRef.current = null;
      }
      if (flush) {
        dispatch({ type: 'CHAT_DELTA', payload: { delta: flush } });
        lastFlushTimeRef.current = Date.now();
      }
    };`);


// Replace chat.delta handler
code = code.replace(`      onMessage('chat.delta', (rawData: unknown) => {
        const d = validatePayload(rawData);
        if (!d || !checkSession(d)) return;
        const delta = d.delta ? d.delta.replace(/\\[.*?\\]/g, '') : '';
        if (!delta) return;
        
        deltaBufferRef.current += delta;
        
        if (streamStartTimeRef.current === 0) {
          streamStartTimeRef.current = Date.now();
          // Delay first render by 300ms to allow short messages to complete atomically
          if (!flushTimeoutRef.current) {
            flushTimeoutRef.current = setTimeout(flushBuffer, 300);
          }
        } else {
          // Subsequent chunks batched at ~80ms (approx 12fps) to prevent React reflow jitter
          if (!flushTimeoutRef.current) {
            flushTimeoutRef.current = setTimeout(flushBuffer, 80);
          }
        }
      }),`, 
`      onMessage('chat.delta', (rawData: unknown) => {
        const d = validatePayload(rawData);
        if (!d || !checkSession(d)) return;
        const delta = d.delta ? d.delta.replace(/\\[.*?\\]/g, '') : '';
        if (!delta) return;
        
        deltaBufferRef.current += delta;
        fullAccumulatorRef.current += delta;
        
        if (!isStreamingVisibleRef.current) {
          const fullText = fullAccumulatorRef.current;
          const isComplex = /[\\n#*>\\[\\]\`|]/.test(fullText);
          const wordCount = fullText.split(/\\s+/).length;
          
          if (fullText.length > 80 || wordCount > 15 || isComplex) {
            isStreamingVisibleRef.current = true;
            lastFlushTimeRef.current = Date.now();
            flushBuffer();
          }
          return;
        }

        const batchText = deltaBufferRef.current;
        const timeSinceLastFlush = Date.now() - lastFlushTimeRef.current;
        
        const hasSentenceBoundary = /[.!?]\\s$/.test(batchText);
        const hasNewline = /\\n/.test(batchText);
        const hasMarkdownBoundary = /[\`*_-]/.test(batchText);

        const FLUSH_INTERVAL_MS = 150;

        if (hasSentenceBoundary || hasNewline || hasMarkdownBoundary || timeSinceLastFlush > FLUSH_INTERVAL_MS) {
          flushBuffer();
        } else {
          if (!flushTimeoutRef.current) {
            const delay = Math.max(0, FLUSH_INTERVAL_MS - timeSinceLastFlush);
            flushTimeoutRef.current = setTimeout(flushBuffer, delay);
          }
        }
      }),`);


// Replace chat.final handler
code = code.replace(`      onMessage('chat.final', (rawData: unknown) => {
        const d = validatePayload(rawData);
        if (!d || !checkSession(d)) return;
        
        // Clear any pending flushes
        if (flushTimeoutRef.current) {
          clearTimeout(flushTimeoutRef.current);
          flushTimeoutRef.current = null;
        }
        // We do NOT need to dispatch the remaining delta buffer to interim state,
        // because CHAT_FINAL immediately clears the interim state anyway.
        // We just reset our buffer state.
        deltaBufferRef.current = '';
        streamStartTimeRef.current = 0;`, 
`      onMessage('chat.final', (rawData: unknown) => {
        const d = validatePayload(rawData);
        if (!d || !checkSession(d)) return;
        
        if (flushTimeoutRef.current) {
          clearTimeout(flushTimeoutRef.current);
          flushTimeoutRef.current = null;
        }
        deltaBufferRef.current = '';
        fullAccumulatorRef.current = '';
        isStreamingVisibleRef.current = false;`);


// Replace pipeline.state handler
code = code.replace(`      onMessage('pipeline.state', (rawData: unknown) => {
        const d = validatePayload(rawData);
        if (!d || !checkSession(d)) return;
        if (d.state === 'idle' || d.state === 'error') {
          streamStartTimeRef.current = 0;
          if (flushTimeoutRef.current) {
            clearTimeout(flushTimeoutRef.current);
            flushTimeoutRef.current = null;
          }
          deltaBufferRef.current = '';
        }`, 
`      onMessage('pipeline.state', (rawData: unknown) => {
        const d = validatePayload(rawData);
        if (!d || !checkSession(d)) return;
        if (d.state === 'idle' || d.state === 'error' || d.state === 'thinking') {
          if (flushTimeoutRef.current) {
            clearTimeout(flushTimeoutRef.current);
            flushTimeoutRef.current = null;
          }
          deltaBufferRef.current = '';
          fullAccumulatorRef.current = '';
          isStreamingVisibleRef.current = false;
        }`);

fs.writeFileSync(file, code);
console.log('patched WS hooks with content-based semantic streaming');
