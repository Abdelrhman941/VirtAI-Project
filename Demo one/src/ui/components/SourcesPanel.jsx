import { mockDocuments } from '../../data/mockData'

export default function SourcesPanel({ isOpen, onClose }) {
  return (
    <div className={`fixed top-0 right-0 h-full w-80 shadow-lg transform transition-transform duration-300 ${
      isOpen ? 'translate-x-0' : 'translate-x-full'
    } z-50`}
      style={{
        background: 'rgba(29, 29, 29, 0.95)',
        borderLeft: '1px solid rgba(212, 175, 55, 0.3)'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.2)' }}>
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5" style={{ color: '#D4AF37' }} fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
            <path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
          </svg>
          <h3 className="font-semibold" style={{ color: '#FFFFFF' }}>Indexed Documents</h3>
        </div>
        <button
          onClick={onClose}
          className="transition-colors"
          style={{ color: '#6B7280' }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#D4AF37'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#6B7280'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Documents List */}
      <div className="p-6 overflow-y-auto h-[calc(100%-73px)]">
        {mockDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg className="w-16 h-16 mb-4" style={{ color: '#3D3D3D' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm" style={{ color: '#9CA3AF' }}>No indexed documents yet</p>
            <p className="text-xs mt-2" style={{ color: '#6B7280' }}>Upload documents to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {mockDocuments.map((doc) => (
              <div
                key={doc.id}
                className="p-4 rounded-lg transition-all duration-300"
                style={{
                  background: 'rgba(45, 45, 45, 0.5)',
                  border: '1px solid rgba(61, 61, 61, 0.5)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#D4AF37'
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(212, 175, 55, 0.2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(61, 61, 61, 0.5)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 flex-1">
                    <svg className="w-4 h-4 flex-shrink-0" style={{ color: '#D4AF37' }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium truncate" style={{ color: '#FFFFFF' }}>{doc.filename}</span>
                  </div>
                  {doc.indexed && (
                    <svg className="w-4 h-4 flex-shrink-0" style={{ color: '#10B981' }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs" style={{ color: '#9CA3AF' }}>
                  <span>{doc.pages} pages</span>
                  <span className="px-2 py-0.5 rounded-full" style={{
                    background: doc.indexed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                    color: doc.indexed ? '#10B981' : '#9CA3AF'
                  }}>
                    {doc.indexed ? 'Indexed' : 'Processing'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
