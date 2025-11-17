import { useEffect, useRef, useState } from 'react'
import { contextMenuOptions } from '../../data/mockData'
import ContextMenu from './ContextMenu'

export default function ChatArea({ conversation }){
  const [messages, setMessages] = useState(conversation?.messages || [])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [contextMenu, setContextMenu] = useState(null)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (conversation) {
      setMessages(conversation.messages)
    }
  }, [conversation])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(e){
    if (e) e.preventDefault()
    if(!text.trim()) return

    const userMsg = {
      id: 'msg_' + Date.now(),
      sender: 'user',
      text: text.trim(),
      timestamp: new Date(),
      attachments: []
    }
    setMessages(m => [...m, userMsg])
    setText('')
    setLoading(true)

    // Simulate AI response
    setTimeout(() => {
      const aiMsg = {
        id: 'msg_' + (Date.now() + 1),
        sender: 'ai',
        text: 'This is a simulated AI response. In production, this would connect to your backend AI service.',
        timestamp: new Date(),
        attachments: []
      }
      setMessages(m => [...m, aiMsg])
      setLoading(false)
    }, 1500)
  }

  function handleMessageContextMenu(e, msg) {
    e.preventDefault()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      messageId: msg.id
    })
  }

  function handleMessageAction(action) {
    const msg = messages.find(m => m.id === contextMenu.messageId)
    if (!msg) return

    switch(action) {
      case 'copy':
        navigator.clipboard.writeText(msg.text)
        break
      case 'listen':
        console.log('Text-to-speech for:', msg.id)
        break
      case 'favorite':
        console.log('Favorite message:', msg.id)
        break
    }
  }

  if (!conversation) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: '#0F0F0F' }}>
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-4" style={{ color: '#3D3D3D' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <h3 className="text-lg font-medium mb-1" style={{ color: '#FFFFFF' }}>No Conversation Selected</h3>
          <p className="text-sm" style={{ color: '#6B7280' }}>Choose a conversation from the sidebar</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col" style={{ background: '#1A1A1A' }}>
      {/* Header */}
      <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.2)' }}>
        <h2 className="text-lg font-semibold" style={{ color: '#FFFFFF' }}>{conversation.title}</h2>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6" style={{ background: '#0F0F0F' }}>
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`mb-4 flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            onContextMenu={(e) => handleMessageContextMenu(e, msg)}
          >
            <div className="max-w-[70%]">
              <div className={`rounded-lg p-4 ${
                msg.sender === 'user'
                  ? ''
                  : ''
              }`}
                style={msg.sender === 'user' ? {
                  background: 'linear-gradient(135deg, #D4AF37, #FFD700)',
                  color: '#000000',
                  fontWeight: '500'
                } : {
                  background: 'rgba(45, 45, 45, 0.8)',
                  border: '1px solid rgba(61, 61, 61, 0.5)',
                  color: '#FFFFFF'
                }}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>

                {/* Document Attachments */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(212, 175, 55, 0.2)' }}>
                    <div className="flex items-center gap-2 text-xs" style={{ color: '#D4AF37' }}>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                      </svg>
                      <span>{msg.attachments[0].filename} (p.{msg.attachments[0].page})</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Message Actions */}
              <div className="flex items-center gap-3 mt-2 px-2">
                <span className="text-xs" style={{ color: '#6B7280' }}>
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <button className="transition-colors" style={{ color: '#6B7280' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#D4AF37'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#6B7280'}
                  title="Copy"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
                <button className="transition-colors" style={{ color: '#6B7280' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#D4AF37'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#6B7280'}
                  title="Listen"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.414A2 2 0 014 13.586V6a2 2 0 012-2h8a2 2 0 012 2v7.586a2 2 0 01-.586 1.414L11 19.414a2 2 0 01-2.828 0l-2.586-2.586z" />
                  </svg>
                </button>
                <button className="transition-colors" style={{ color: '#6B7280' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#D4AF37'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#6B7280'}
                  title="Favorite"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Typing Indicator */}
        {loading && (
          <div className="flex justify-start mb-4">
            <div className="rounded-lg p-4" style={{
              background: 'rgba(45, 45, 45, 0.8)',
              border: '1px solid rgba(61, 61, 61, 0.5)'
            }}>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#D4AF37', animationDelay: '0s' }}></div>
                <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#D4AF37', animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#D4AF37', animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="p-4" style={{ borderTop: '1px solid rgba(212, 175, 55, 0.2)', background: '#1A1A1A' }}>
        <form onSubmit={send} className="flex items-end gap-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder="Ask your tutor anything..."
            rows={1}
            className="flex-1 px-4 py-3 rounded-lg resize-none focus:outline-none focus:ring-2 text-sm"
            style={{
              maxHeight: '120px',
              minHeight: '44px',
              background: '#2D2D2D',
              border: '1px solid #3D3D3D',
              color: '#FFFFFF'
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = '#D4AF37'}
            onBlur={(e) => e.currentTarget.style.borderColor = '#3D3D3D'}
          />

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="p-2 transition-colors"
              style={{ color: '#6B7280' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#D4AF37'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#6B7280'}
              title="Attach file"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
            <button
              type="button"
              className="p-2 transition-colors"
              style={{ color: '#6B7280' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#D4AF37'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#6B7280'}
              title="Voice input"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
            <button
              type="submit"
              disabled={!text.trim()}
              className="p-2.5 rounded-lg transition-all duration-300 hover:scale-105"
              style={{
                background: text.trim() ? 'linear-gradient(135deg, #D4AF37, #FFD700)' : '#3D3D3D',
                color: text.trim() ? '#000000' : '#6B7280',
                cursor: text.trim() ? 'pointer' : 'not-allowed',
                boxShadow: text.trim() ? '0 4px 15px rgba(212, 175, 55, 0.3)' : 'none'
              }}
              title="Send"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </form>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          options={contextMenuOptions.message}
          onSelect={handleMessageAction}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
