import { useState } from 'react'

export default function DocumentUploadModal({ isOpen, onClose }) {
  const [file, setFile] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [complete, setComplete] = useState(false)

  function handleFileChange(e) {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setComplete(false)
      setProgress(0)
    }
  }

  async function handleAnalyze() {
    if (!file) return

    setAnalyzing(true)
    setProgress(0)

    // Simulate analysis progress
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          setAnalyzing(false)
          setComplete(true)
          return 100
        }
        return prev + 10
      })
    }, 300)
  }

  function handleClose() {
    setFile(null)
    setAnalyzing(false)
    setProgress(0)
    setComplete(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0, 0, 0, 0.8)' }}>
      <div className="rounded-2xl p-8 max-w-lg w-full mx-4" style={{
        background: 'rgba(29, 29, 29, 0.98)',
        border: '1px solid rgba(212, 175, 55, 0.3)',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
      }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold" style={{ color: '#FFFFFF' }}>
            Upload & Analyze Document
          </h2>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg transition-colors"
            style={{ color: '#6B7280' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#D4AF37'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#6B7280'}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Upload Area */}
        <div className="mb-6">
          <label className="block cursor-pointer">
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="p-8 rounded-xl border-2 border-dashed text-center transition-all duration-300"
              style={{
                borderColor: file ? '#D4AF37' : '#3D3D3D',
                background: file ? 'rgba(212, 175, 55, 0.05)' : 'rgba(45, 45, 45, 0.3)'
              }}
            >
              <svg className="w-12 h-12 mx-auto mb-3" style={{ color: '#D4AF37' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {file ? (
                <div>
                  <p className="font-semibold mb-1" style={{ color: '#FFFFFF' }}>{file.name}</p>
                  <p className="text-sm" style={{ color: '#9CA3AF' }}>
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="font-semibold mb-1" style={{ color: '#FFFFFF' }}>
                    Click to upload or drag and drop
                  </p>
                  <p className="text-sm" style={{ color: '#9CA3AF' }}>
                    PDF, DOC, DOCX, TXT (max 10MB)
                  </p>
                </div>
              )}
            </div>
          </label>
        </div>

        {/* Progress Bar */}
        {analyzing && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium" style={{ color: '#FFFFFF' }}>Analyzing...</span>
              <span className="text-sm font-medium" style={{ color: '#D4AF37' }}>{progress}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: '#2D2D2D' }}>
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(135deg, #D4AF37, #FFD700)'
                }}
              />
            </div>
          </div>
        )}

        {/* Success Message */}
        {complete && (
          <div className="mb-6 p-4 rounded-lg flex items-center gap-3" style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)'
          }}>
            <svg className="w-5 h-5 flex-shrink-0" style={{ color: '#10B981' }} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-medium" style={{ color: '#10B981' }}>Analysis Complete!</p>
              <p className="text-sm" style={{ color: '#9CA3AF' }}>Document has been indexed and is ready to use</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-300"
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
            Cancel
          </button>
          <button
            onClick={handleAnalyze}
            disabled={!file || analyzing || complete}
            className="flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-300"
            style={{
              background: file && !analyzing && !complete ? 'linear-gradient(135deg, #D4AF37, #FFD700)' : '#3D3D3D',
              color: file && !analyzing && !complete ? '#000000' : '#6B7280',
              cursor: file && !analyzing && !complete ? 'pointer' : 'not-allowed',
              boxShadow: file && !analyzing && !complete ? '0 4px 15px rgba(212, 175, 55, 0.3)' : 'none'
            }}
          >
            {analyzing ? 'Analyzing...' : complete ? 'Complete' : 'Analyze Document'}
          </button>
        </div>
      </div>
    </div>
  )
}
