import { useNavigate } from 'react-router-dom';
import LiquidEther from '../components/LiquidEther';

const FeatureCard = ({icon, title, desc, items})=> (
  <div className="p-6 flex flex-col gap-4 rounded-2xl transition-all duration-300"
    style={{background: '#1A1A1A', border: '1px solid #2D2D2D', boxShadow: '0 4px 20px rgba(0,0,0,0.3)'}}
    onMouseEnter={e => {e.currentTarget.style.borderColor = '#D4AF37'; e.currentTarget.style.boxShadow = '0 10px 40px rgba(212, 175, 55, 0.3)'}}
    onMouseLeave={e => {e.currentTarget.style.borderColor = '#2D2D2D'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)'}}>
    <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{background: 'rgba(212, 175, 55, 0.2)'}}>
      <div style={{color: '#D4AF37'}}>
        {icon}
      </div>
    </div>
    <h4 className="font-bold text-lg" style={{color: '#FFFFFF'}}>{title}</h4>
    <p className="text-sm leading-relaxed" style={{color: '#B0B0B0'}}>{desc}</p>
    {items && (
      <ul className="space-y-2 mt-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="#D4AF37" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span style={{color: '#B0B0B0'}}>{item}</span>
          </li>
        ))}
      </ul>
    )}
  </div>
)

export default function Overview(){
  const nav = useNavigate()
  return (
    <>
      {/* LiquidEther Background - Full Content Area (excluding header/footer) */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none'
      }}>
        <LiquidEther
          colors={['#FAD59A']}
          mouseForce={20}
          cursorSize={100}
          isViscous={true}
          viscous={50}
          iterationsViscous={16}
          iterationsPoisson={16}
          resolution={0.5}
          isBounce={false}
          autoDemo={true}
          autoSpeed={0.5}
          autoIntensity={2.2}
          takeoverDuration={0.2}
          autoResumeDelay={2500}
          autoRampDuration={0.5}
        />
      </div>

      <div className="relative mx-auto" style={{maxWidth:1200, minWidth:320, width:'100%'}}>
      {/* Hero Section */}
      <section className="grid md:grid-cols-2 gap-8 mb-16 items-center relative z-10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm mb-6 mt-8" style={{background: 'rgba(212, 175, 55, 0.15)', color: '#D4AF37'}}>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg>
            <span className="font-medium">AI-Powered Learning Platform</span>
          </div>
          <h1 className="text-5xl font-bold mb-4 leading-tight" style={{color: '#FFFFFF'}}>
            Your Personal<br/>
            <span style={{color: '#D4AF37'}}>AI Tutor</span><br/>
            Awaits
          </h1>
          <p className="text-lg mb-8 leading-relaxed" style={{color: '#B0B0B0'}}>
            Transform your learning experience with EduAgent Pro. Upload documents, engage in voice conversations, and receive personalized tutoring powered by advanced AI technology.
          </p>
          <div className="flex gap-4">
            <button onClick={()=>nav('/setup')} className="px-6 py-3 rounded-lg text-white font-semibold transition-all flex items-center gap-2 hover:scale-105" style={{background: 'linear-gradient(135deg, #D4AF37, #FFD700)', boxShadow: '0 4px 20px rgba(212, 175, 55, 0.3)'}}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 10px 40px rgba(212, 175, 55, 0.5)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = '0 4px 20px rgba(212, 175, 55, 0.3)'}>
              Get Started Free
              <span>→</span>
            </button>
            <button className="px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2" style={{border: '2px solid #D4AF37', color: '#D4AF37', background: 'transparent'}}
              onMouseEnter={e => {e.currentTarget.style.background = '#D4AF37'; e.currentTarget.style.color = '#FFFFFF'}}
              onMouseLeave={e => {e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#D4AF37'}}>
              <span>▶</span>
              Try Demo
            </button>
          </div>
        </div>
        <div className="relative">
          <div className="p-2 relative flex items-center justify-center rounded-2xl" style={{background: '#1A1A1A', border: '1px solid #2D2D2D'}}>
            <div className="absolute top-4 right-4 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 z-10" style={{background: '#D4AF37'}}>
              <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
              AI Chat Active
            </div>
            <img src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=400&fit=crop" alt="Students learning" className="w-full h-64 object-cover rounded-lg" />
          </div>
        </div>
      </section>

      {/* Powerful Features Section */}
      <section className="mb-16 relative z-10">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 text-sm mb-3" style={{color: '#D4AF37'}}>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd"/></svg>
            <span className="font-semibold">Powerful Features</span>
          </div>
          <h2 className="text-4xl font-bold mb-4" style={{color: '#FFFFFF'}}>
            Everything You Need to<br/>
            <span style={{color: '#D4AF37'}}>Learn Smarter</span>
          </h2>
          <p className="max-w-2xl mx-auto" style={{color: '#B0B0B0'}}>
            Discover how EduAgent Pro combines cutting-edge AI technology with intuitive design to create the ultimate personalized learning experience.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <FeatureCard
            icon={<svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>}
            title="AI-Powered Tutoring"
            desc="Get personalized explanations and guidance tailored to your learning style and pace."
            items={[
              "Adaptive learning paths",
              "Real-time feedback",
              "24/7 availability"
            ]}
          />
          <FeatureCard
            icon={<svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
            title="Document Analysis"
            desc="Upload PDFs, Word docs, and text files for instant AI-powered analysis and insights."
            items={[
              "Multi-format support",
              "Instant processing",
              "Smart indexing"
            ]}
          />
          <FeatureCard
            icon={<svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>}
            title="Voice Interactions"
            desc="Engage in natural voice conversations with your AI tutor for immersive learning."
            items={[
              "Natural speech recognition",
              "Multiple voice options",
              "Audio playback"
            ]}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeatureCard
            icon={<svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
            title="Personalized Learning"
            desc="Customize your avatar, voice preferences, and learning experience to match your style."
          />
          <FeatureCard
            icon={<svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
            title="Smart Knowledge Base"
            desc="Build and search through your personal knowledge base with intelligent indexing."
          />
          <FeatureCard
            icon={<svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
            title="Collaborative Learning"
            desc="Share insights, create study groups, and learn together with peers."
          />
        </div>
      </section>
      </div>

      {/* Footer - About Us */}
      <footer className="py-12" style={{background: '#0A0A0A', borderTop: '1px solid #2D2D2D', position: 'relative', zIndex: 10}}>
        <div className="container mx-auto px-6">
          <div className="mb-8">
            {/* About Us - Contributors */}
            <div className="text-center">
              <h4 className="font-bold text-2xl mb-6" style={{color: '#FFFFFF'}}>About Us</h4>
              <p className="text-sm mb-8 max-w-2xl mx-auto" style={{color: '#B0B0B0'}}>Our team of passionate developers committed to revolutionizing education through AI.</p>
              <div className="flex flex-wrap gap-4 justify-center">
                <a href="https://github.com/Abdelrhman941" target="_blank" rel="noopener noreferrer" className="group relative">
                  <div className="w-14 h-14 rounded-full overflow-hidden transition-all duration-300 group-hover:scale-110" style={{border: '2px solid #2D2D2D'}}
                    onMouseEnter={e => {e.currentTarget.style.borderColor = '#D4AF37'; e.currentTarget.style.boxShadow = '0 0 20px rgba(212, 175, 55, 0.5)'}}
                    onMouseLeave={e => {e.currentTarget.style.borderColor = '#2D2D2D'; e.currentTarget.style.boxShadow = 'none'}}>
                    <img src="https://github.com/Abdelrhman941.png" alt="Abdelrhman941" className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                    <span className="text-xs font-medium" style={{color: '#D4AF37'}}>Abdelrhman941</span>
                  </div>
                </a>
                <a href="https://github.com/HassanZoghly" target="_blank" rel="noopener noreferrer" className="group relative">
                  <div className="w-14 h-14 rounded-full overflow-hidden transition-all duration-300 group-hover:scale-110" style={{border: '2px solid #2D2D2D'}}
                    onMouseEnter={e => {e.currentTarget.style.borderColor = '#D4AF37'; e.currentTarget.style.boxShadow = '0 0 20px rgba(212, 175, 55, 0.5)'}}
                    onMouseLeave={e => {e.currentTarget.style.borderColor = '#2D2D2D'; e.currentTarget.style.boxShadow = 'none'}}>
                    <img src="https://github.com/HassanZoghly.png" alt="HassanZoghly" className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                    <span className="text-xs font-medium" style={{color: '#D4AF37'}}>HassanZoghly</span>
                  </div>
                </a>
                <a href="https://github.com/mohamedali572" target="_blank" rel="noopener noreferrer" className="group relative">
                  <div className="w-14 h-14 rounded-full overflow-hidden transition-all duration-300 group-hover:scale-110" style={{border: '2px solid #2D2D2D'}}
                    onMouseEnter={e => {e.currentTarget.style.borderColor = '#D4AF37'; e.currentTarget.style.boxShadow = '0 0 20px rgba(212, 175, 55, 0.5)'}}
                    onMouseLeave={e => {e.currentTarget.style.borderColor = '#2D2D2D'; e.currentTarget.style.boxShadow = 'none'}}>
                    <img src="https://github.com/mohamedali572.png" alt="mohamedali572" className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                    <span className="text-xs font-medium" style={{color: '#D4AF37'}}>mohamedali572</span>
                  </div>
                </a>
                <a href="https://github.com/AbdallahElesh22" target="_blank" rel="noopener noreferrer" className="group relative">
                  <div className="w-14 h-14 rounded-full overflow-hidden transition-all duration-300 group-hover:scale-110" style={{border: '2px solid #2D2D2D'}}
                    onMouseEnter={e => {e.currentTarget.style.borderColor = '#D4AF37'; e.currentTarget.style.boxShadow = '0 0 20px rgba(212, 175, 55, 0.5)'}}
                    onMouseLeave={e => {e.currentTarget.style.borderColor = '#2D2D2D'; e.currentTarget.style.boxShadow = 'none'}}>
                    <img src="https://github.com/AbdallahElesh22.png" alt="AbdallahElesh22" className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                    <span className="text-xs font-medium" style={{color: '#D4AF37'}}>AbdallahElesh22</span>
                  </div>
                </a>
                <a href="https://github.com/moustafa-nasser" target="_blank" rel="noopener noreferrer" className="group relative">
                  <div className="w-14 h-14 rounded-full overflow-hidden transition-all duration-300 group-hover:scale-110" style={{border: '2px solid #2D2D2D'}}
                    onMouseEnter={e => {e.currentTarget.style.borderColor = '#D4AF37'; e.currentTarget.style.boxShadow = '0 0 20px rgba(212, 175, 55, 0.5)'}}
                    onMouseLeave={e => {e.currentTarget.style.borderColor = '#2D2D2D'; e.currentTarget.style.boxShadow = 'none'}}>
                    <img src="https://github.com/moustafa-nasser.png" alt="moustafa-nasser" className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                    <span className="text-xs font-medium" style={{color: '#D4AF37'}}>moustafa-nasser</span>
                  </div>
                </a>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8" style={{borderTop: '1px solid #2D2D2D'}}>
            <div className="text-center">
              <p className="text-sm" style={{color: '#B0B0B0'}}>© 2025 EduAgent Pro. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}
