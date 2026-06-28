const fs = require('fs');
const file = '/mnt/d/A/Projects/VirtAI-Project/frontend/src/widgets/Classroom/hooks/useClassroomChat.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace('const isCreatingSessionRef = useRef<boolean>(false);',
`const isCreatingSessionRef = useRef<boolean>(false);
  const deltaBufferRef = useRef<string>('');
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const streamStartTimeRef = useRef<number>(0);`);

code = code.replace(`    const unsubs = [
      onMessage('user.message.echo', (rawData: unknown) => {`,
`    const flushBuffer = () => {
      const flush = deltaBufferRef.current;
      deltaBufferRef.current = '';
      flushTimeoutRef.current = null;
      if (flush) {
        dispatch({ type: 'CHAT_DELTA', payload: { delta: flush } });
      }
      
      // Schedule next flush if we are still streaming (this shouldn't be called directly unless streaming continues, but we handle it via the delta event)
    };

    const unsubs = [
      onMessage('user.message.echo', (rawData: unknown) => {`);

code = code.replace(`      onMessage('chat.delta', (rawData: unknown) => {
        const d = validatePayload(rawData);
        if (!d || !checkSession(d)) return;
        const safePayload = { ...d, delta: d.delta ? d.delta.replace(/\\[.*?\\]/g, '') : undefined };
        dispatch({ type: 'CHAT_DELTA', payload: safePayload });
      }),`,
`      onMessage('chat.delta', (rawData: unknown) => {
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
      }),`);

code = code.replace(`      onMessage('chat.final', (rawData: unknown) => {
        const d = validatePayload(rawData);
        if (!d || !checkSession(d)) return;
        const safePayload = { ...d, text: d.text ? d.text.replace(/\\[.*?\\]/g, '') : undefined };
        dispatch({ type: 'CHAT_FINAL', payload: safePayload });`,
`      onMessage('chat.final', (rawData: unknown) => {
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
        streamStartTimeRef.current = 0;
        
        const safePayload = { ...d, text: d.text ? d.text.replace(/\\[.*?\\]/g, '') : undefined };
        dispatch({ type: 'CHAT_FINAL', payload: safePayload });`);

code = code.replace(`      onMessage('pipeline.state', (rawData: unknown) => {
        const d = validatePayload(rawData);
        if (!d || !checkSession(d)) return;`,
`      onMessage('pipeline.state', (rawData: unknown) => {
        const d = validatePayload(rawData);
        if (!d || !checkSession(d)) return;
        if (d.state === 'idle' || d.state === 'error') {
          streamStartTimeRef.current = 0;
          if (flushTimeoutRef.current) {
            clearTimeout(flushTimeoutRef.current);
            flushTimeoutRef.current = null;
          }
          deltaBufferRef.current = '';
        }`);

fs.writeFileSync(file, code);
console.log('patched useClassroomChat.ts');
