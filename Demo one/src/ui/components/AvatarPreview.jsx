
export default function AvatarPreview({ avatar, name, voice, tone, onChange }){
  // Determine avatar display based on type
  const getAvatarDisplay = () => {
    if (!avatar) {
      return {
        bg: 'from-primary to-surface',
        content: (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-16 h-16 text-muted/50" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          </div>
        )
      }
    }

    // If it's a custom uploaded image
    if (typeof avatar === 'string' && avatar.startsWith('blob:')) {
      return {
        bg: 'from-accent/20 to-accent/40',
        content: <img src={avatar} alt="avatar" className="w-full h-full object-cover object-center" />
      }
    }

    // If it's a default avatar object
    if (typeof avatar === 'object' && avatar.color && avatar.icon) {
      return {
        bg: `from-[${avatar.color}]/80 to-[${avatar.color}]`,
        bgColor: avatar.color,
        content: (
          <div className="w-full h-full flex items-center justify-center" style={{backgroundColor: avatar.color}}>
            <div className="scale-125">
              {avatar.icon}
            </div>
          </div>
        )
      }
    }

    // Fallback
    return {
      bg: 'from-accent/20 to-accent/40',
      content: (
        <div className="w-full h-full flex items-center justify-center">
          <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
        </div>
      )
    }
  }

  const avatarDisplay = getAvatarDisplay()

  return (
    <div className="relative overflow-hidden rounded-2xl" style={{background: '#1A1A1A', border: '1px solid #2D2D2D', padding: '2rem'}}>
      {/* Subtle Background Gradient */}
      <div className="absolute inset-0 pointer-events-none" style={{background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.05), transparent)'}}></div>

      <div className="relative">
        <div className="flex flex-col items-center mb-8">
          <div className="relative group">
            {/* Glow Effect */}
            <div className="absolute inset-0 rounded-full blur-2xl transition-all duration-500 animate-pulse" style={{background: 'rgba(212, 175, 55, 0.3)'}}></div>

            {/* Avatar Circle with Fade Transition */}
            <div className="relative w-32 h-32 rounded-full overflow-hidden shadow-xl transition-all duration-300 mb-4 group-hover:scale-105" style={{background: avatarDisplay.bgColor || '#2D2D2D', border: '4px solid #D4AF37'}}>
              {avatarDisplay.content}
            </div>

            {/* Avatar Type Badge */}
            {avatar?.label && (
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 px-3 py-1 text-white text-xs font-semibold rounded-full shadow-lg whitespace-nowrap animate-fadeIn" style={{background: '#D4AF37'}}>
                {avatar.label}
              </div>
            )}
          </div>

          {/* Title */}
          <h4 className="text-xl font-bold mb-1 mt-4" style={{color: '#FFFFFF'}}>My AI Tutor</h4>
          <p className="text-xs" style={{color: '#B0B0B0'}}>Customize your learning assistant</p>
        </div>

        {/* Settings Form with Enhanced Styling */}
        <div className="space-y-5">
          {/* Display Name */}
          <div className="group">
            <label className="text-sm font-semibold block mb-2 flex items-center gap-2" style={{color: '#FFFFFF'}}>
              <svg className="w-4 h-4" fill="#D4AF37" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
              Display Name
            </label>
            <input
              value={name}
              onChange={e=>onChange({ name: e.target.value })}
              placeholder="My AI Tutor"
              className="block w-full p-3 rounded-xl transition-all duration-300 focus:outline-none"
              style={{background: '#2D2D2D', border: '2px solid #3D3D3D', color: '#FFFFFF'}}
              onFocus={e => e.currentTarget.style.borderColor = '#D4AF37'}
              onBlur={e => e.currentTarget.style.borderColor = '#3D3D3D'}
            />
          </div>

          {/* Voice Selection */}
          <div className="group">
            <label className="text-sm font-semibold block mb-2 flex items-center gap-2" style={{color: '#FFFFFF'}}>
              <svg className="w-4 h-4" fill="#D4AF37" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
              Voice
            </label>
            <select
              value={voice}
              onChange={e=>onChange({ voice: e.target.value })}
              className="block w-full p-3 rounded-xl transition-all duration-300 cursor-pointer focus:outline-none"
              style={{background: '#2D2D2D', border: '2px solid #3D3D3D', color: '#FFFFFF'}}
              onFocus={e => e.currentTarget.style.borderColor = '#D4AF37'}
              onBlur={e => e.currentTarget.style.borderColor = '#3D3D3D'}
            >
              <option>Calm Female</option>
              <option>Neutral Male</option>
            </select>
          </div>

          {/* Tone Selection */}
          <div className="group">
            <label className="text-sm font-semibold block mb-2 flex items-center gap-2" style={{color: '#FFFFFF'}}>
              <svg className="w-4 h-4" fill="#D4AF37" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
              Tone
            </label>
            <select
              value={tone}
              onChange={e=>onChange({ tone: e.target.value })}
              className="block w-full p-3 rounded-xl transition-all duration-300 cursor-pointer focus:outline-none"
              style={{background: '#2D2D2D', border: '2px solid #3D3D3D', color: '#FFFFFF'}}
              onFocus={e => e.currentTarget.style.borderColor = '#D4AF37'}
              onBlur={e => e.currentTarget.style.borderColor = '#3D3D3D'}
            >
              <option>Friendly</option>
              <option>Concise</option>
              <option>Formal</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
