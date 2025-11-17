import { useState } from 'react'
import { mockConversations } from '../data/mockData'
import ChatArea from './components/ChatArea'
import ChatSidebar from './components/ChatSidebar'
import SourcesPanel from './components/SourcesPanel'

export default function ChatLayout() {
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [showSources, setShowSources] = useState(false)

  const activeConversation = mockConversations.find(c => c.id === activeConversationId)

  return (
    <div className="flex h-screen" style={{ background: '#0A0A0A' }}>
      {/* Sidebar */}
      <div className="w-80 flex-shrink-0" style={{
        background: 'rgba(29, 29, 29, 0.95)',
        borderRight: '1px solid rgba(212, 175, 55, 0.3)'
      }}>
        <ChatSidebar
          activeConversationId={activeConversationId}
          onConversationSelect={setActiveConversationId}
          onShowSources={() => setShowSources(true)}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        <ChatArea conversation={activeConversation} />
      </div>

      {/* Sources Panel */}
      <SourcesPanel
        isOpen={showSources}
        onClose={() => setShowSources(false)}
      />
    </div>
  )
}
