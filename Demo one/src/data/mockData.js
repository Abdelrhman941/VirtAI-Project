// Mock data for Classroom Chat UI

export const mockConversations = [
  {
    id: 'conv_1',
    title: 'Physics Study Session',
    date: '11/17/2025',
    messageCount: 5,
    isFavorite: false,
    messages: [
      {
        id: 'msg_1',
        sender: 'user',
        text: "Can you explain Newton's third law?",
        timestamp: new Date('2025-11-17T10:30:00'),
        attachments: []
      },
      {
        id: 'msg_2',
        sender: 'ai',
        text: "Newton's third law states that for every action, there is an equal and opposite reaction. This means when one object exerts a force on another, the second object exerts an equal force in the opposite direction on the first object.",
        timestamp: new Date('2025-11-17T10:30:15'),
        attachments: [
          { filename: 'Introduction_to_Physics.pdf', page: 3 }
        ]
      }
    ]
  },
  {
    id: 'conv_2',
    title: 'Calculus Homework Help',
    date: '11/16/2025',
    messageCount: 3,
    isFavorite: true,
    messages: [
      {
        id: 'msg_3',
        sender: 'user',
        text: "How do I solve this integral?",
        timestamp: new Date('2025-11-16T14:20:00'),
        attachments: []
      },
      {
        id: 'msg_4',
        sender: 'ai',
        text: "Let me walk you through the integration by parts method. We'll use the formula: ∫u dv = uv - ∫v du",
        timestamp: new Date('2025-11-16T14:20:30'),
        attachments: [
          { filename: 'Calculus_Chapter_5.pdf', page: 12 }
        ]
      }
    ]
  },
  {
    id: 'conv_3',
    title: 'Chemistry Equations',
    date: '11/15/2025',
    messageCount: 7,
    isFavorite: false,
    messages: []
  }
]

export const mockDocuments = [
  {
    id: 'doc_1',
    filename: 'Introduction_to_Physics.pdf',
    pages: 250,
    indexed: true,
    uploadDate: '2025-11-10'
  },
  {
    id: 'doc_2',
    filename: 'Calculus_Chapter_5.pdf',
    pages: 48,
    indexed: true,
    uploadDate: '2025-11-12'
  },
  {
    id: 'doc_3',
    filename: 'Chemistry_Fundamentals.pdf',
    pages: 320,
    indexed: true,
    uploadDate: '2025-11-14'
  }
]

export const contextMenuOptions = {
  conversation: [
    { id: 'rename', label: 'Rename', icon: '✏️' },
    { id: 'favorite', label: 'Favorite', icon: '⭐' },
    { id: 'sources', label: 'Show Sources', icon: '📄' },
    { id: 'delete', label: 'Delete', icon: '🗑️', danger: true }
  ],
  message: [
    { id: 'copy', label: 'Copy', icon: '📋' },
    { id: 'listen', label: 'Listen', icon: '🔊' },
    { id: 'favorite', label: 'Favorite', icon: '⭐' }
  ]
}
