import { useRef, useState } from 'react'

export default function Uploader({ onUpload }){
  const ref = useRef()
  const [isDragging, setIsDragging] = useState(false)

  function handleFiles(files){
    const f = files[0]
    if(f && onUpload) onUpload(f)
    setIsDragging(false)
  }

  function handleDrag(e){
    e.preventDefault()
    e.stopPropagation()
  }

  function handleDragIn(e){
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  function handleDragOut(e){
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  function handleDrop(e){
    e.preventDefault()
    e.stopPropagation()
    if(e.dataTransfer.files && e.dataTransfer.files.length > 0){
      handleFiles(e.dataTransfer.files)
    }
  }

  return (
    <div
      className="group relative p-8 border-dashed border-2 rounded-xl text-center cursor-pointer transition-all duration-300"
      style={{
        background: isDragging ? 'rgba(212, 175, 55, 0.1)' : '#1A1A1A',
        borderColor: isDragging ? '#D4AF37' : '#3D3D3D',
        transform: isDragging ? 'scale(1.02)' : 'scale(1)'
      }}
      onMouseEnter={e => !isDragging && (e.currentTarget.style.borderColor = '#D4AF37')}
      onMouseLeave={e => !isDragging && (e.currentTarget.style.borderColor = '#3D3D3D')}
      onClick={()=>ref.current?.click()}
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <div className="relative flex flex-col items-center gap-3">
        {/* Upload Icon with Animation */}
        <div className={`relative transition-all duration-300 ${isDragging ? 'scale-110' : 'group-hover:scale-110'}`}>
          <div className="absolute inset-0 rounded-full blur-xl animate-pulse" style={{background: 'rgba(212, 175, 55, 0.2)'}}></div>
          <svg className="relative w-12 h-12 transition-colors duration-300" fill="none" stroke={isDragging ? '#D4AF37' : '#B0B0B0'} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>

        {/* Upload Text */}
        <div className="space-y-1">
          <div className="text-sm font-semibold transition-colors duration-300" style={{color: isDragging ? '#D4AF37' : '#FFFFFF'}}>
            {isDragging ? 'Drop your image here' : 'Drop an image here or click to browse'}
          </div>
          <div className="text-xs" style={{color: '#B0B0B0'}}>PNG, JPG up to 5MB</div>
        </div>
      </div>

      <input
        ref={ref}
        type="file"
        onChange={e=>handleFiles(e.target.files)}
        className="hidden"
        accept="image/*"
      />
    </div>
  )
}
