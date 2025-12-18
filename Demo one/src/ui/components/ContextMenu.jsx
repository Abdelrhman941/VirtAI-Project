import { useEffect, useRef } from 'react'

export default function ContextMenu({ x, y, options, onSelect, onClose }) {
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose()
      }
    }

    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  return (
    <div
      ref={menuRef}
      className="fixed z-50 rounded-lg shadow-xl overflow-hidden"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        minWidth: '200px',
        background: 'rgba(45, 45, 45, 0.98)',
        border: '1px solid rgba(212, 175, 55, 0.3)',
        backdropFilter: 'blur(10px)',
        animation: 'slideIn 0.15s ease-out'
      }}
    >
      {options.map((option, index) => (
        <button
          key={option.id}
          onClick={() => {
            onSelect(option.id)
            onClose()
          }}
          className="w-full px-4 py-2.5 text-left flex items-center gap-3 transition-all duration-200"
          style={{
            color: option.danger ? '#EF4444' : '#FFFFFF',
            borderBottom: index < options.length - 1 ? '1px solid rgba(212, 175, 55, 0.1)' : 'none'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(212, 175, 55, 0.1)'
            if (!option.danger) e.currentTarget.style.color = '#D4AF37'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            if (!option.danger) e.currentTarget.style.color = '#FFFFFF'
          }}
        >
          <span className="text-base">{option.icon}</span>
          <span className="text-sm font-medium">{option.label}</span>
        </button>
      ))}
    </div>
  )
}
