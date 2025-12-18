export default function ReadyStep({ state, onChange, onGotoClass, onEditSetup }){
  return (
    <div className="max-w-2xl mx-auto px-6" style={{paddingTop: '3rem', paddingBottom: '3rem'}}>
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
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <span style={{color: '#D4AF37', fontSize: '0.875rem', fontWeight: '600', letterSpacing: '0.05em'}}>Step 3 of 3</span>
        </div>
      </div>

      {/* Success Icon */}
      <div className="flex justify-center mb-10">
        <div className="relative">
          <div className="absolute inset-0 rounded-full blur-2xl animate-pulse" style={{background: 'rgba(212, 175, 55, 0.3)'}}></div>
          <div className="relative w-28 h-28 rounded-full flex items-center justify-center" style={{background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(255, 215, 0, 0.2))', border: '2px solid #D4AF37'}}>
            <svg className="w-14 h-14" fill="none" stroke="#D4AF37" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Header Section */}
      <div className="text-center mb-12">
        <h2 className="text-5xl font-bold mb-4" style={{color: '#FFFFFF', letterSpacing: '-0.02em'}}>Setup Complete!</h2>
        <p style={{color: '#B0B0B0', fontSize: '1.125rem'}}>Your AI tutor is ready. Let's start learning.</p>
      </div>

      {/* Setup Summary Cards */}
      <div className="rounded-2xl p-8 mb-10 space-y-4 transition-all duration-500" style={{
        background: 'rgba(26, 26, 26, 0.6)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(212, 175, 55, 0.2)',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3)'
      }}>
        {/* Avatar Row */}
        <div className="group flex items-center justify-between p-5 rounded-lg transition-all duration-300 cursor-pointer hover:scale-[1.02]" style={{
          background: 'rgba(45, 45, 45, 0.5)',
          border: '1px solid rgba(61, 61, 61, 0.5)',
          backdropFilter: 'blur(5px)'
        }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#D4AF37'
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(212, 175, 55, 0.2)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'rgba(61, 61, 61, 0.5)'
            e.currentTarget.style.boxShadow = 'none'
          }}>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(255, 215, 0, 0.1))', border: '2px solid #D4AF37'}}>
              {state.avatar ? (
                // Check if avatar is a string (URL) or object (from grid)
                typeof state.avatar === 'string' ? (
                  <img src={state.avatar} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                ) : (
                  // Render the avatar icon from the grid
                  <div className="w-full h-full rounded-full flex items-center justify-center" style={{backgroundColor: state.avatar.color}}>
                    {state.avatar.icon}
                  </div>
                )
              ) : (
                <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              )}
            </div>
            <div>
              <div className="text-sm mb-1" style={{color: '#B0B0B0'}}>Avatar</div>
              <div className="text-lg font-semibold" style={{color: '#FFFFFF'}}>
                {state.avatar ? (typeof state.avatar === 'string' ? 'Custom' : state.avatar.label) : 'Default'}
              </div>
            </div>
          </div>
        </div>

        {/* Voice Row */}
        <div className="group flex items-center justify-between p-5 rounded-lg transition-all duration-300 cursor-pointer hover:scale-[1.02]" style={{
          background: 'rgba(45, 45, 45, 0.5)',
          border: '1px solid rgba(61, 61, 61, 0.5)',
          backdropFilter: 'blur(5px)'
        }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#D4AF37'
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(212, 175, 55, 0.2)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'rgba(61, 61, 61, 0.5)'
            e.currentTarget.style.boxShadow = 'none'
          }}>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(255, 215, 0, 0.1))', border: '2px solid #D4AF37'}}>
              <svg className="w-7 h-7" fill="none" stroke="#D4AF37" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <div>
              <div className="text-sm mb-1" style={{color: '#B0B0B0'}}>Voice</div>
              <div className="text-lg font-semibold" style={{color: '#FFFFFF'}}>{state.voice || 'Calm Female'}</div>
            </div>
          </div>
        </div>

        {/* Documents Row */}
        <div className="group flex items-center justify-between p-5 rounded-lg transition-all duration-300 cursor-pointer hover:scale-[1.02]" style={{
          background: 'rgba(45, 45, 45, 0.5)',
          border: '1px solid rgba(61, 61, 61, 0.5)',
          backdropFilter: 'blur(5px)'
        }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#D4AF37'
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(212, 175, 55, 0.2)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'rgba(61, 61, 61, 0.5)'
            e.currentTarget.style.boxShadow = 'none'
          }}>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(255, 215, 0, 0.1))', border: '2px solid #D4AF37'}}>
              <svg className="w-7 h-7" fill="none" stroke="#D4AF37" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <div className="text-sm mb-1" style={{color: '#B0B0B0'}}>Documents</div>
              <div className="text-lg font-semibold" style={{color: '#FFFFFF'}}>
                {(state.docs && state.docs.length) ? `${state.docs.length} Uploaded` : 'None'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={()=>onEditSetup && onEditSetup()}
          className="px-8 py-4 rounded-xl font-semibold transition-all duration-300"
          style={{background: '#2D2D2D', color: '#FFFFFF', border: '1px solid #3D3D3D'}}
          onMouseEnter={e => {e.currentTarget.style.borderColor = '#D4AF37'; e.currentTarget.style.color = '#D4AF37'}}
          onMouseLeave={e => {e.currentTarget.style.borderColor = '#3D3D3D'; e.currentTarget.style.color = '#FFFFFF'}}
        >
          Edit Setup
        </button>
        <button
          onClick={onGotoClass}
          className="px-10 py-4 text-white rounded-xl font-semibold transition-all duration-300 hover:scale-105"
          style={{background: 'linear-gradient(135deg, #D4AF37, #FFD700)', boxShadow: '0 10px 40px rgba(212, 175, 55, 0.3)'}}
          onMouseEnter={e => e.currentTarget.style.boxShadow = '0 15px 50px rgba(212, 175, 55, 0.5)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow = '0 10px 40px rgba(212, 175, 55, 0.3)'}
        >
          Go to Classroom
        </button>
      </div>
    </div>
  )
}
