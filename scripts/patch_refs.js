const fs = require('fs');
const path = '/mnt/d/A/Projects/VirtAI-Project/frontend/src/widgets/Classroom/ClassroomShell.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Replace the old refs
content = content.replace(
  /const messagesEndRef = useRef<HTMLDivElement>\(null\);\s*const chatScrollRef = useRef<HTMLDivElement>\(null\);\s*const shouldStickToBottom = useRef<boolean>\(true\);\s*const textareaRef = useRef<HTMLTextAreaElement>\(null\);/,
  `// Desktop Refs
  const desktopMessagesEndRef = useRef<HTMLDivElement>(null);
  const desktopChatScrollRef = useRef<HTMLDivElement>(null);
  const desktopTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Mobile Refs
  const mobileMessagesEndRef = useRef<HTMLDivElement>(null);
  const mobileChatScrollRef = useRef<HTMLDivElement>(null);
  const mobileTextareaRef = useRef<HTMLTextAreaElement>(null);

  const shouldStickToBottom = useRef<boolean>(true);

  // Helper to get currently active/visible refs
  const getActiveRefs = useCallback(() => {
    if (desktopChatScrollRef.current && desktopChatScrollRef.current.clientHeight > 0) {
      return {
        chatScrollRef: desktopChatScrollRef,
        messagesEndRef: desktopMessagesEndRef,
        textareaRef: desktopTextareaRef
      };
    }
    return {
      chatScrollRef: mobileChatScrollRef,
      messagesEndRef: mobileMessagesEndRef,
      textareaRef: mobileTextareaRef
    };
  }, []);`
);

// 2. Replace the session change useEffect
content = content.replace(
  /useEffect\(\(\) => \{\s*const prevId = prevSessionIdRef\.current;\s*const nextId = currentSessionId;\s*if \(prevId !== nextId\) \{\s*resetAvatarAudio\(\);\s*if \(chatScrollRef\.current\) \{\s*scrollPositionsRef\.current\.set\(prevId, chatScrollRef\.current\.scrollTop\);\s*\}\s*requestAnimationFrame\(\(\) => \{\s*const saved = scrollPositionsRef\.current\.get\(nextId\);\s*if \(chatScrollRef\.current && saved !== null && saved !== undefined\) \{\s*chatScrollRef\.current\.scrollTop = saved;\s*shouldStickToBottom\.current = false;\s*\} else \{\s*shouldStickToBottom\.current = true;\s*\}\s*\}\);\s*prevSessionIdRef\.current = nextId;\s*\}\s*\}, \[currentSessionId, resetAvatarAudio\]\);/,
  `useEffect(() => {
    const prevId = prevSessionIdRef.current;
    const nextId = currentSessionId;
    if (prevId !== nextId) {
      resetAvatarAudio();

      const { chatScrollRef } = getActiveRefs();
      if (chatScrollRef.current) {
        scrollPositionsRef.current.set(prevId, chatScrollRef.current.scrollTop);
      }
      requestAnimationFrame(() => {
        const saved = scrollPositionsRef.current.get(nextId);
        const { chatScrollRef: activeRef } = getActiveRefs();
        if (activeRef.current && saved !== null && saved !== undefined) {
          activeRef.current.scrollTop = saved;
          shouldStickToBottom.current = false;
        } else {
          shouldStickToBottom.current = true;
        }
      });
      prevSessionIdRef.current = nextId;
    }
  }, [currentSessionId, resetAvatarAudio, getActiveRefs]);`
);

// 3. Replace handleChatScroll
content = content.replace(
  /const handleChatScroll = useCallback\(\(\) => \{\s*const el = chatScrollRef\.current;\s*if \(\!el\) return;\s*\/\/ Add a small 1px buffer to account for subpixel rendering issues\s*const isAtBottom = el\.scrollHeight - el\.scrollTop - el\.clientHeight <= SCROLL_STICK_THRESHOLD_PX \+ 1;\s*shouldStickToBottom\.current = isAtBottom;\s*\}, \[\]\);/,
  `const handleChatScroll = useCallback(() => {
    const { chatScrollRef } = getActiveRefs();
    const el = chatScrollRef.current;
    if (!el) return;
    
    // Add a small 1px buffer to account for subpixel rendering issues
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_STICK_THRESHOLD_PX + 1;
    shouldStickToBottom.current = isAtBottom;
  }, [getActiveRefs]);`
);

// 4. Replace useLayoutEffect
content = content.replace(
  /useLayoutEffect\(\(\) => \{\s*const el = chatScrollRef\.current;\s*const endEl = messagesEndRef\.current;/,
  `useLayoutEffect(() => {
    const { chatScrollRef, messagesEndRef } = getActiveRefs();
    const el = chatScrollRef.current;
    const endEl = messagesEndRef.current;`
);

// 4b. Update dependencies for useLayoutEffect
content = content.replace(
  /\[\s*currentSession\?\.messages,\s*conversationState\.currentMessage,\s*interimTranscript,\s*conversationState\.pipelineState\s*\]/,
  `[
    currentSession?.messages, 
    conversationState.currentMessage, 
    interimTranscript, 
    conversationState.pipelineState,
    getActiveRefs
  ]`
);


// 5. Replace handleSendMessage
content = content.replace(
  /const handleSendMessage = useCallback\(\(\) => \{\s*const text = inputValue\.trim\(\);\s*if \(\!text\) return;\s*\/\/ Force scroll to bottom when user explicitly sends a message\s*shouldStickToBottom\.current = true;\s*commitAndSend\(text\);\s*setInputValue\(''\);\s*if \(textareaRef\.current\) \{\s*textareaRef\.current\.style\.height = 'auto';\s*\}\s*if \(\!isConnected && currentSessionId !== null\) \{\s*toast\.warning\('Offline', 'Message queued\. Will send when connected\.', 3000\);\s*\}\s*\}, \[inputValue, isConnected, currentSessionId, commitAndSend, setInputValue\]\);/,
  `const handleSendMessage = useCallback(() => {
    const text = inputValue.trim();
    if (!text) return;

    // Force scroll to bottom when user explicitly sends a message
    shouldStickToBottom.current = true;

    commitAndSend(text);
    setInputValue('');

    const { textareaRef } = getActiveRefs();
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    if (!isConnected && currentSessionId !== null) {
      toast.warning('Offline', 'Message queued. Will send when connected.', 3000);
    }
  }, [inputValue, isConnected, currentSessionId, commitAndSend, setInputValue, getActiveRefs]);`
);

// 6. Replace refs passed to the FIRST AssistantPanel (Desktop)
// It occurs after "chatError={conversationState.error}\n                avatarName={avatarName}\n"
content = content.replace(
  /chatError=\{conversationState\.error\}\s*avatarName=\{avatarName\}\s*chatScrollRef=\{chatScrollRef\}\s*messagesEndRef=\{messagesEndRef\}\s*onChatScroll=\{handleChatScroll\}\s*pipelineState=\{conversationState\.pipelineState as any\}\s*inputValue=\{inputValue\}\s*onInputChange=\{setInputValue\}\s*onSendMessage=\{handleSendMessage\}\s*onKeyDown=\{onKeyDown\}\s*textareaRef=\{textareaRef\}/,
  `chatError={conversationState.error}
                avatarName={avatarName}
                chatScrollRef={desktopChatScrollRef}
                messagesEndRef={desktopMessagesEndRef}
                onChatScroll={handleChatScroll}
                pipelineState={conversationState.pipelineState as any}
                inputValue={inputValue}
                onInputChange={setInputValue}
                onSendMessage={handleSendMessage}
                onKeyDown={onKeyDown}
                textareaRef={desktopTextareaRef}`
);

// 7. Replace refs passed to the SECOND AssistantPanel (Mobile)
// Since the first one is replaced, we can match the same pattern again.
content = content.replace(
  /chatError=\{conversationState\.error\}\s*avatarName=\{avatarName\}\s*chatScrollRef=\{chatScrollRef\}\s*messagesEndRef=\{messagesEndRef\}\s*onChatScroll=\{handleChatScroll\}\s*pipelineState=\{conversationState\.pipelineState as any\}\s*inputValue=\{inputValue\}\s*onInputChange=\{setInputValue\}\s*onSendMessage=\{handleSendMessage\}\s*onKeyDown=\{onKeyDown\}\s*textareaRef=\{textareaRef\}/,
  `chatError={conversationState.error}
                avatarName={avatarName}
                chatScrollRef={mobileChatScrollRef}
                messagesEndRef={mobileMessagesEndRef}
                onChatScroll={handleChatScroll}
                pipelineState={conversationState.pipelineState as any}
                inputValue={inputValue}
                onInputChange={setInputValue}
                onSendMessage={handleSendMessage}
                onKeyDown={onKeyDown}
                textareaRef={mobileTextareaRef}`
);

fs.writeFileSync(path, content);
console.log('ClassroomShell patched successfully.');
