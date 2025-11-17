import { useState } from 'react'
import AvatarGrid from './components/AvatarGrid'
import AvatarPreview from './components/AvatarPreview'
import Uploader from './components/Uploader'

export default function AvatarStep({ state, onChange, onProceed }){
  const [local, setLocal] = useState({ name: state.name || '', voice: state.voice || 'Calm Female', tone: state.tone || 'Friendly' })

  function chooseAvatar(av){
    onChange({ avatar: av })
  }

  return (
    <div className="max-w-6xl mx-auto" style={{padding: '3rem 2rem'}}>
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
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
          <span style={{color: '#D4AF37', fontSize: '0.875rem', fontWeight: '600', letterSpacing: '0.05em'}}>Step 1 of 3</span>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid md:grid-cols-2 gap-8 px-6">
        {/* Left Side - Avatar Selection */}
        <div className="space-y-6">
          <div>
            <h3 className="text-4xl font-bold mb-3" style={{color: '#FFFFFF', letterSpacing: '-0.02em'}}>Choose Your Tutor Avatar</h3>
            <p style={{color: '#B0B0B0', fontSize: '1rem'}}>Select a default avatar or upload your own</p>
          </div>

          <AvatarGrid onSelect={chooseAvatar} selected={state.avatar} />

          <div className="pt-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1" style={{height: '1px', background: 'linear-gradient(to right, transparent, #D4AF37, transparent)'}}></div>
              <p style={{color: '#D4AF37', fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.1em'}}>OR UPLOAD YOUR OWN</p>
              <div className="flex-1" style={{height: '1px', background: 'linear-gradient(to right, transparent, #D4AF37, transparent)'}}></div>
            </div>
            <Uploader onUpload={(file)=>onChange({ avatar: URL.createObjectURL(file) })} />
          </div>
        </div>

        {/* Right Side - Preview & Settings */}
        <div className="space-y-6">
          <div>
            <h3 className="text-4xl font-bold" style={{color: '#FFFFFF', letterSpacing: '-0.02em'}}>Preview & Settings</h3>
          </div>

          <AvatarPreview avatar={state.avatar} name={local.name} voice={local.voice} tone={local.tone} onChange={(patch)=>{ setLocal({...local,...patch}); onChange(patch) }} />
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="px-6 py-8 mt-10">
        <div className="flex justify-between items-center max-w-6xl mx-auto">
          <button
            className="group flex items-center gap-2 transition-all duration-300"
            style={{color: '#B0B0B0'}}
            onMouseEnter={e => e.currentTarget.style.color = '#D4AF37'}
            onMouseLeave={e => e.currentTarget.style.color = '#B0B0B0'}
            onClick={()=>onProceed && onProceed()}
          >
            <span className="border-b border-transparent group-hover:border-current transition-all duration-300">Skip this step</span>
            <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>

          <button
            onClick={()=>{ onChange({ avatar: state.avatar }); onProceed && onProceed() }}
            className="group relative px-8 py-4 text-white rounded-xl font-semibold transition-all duration-300 hover:scale-105"
            style={{background: 'linear-gradient(135deg, #D4AF37, #FFD700)', boxShadow: '0 10px 40px rgba(212, 175, 55, 0.3)'}}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 15px 50px rgba(212, 175, 55, 0.5)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 10px 40px rgba(212, 175, 55, 0.3)'}
          >
            <span className="flex items-center gap-2">
              Save Avatar & Continue
              <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
