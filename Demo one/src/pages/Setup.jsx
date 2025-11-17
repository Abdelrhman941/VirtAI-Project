import { useEffect, useState } from 'react'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import AvatarStep from '../ui/AvatarStep'
import DocumentsStep from '../ui/DocumentsStep'
import ReadyStep from '../ui/ReadyStep'

export default function Setup(){
  const navigate = useNavigate()
  const location = useLocation()
  const [state, setState] = useState({ avatar: null, voice: 'Calm Female', tone: 'Friendly', docs: [] })
  const [currentStep, setCurrentStep] = useState(1)

  // Update current step based on route
  useEffect(() => {
    if (location.pathname.includes('/ready')) setCurrentStep(3)
    else if (location.pathname.includes('/documents')) setCurrentStep(2)
    else setCurrentStep(1)
  }, [location.pathname])

  const update = (patch)=> setState(s=>({...s,...patch}))

  // Calculate which steps are completed
  const isStepCompleted = (step) => {
    if (step < currentStep) return true
    if (step === 1 && currentStep > 1) return true
    if (step === 2 && currentStep > 2) return true
    return false
  }

  // Handle step navigation
  const handleStepClick = (step) => {
    if (isStepCompleted(step) || step <= currentStep) {
      if (step === 1) navigate('/setup')
      else if (step === 2) navigate('/setup/documents')
      else if (step === 3) navigate('/setup/ready')
    }
  }

  // Calculate progress percentage
  const progressPercentage = ((currentStep - 1) / 2) * 100

  const steps = [
    { index: 1, label: 'Avatar', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { index: 2, label: 'Documents', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { index: 3, label: 'Ready', emoji: '👍' }
  ]

  return (
    <div className="mx-auto" style={{maxWidth:1100, background: 'linear-gradient(to bottom, #0A0A0A, #0F0F0F)', minHeight: '100vh', paddingTop: '3rem', paddingBottom: '3rem'}}>
      {/* Enhanced Progress Stepper */}
      <div className="mb-12 px-8">
        {/* Stepper Container */}
        <div className="relative">
          {/* Horizontal Progress Line - Behind all circles */}
          <div className="absolute top-8 left-0 right-0 flex items-center" style={{ zIndex: 0 }}>
            <div className="flex-1 flex items-center">
              {/* Line starts from first circle center */}
              <div className="w-8"></div>
              <div className="flex-1 h-1 relative" style={{background: '#2D2D2D'}}>
                {/* Animated progress line */}
                <div
                  className="absolute top-0 left-0 h-1 transition-all duration-700 ease-out"
                  style={{
                    width: `${progressPercentage}%`,
                    background: 'linear-gradient(to right, #D4AF37, #FFD700)',
                    boxShadow: '0 0 10px rgba(212, 175, 55, 0.5)'
                  }}
                ></div>
              </div>
              <div className="w-8"></div>
            </div>
          </div>

          {/* Steps */}
          <div className="relative flex items-start justify-between" style={{ zIndex: 10 }}>
            {steps.map((step, index) => {
              const isCompleted = isStepCompleted(step.index)
              const isCurrent = currentStep === step.index
              const isClickable = isCompleted || isCurrent

              return (
                <div key={step.index} className="flex flex-col items-center relative">
                  {/* Solid background to hide line behind circle */}
                  <div className="absolute top-0 w-20 h-20 rounded-full" style={{background: '#0F0F0F', zIndex: 5}}></div>

                  {/* Step Circle */}
                  <button
                    onClick={() => handleStepClick(step.index)}
                    disabled={!isClickable}
                    className={`
                      relative w-16 h-16 rounded-full flex items-center justify-center font-bold text-lg
                      transition-all duration-500 ease-out transform
                      ${isClickable ? 'cursor-pointer hover:scale-110' : 'cursor-not-allowed opacity-50'}
                    `}
                    style={{
                      zIndex: 10,
                      background: isCompleted
                        ? 'linear-gradient(135deg, #D4AF37, #FFD700)'
                        : isCurrent
                        ? 'linear-gradient(135deg, #D4AF37, #FFD700)'
                        : '#2D2D2D',
                      color: (isCompleted || isCurrent) ? '#FFFFFF' : '#B0B0B0',
                      border: (isCompleted || isCurrent) ? 'none' : '2px solid #3D3D3D',
                      transform: isCurrent ? 'scale(1.1)' : isCompleted ? 'scale(1)' : 'scale(0.9)',
                      boxShadow: (isCompleted || isCurrent) ? '0 10px 40px rgba(212, 175, 55, 0.4)' : 'none'
                    }}
                  >
                    {/* Glow Effect for Current/Completed */}
                    {(isCompleted || isCurrent) && (
                      <div className="absolute inset-0 rounded-full blur-xl animate-pulse" style={{background: 'rgba(212, 175, 55, 0.3)'}}></div>
                    )}

                    {/* Content */}
                    <div className="relative z-10 w-full h-full flex items-center justify-center">
                      {isCompleted ? (
                        // Checkmark for completed steps
                        <svg className="w-8 h-8 animate-scale-in" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : step.emoji ? (
                        // Emoji for Ready step
                        <span className="text-3xl">{step.emoji}</span>
                      ) : (
                        // Icon for current/upcoming steps
                        <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d={step.icon} clipRule="evenodd" />
                        </svg>
                      )}
                    </div>

                    {/* Ring Animation for Current Step */}
                    {isCurrent && (
                      <div className="absolute inset-0 rounded-full animate-ping-slow" style={{border: '4px solid rgba(212, 175, 55, 0.3)'}}></div>
                    )}
                  </button>

                  {/* Step Label */}
                  <div className="mt-4 text-center">
                    <div
                      className="font-semibold text-sm transition-all duration-300"
                      style={{
                        color: isCompleted ? '#D4AF37' : isCurrent ? '#FFD700' : '#B0B0B0'
                      }}
                    >
                      {step.label}
                    </div>
                    {isCompleted && (
                      <div className="text-xs mt-1 animate-fadeIn" style={{color: '#D4AF37'}}>Completed</div>
                    )}
                    {isCurrent && (
                      <div className="text-xs mt-1 animate-fadeIn" style={{color: '#FFD700'}}>In Progress</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Glass Morphism Container for Step Content */}
      <div className="mx-4 mb-8 rounded-3xl overflow-hidden" style={{
        background: 'rgba(45, 45, 45, 0.8)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(212, 175, 55, 0.3)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
      }}>
        <Routes>
          <Route path="/*" element={<AvatarStep state={state} onChange={update} onProceed={()=>navigate('/setup/documents')} />} />
          <Route path="/documents" element={<DocumentsStep state={state} onChange={update} onProceed={()=>navigate('/setup/ready')} onBack={()=>navigate('/setup')} />} />
          <Route path="/ready" element={<ReadyStep state={state} onChange={update} onGotoClass={()=>navigate('/classroom')} onEditSetup={()=>navigate('/setup')} />} />
        </Routes>
      </div>
    </div>
  )
}
