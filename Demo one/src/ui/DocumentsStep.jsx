import { useState } from 'react'
import { analyzeFile, uploadFile } from '../api/mock'
import DocumentUploader from './components/DocumentUploader'

export default function DocumentsStep({ state, onChange, onProceed, onBack }){
  const [files, setFiles] = useState([])

  const handleUpload = async (file)=>{
    const res = await uploadFile(file)
    const entry = { id: res.fileId, name: res.name, size: res.size, status: 'Ready' }
    setFiles(f=>[...f, entry])
  }

  const analyze = async (fileId)=>{
    setFiles(f=>f.map(x=> x.id===fileId?{...x, status:'Analyzing'}:x))
    const r = await analyzeFile({ fileId })
    setFiles(f=>{
      const updatedFiles = f.map(x=> x.id===fileId?{...x, status:'Indexed', summary: r.summary, docId: r.docId}:x)
      // Only pass the indexed documents to the state
      onChange({ docs: updatedFiles.filter(doc => doc.status === 'Indexed').map(doc => ({ fileId: doc.id, docId: doc.docId })) })
      return updatedFiles
    })
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* Step Indicator */}
      <div className="flex justify-center mb-8">
        <div className="flex items-center gap-2 transition-all duration-300 hover:scale-105" style={{
          background: 'rgba(212, 175, 55, 0.1)',
          border: '1px solid rgba(212, 175, 55, 0.5)',
          borderRadius: '9999px',
          padding: '0.5rem 1.5rem',
          boxShadow: '0 4px 20px rgba(212, 175, 55, 0.2)'
        }}>
          <svg className="w-4 h-4" style={{color: '#D4AF37'}} fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
            <path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
          </svg>
          <span style={{color: '#D4AF37', fontSize: '0.875rem', fontWeight: '600', letterSpacing: '0.05em'}}>Step 2 of 3</span>
        </div>
      </div>

      {/* Header Section */}
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold mb-4" style={{color: '#FFFFFF', letterSpacing: '-0.02em'}}>
          Upload Your Documents
        </h2>
        <p className="text-lg max-w-2xl mx-auto" style={{color: '#B0B0B0'}}>
          Add your learning materials to build a personalized AI knowledge base
        </p>
      </div>

      {/* Supported Formats Section - Dark Theme */}
      <div className="rounded-2xl p-8 mb-10 transition-all duration-500" style={{
        background: 'rgba(45, 45, 45, 0.6)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(212, 175, 55, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
      }}>
        <div className="flex items-center gap-3 mb-6">
          <svg className="w-6 h-6" style={{color: '#D4AF37'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-bold" style={{color: '#FFFFFF'}}>Supported File Formats</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {/* PDF Format */}
          <div className="flex items-center gap-4 rounded-xl p-5 transition-all duration-300 group cursor-pointer hover:shadow-xl" style={{background: 'rgba(212, 175, 55, 0.05)', border: '1px solid rgba(212, 175, 55, 0.2)'}} onMouseEnter={(e) => e.currentTarget.style.borderColor = '#D4AF37'} onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.2)'}>
            <div className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110" style={{background: 'rgba(212, 175, 55, 0.15)'}}>
              <svg className="w-6 h-6" style={{color: '#D4AF37'}} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold mb-1" style={{color: '#FFFFFF'}}>PDF Documents</div>
              <div className="text-xs" style={{color: '#B0B0B0'}}>.pdf files</div>
            </div>
          </div>

          {/* Word Document Format */}
          <div className="flex items-center gap-4 rounded-xl p-5 transition-all duration-300 group cursor-pointer hover:shadow-xl" style={{background: 'rgba(212, 175, 55, 0.05)', border: '1px solid rgba(212, 175, 55, 0.2)'}} onMouseEnter={(e) => e.currentTarget.style.borderColor = '#D4AF37'} onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.2)'}>
            <div className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110" style={{background: 'rgba(212, 175, 55, 0.15)'}}>
              <svg className="w-6 h-6" style={{color: '#D4AF37'}} fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold mb-1" style={{color: '#FFFFFF'}}>Word Files</div>
              <div className="text-xs" style={{color: '#B0B0B0'}}>.doc, .docx</div>
            </div>
          </div>

          {/* Text File Format */}
          <div className="flex items-center gap-4 rounded-xl p-5 transition-all duration-300 group cursor-pointer hover:shadow-xl" style={{background: 'rgba(212, 175, 55, 0.05)', border: '1px solid rgba(212, 175, 55, 0.2)'}} onMouseEnter={(e) => e.currentTarget.style.borderColor = '#D4AF37'} onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.2)'}>
            <div className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110" style={{background: 'rgba(212, 175, 55, 0.15)'}}>
              <svg className="w-6 h-6" style={{color: '#D4AF37'}} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold mb-1" style={{color: '#FFFFFF'}}>Text Files</div>
              <div className="text-xs" style={{color: '#B0B0B0'}}>.txt files</div>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Area */}
      <div className="mb-10">
        <DocumentUploader onUpload={handleUpload} />
      </div>

      {/* Uploaded Files List */}
      {files.length > 0 && (
        <div className="rounded-2xl p-8 mb-10 transition-all duration-500" style={{
          background: 'rgba(45, 45, 45, 0.6)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(212, 175, 55, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
        }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{background: 'rgba(212, 175, 55, 0.15)'}}>
                <svg className="w-5 h-5" style={{color: '#D4AF37'}} fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
                  <path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold" style={{color: '#FFFFFF'}}>Uploaded Documents</h3>
                <p className="text-sm" style={{color: '#B0B0B0'}}>{files.length} {files.length === 1 ? 'file' : 'files'} uploaded</p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {files.map(f=> (
              <div key={f.id} className="rounded-xl p-5 transition-all duration-300 hover:shadow-lg" style={{background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)'}}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{background: 'rgba(212, 175, 55, 0.1)'}}>
                      <svg className="w-6 h-6" style={{color: '#D4AF37'}} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-base truncate mb-2" style={{color: '#FFFFFF'}}>{f.name}</div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-3 py-1 rounded-full font-medium ${f.status === 'Indexed' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : f.status === 'Analyzing' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'}`}>
                          {f.status === 'Analyzing' && <span className="inline-block w-2 h-2 bg-yellow-400 rounded-full animate-pulse mr-2"></span>}
                          {f.status}
                        </span>
                        <span className="text-xs font-medium" style={{color: '#B0B0B0'}}>{(f.size / 1024).toFixed(1)} KB</span>
                      </div>
                      {f.summary && <div className="text-xs mt-2 line-clamp-2" style={{color: '#B0B0B0'}}>{f.summary.excerpt}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {f.status === 'Ready' && (
                      <button
                        onClick={()=>analyze(f.id)}
                        className="px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 hover:shadow-lg"
                        style={{background: 'linear-gradient(135deg, #D4AF37, #FFD700)', color: '#000000'}}
                      >
                        Analyze Now
                      </button>
                    )}
                    <button className="p-2.5 rounded-lg transition-all duration-300 hover:bg-red-500/20" style={{color: '#B0B0B0'}}>
                      <svg className="w-5 h-5 hover:text-red-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons - Professional Dark Theme */}
      <div className="flex items-center justify-between pt-8" style={{borderTop: '1px solid rgba(255, 255, 255, 0.1)'}}>
        <button
          onClick={()=>onBack && onBack()}
          className="px-6 py-3 font-semibold transition-all duration-300 flex items-center gap-2 hover:gap-3"
          style={{color: '#B0B0B0'}}
          onMouseEnter={(e) => e.currentTarget.style.color = '#D4AF37'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#B0B0B0'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Avatar
        </button>
        <div className="flex gap-4">
          <button
            onClick={()=>onProceed && onProceed()}
            className="px-6 py-3 rounded-xl font-semibold transition-all duration-300"
            style={{color: '#B0B0B0', border: '1px solid rgba(255, 255, 255, 0.2)', background: 'transparent'}}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#D4AF37'
              e.currentTarget.style.color = '#D4AF37'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
              e.currentTarget.style.color = '#B0B0B0'
            }}
          >
            Skip for Now
          </button>
          <button
            onClick={()=>onProceed && onProceed()}
            className="px-8 py-3 rounded-xl font-bold transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed shadow-xl flex items-center gap-2"
            style={{background: files.length === 0 ? '#6B7280' : 'linear-gradient(135deg, #D4AF37, #FFD700)', color: '#000000'}}
            disabled={files.length === 0}
          >
            Proceed to Classroom
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
