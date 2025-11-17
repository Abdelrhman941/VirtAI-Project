
const avatars = [
  {
    id: 1,
    label: 'Professional',
    color: '#6B7280',
    icon: (
      <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
      </svg>
    )
  },
  {
    id: 2,
    label: 'Friendly',
    color: '#00ADB5',
    icon: (
      <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-7.536 5.879a1 1 0 001.415 0 3 3 0 014.242 0 1 1 0 001.415-1.415 5 5 0 00-7.072 0 1 1 0 000 1.415z" clipRule="evenodd" />
      </svg>
    )
  },
  {
    id: 3,
    label: 'Energetic',
    color: '#F59E0B',
    icon: (
      <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
      </svg>
    )
  },
  {
    id: 4,
    label: 'Academic',
    color: '#3B82F6',
    icon: (
      <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
      </svg>
    )
  },
  {
    id: 5,
    label: 'Dynamic',
    color: '#EF4444',
    icon: (
      <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M6.672 1.911a1 1 0 10-1.932.518l.259.966a1 1 0 001.932-.518l-.26-.966zM2.429 4.74a1 1 0 10-.517 1.932l.966.259a1 1 0 00.517-1.932l-.966-.26zm8.814-.569a1 1 0 00-1.415-1.414l-.707.707a1 1 0 101.415 1.415l.707-.708zm-7.071 7.072l.707-.707A1 1 0 003.465 9.12l-.708.707a1 1 0 001.415 1.415zm3.2-5.171a1 1 0 00-1.3 1.3l4 10a1 1 0 001.823.075l1.38-2.759 3.018 3.02a1 1 0 001.414-1.415l-3.019-3.02 2.76-1.379a1 1 0 00-.076-1.822l-10-4z" clipRule="evenodd" />
      </svg>
    )
  },
  {
    id: 6,
    label: 'Calm',
    color: '#92400E',
    icon: (
      <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M5.5 2a3.5 3.5 0 101.665 6.58L8.585 10l-1.42 1.42a3.5 3.5 0 101.414 1.414l8.128-8.127a1 1 0 00-1.414-1.414L10 8.586l-1.42-1.42A3.5 3.5 0 005.5 2zM4 5.5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm0 9a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" clipRule="evenodd" />
        <path d="M12.828 11.414a1 1 0 00-1.414 1.414l3.879 3.88a1 1 0 001.414-1.415l-3.879-3.879z" />
      </svg>
    )
  }
]

export default function AvatarGrid({ onSelect, selected }){
  return (
    <div className="grid grid-cols-3 gap-4">
      {avatars.map((av)=> (
        <button
          key={av.id}
          onClick={()=>onSelect(av)}
          className="group relative p-5 flex flex-col items-center justify-center rounded-xl transition-all duration-300 hover:scale-105"
          style={{
            background: selected?.id === av.id ? 'rgba(212, 175, 55, 0.1)' : '#1A1A1A',
            border: selected?.id === av.id ? '2px solid #D4AF37' : '2px solid #2D2D2D',
            boxShadow: selected?.id === av.id ? '0 10px 40px rgba(212, 175, 55, 0.3)' : 'none'
          }}
          onMouseEnter={e => !selected || selected.id !== av.id && (e.currentTarget.style.borderColor = '#D4AF37')}
          onMouseLeave={e => !selected || selected.id !== av.id && (e.currentTarget.style.borderColor = '#2D2D2D')}
        >
          {/* Selection Indicator */}
          {selected?.id === av.id && (
            <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center animate-pulse" style={{background: '#D4AF37'}}>
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}

          {/* Avatar Icon */}
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-3 shadow-md group-hover:shadow-xl transition-all duration-300 transform group-hover:scale-110"
            style={{backgroundColor: av.color}}
          >
            {av.icon}
          </div>

          {/* Avatar Label */}
          <span className="text-sm font-semibold transition-colors duration-300" style={{color: selected?.id === av.id ? '#D4AF37' : '#FFFFFF'}}>{av.label}</span>

          {/* Hover Glow Effect */}
          <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none" style={{background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.05), rgba(255, 215, 0, 0.05))'}}></div>
        </button>
      ))}
    </div>
  )
}

export { avatars }
