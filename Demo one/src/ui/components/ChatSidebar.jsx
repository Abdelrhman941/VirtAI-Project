import { useState } from 'react'
import { contextMenuOptions, mockConversations } from '../../data/mockData'
import ContextMenu from './ContextMenu'
import DocumentUploadModal from './DocumentUploadModal'

export default function ChatSidebar({ activeConversationId, onConversationSelect, onShowSources }) {
  const [conversations, setConversations] = useState(mockConversations)
  const [searchQuery, setSearchQuery] = useState('')
  const [contextMenu, setContextMenu] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [showUploadModal, setShowUploadModal] = useState(false)

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  function handleContextMenu(e, conv) {
    e.preventDefault()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      conversationId: conv.id
    })
  }

  function handleMenuAction(action) {
    const conv = conversations.find(c => c.id === contextMenu.conversationId)
    if (!conv) return

    switch(action) {
      case 'rename':
        setEditingId(conv.id)
        setEditTitle(conv.title)
        break
      case 'favorite':
        setConversations(conversations.map(c =>
          c.id === conv.id ? { ...c, isFavorite: !c.isFavorite } : c
        ))
        break
      case 'sources':
        if (onShowSources) onShowSources(true)
        break
      case 'delete':
        setConversations(conversations.filter(c => c.id !== conv.id))
        break
    }
  }

  function saveEdit(convId) {
    setConversations(conversations.map(c =>
      c.id === convId ? { ...c, title: editTitle } : c
    ))
    setEditingId(null)
    setEditTitle('')
  }

  function createNewConversation() {
    const newConv = {
      id: 'conv_' + Date.now(),
      title: 'New Conversation',
      date: new Date().toLocaleDateString(),
      messageCount: 0,
      isFavorite: false,
      messages: []
    }
    setConversations([newConv, ...conversations])
    onConversationSelect(newConv)
  }

  return (
    <div className="h-full flex flex-col" style={{ background: 'rgba(29, 29, 29, 0.95)' }}>
      {/* Search Bar */}
      <div className="p-4" style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.2)' }}>
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#D4AF37' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search conversations"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
            style={{
              background: '#2D2D2D',
              border: '1px solid #3D3D3D',
              color: '#FFFFFF'
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = '#D4AF37'}
            onBlur={(e) => e.currentTarget.style.borderColor = '#3D3D3D'}
          />
        </div>
      </div>

      {/* New Conversation Button */}
      <div className="p-4" style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.2)' }}>
        <button
          onClick={createNewConversation}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-300 hover:scale-[1.02]"
          style={{
            background: 'linear-gradient(135deg, #D4AF37, #FFD700)',
            color: '#000000',
            fontWeight: '600',
            boxShadow: '0 4px 15px rgba(212, 175, 55, 0.3)'
          }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Conversation
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.map((conv) => (
          <div
            key={conv.id}
            className="px-4 py-3 cursor-pointer transition-all duration-300"
            style={{
              borderLeft: activeConversationId === conv.id ? '4px solid #D4AF37' : '4px solid transparent',
              background: activeConversationId === conv.id ? 'rgba(212, 175, 55, 0.1)' : 'transparent'
            }}
            onClick={() => onConversationSelect(conv)}
            onContextMenu={(e) => handleContextMenu(e, conv)}
            onMouseEnter={(e) => {
              if (activeConversationId !== conv.id) {
                e.currentTarget.style.background = 'rgba(45, 45, 45, 0.5)'
              }
            }}
            onMouseLeave={(e) => {
              if (activeConversationId !== conv.id) {
                e.currentTarget.style.background = 'transparent'
              }
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {editingId === conv.id ? (
                  <input
                    autoFocus
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => saveEdit(conv.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(conv.id)
                      if (e.key === 'Escape') {
                        setEditingId(null)
                        setEditTitle('')
                      }
                    }}
                    className="w-full px-2 py-1 text-sm font-medium rounded focus:outline-none"
                    style={{
                      background: '#2D2D2D',
                      border: '1px solid #D4AF37',
                      color: '#FFFFFF'
                    }}
                  />
                ) : (
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-medium truncate" style={{ color: '#FFFFFF' }}>
                      {conv.title}
                    </h3>
                    {conv.isFavorite && <span className="text-xs">⭐</span>}
                  </div>
                )}
                <p className="text-xs mt-0.5 truncate" style={{ color: '#9CA3AF' }}>
                  {conv.messages.length > 0
                    ? conv.messages[conv.messages.length - 1].text.substring(0, 50) + '...'
                    : 'No messages yet'
                  }
                </p>
                <p className="text-xs mt-1" style={{ color: '#6B7280' }}>{conv.date}</p>
              </div>
              {conv.messageCount > 0 && (
                <span className="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 text-xs font-semibold rounded-full"
                  style={{
                    background: 'linear-gradient(135deg, #D4AF37, #FFD700)',
                    color: '#000000'
                  }}
                >
                  {conv.messageCount}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Upload & Analyze Footer */}
      <div className="p-4" style={{ borderTop: '1px solid rgba(212, 175, 55, 0.2)' }}>
        <button
          onClick={() => setShowUploadModal(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-300"
          style={{
            background: '#2D2D2D',
            border: '1px solid #3D3D3D',
            color: '#FFFFFF'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#D4AF37'
            e.currentTarget.style.color = '#D4AF37'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#3D3D3D'
            e.currentTarget.style.color = '#FFFFFF'
          }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Upload & Analyze
        </button>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          options={contextMenuOptions.conversation}
          onSelect={handleMenuAction}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Document Upload Modal */}
      <DocumentUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
      />
    </div>
  )
}
