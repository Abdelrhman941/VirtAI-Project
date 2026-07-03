import LottieLib from 'lottie-react';
const Lottie = (LottieLib as unknown as { default?: typeof LottieLib }).default ?? LottieLib;
import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';

const ANIMATION_URL = '/assets/lottie/error.json';

export default function NotFound() {
  const navigate = useNavigate();
  const [animationData, setAnimationData] = useState(null);

  useEffect(() => {
    fetch(ANIMATION_URL)
      .then((res) => res.json())
      .then(setAnimationData)
      .catch(() => {}); // silently ignore — animation is decorative
  }, []);


  return (
    <>
      <Helmet>
        <title>404 – Page Not Found | VirtAI</title>
      </Helmet>

      <div className="fixed inset-0 flex items-center justify-center bg-[#0A0908] text-foreground z-[9999] overflow-hidden">
        <div className="absolute -top-[10%] -left-[10%] w-[600px] h-[600px] bg-[radial-gradient(circle,#6d001a_0%,transparent_70%)] blur-[150px] opacity-[0.12] pointer-events-none z-0" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[600px] h-[600px] bg-[radial-gradient(circle,#b4ab8b_0%,transparent_70%)] blur-[150px] opacity-[0.08] pointer-events-none z-0" />
        
        <div className="relative z-10 flex flex-col items-center text-center p-8 max-w-[520px] w-full animate-in fade-in slide-in-from-bottom-6 duration-700">
          <div className="w-[min(360px,80vw)] mb-6">
            {animationData && <Lottie animationData={animationData} loop autoplay />}
          </div>

          <p className="font-display text-[clamp(2rem,5vw,2.5rem)] font-bold tracking-tight text-balance mt-1 mb-3 text-foreground">Resource Not Found</p>
          <p className="text-[1.1rem] text-[#b0b0b0] mb-10 leading-[1.6] max-w-[45ch] text-pretty">
            The academic resource or route you requested could not be resolved. It may have been relocated or your session may have expired.
          </p>

          <div className="flex gap-4 flex-wrap justify-center">
            <button 
              className="px-8 py-3 border-none rounded-lg text-base font-semibold cursor-pointer transition-all duration-200 ease-out bg-gradient-to-br from-primary to-[#C9C0A0] text-[#0A0908] shadow-[0_4px_14px_rgba(180,171,139,0.18)] hover:from-[#C9C0A0] hover:to-primary hover:shadow-[0_6px_20px_rgba(180,171,139,0.3)] hover:-translate-y-0.5 active:translate-y-0" 
              onClick={() => navigate('/')}
            >
              Return to Dashboard
            </button>
            <button 
              className="px-8 py-3 rounded-lg text-base font-semibold cursor-pointer transition-all duration-200 ease-out bg-transparent text-[#C9C0A0] border border-primary/30 hover:bg-primary/10 hover:border-[#C9C0A0] hover:shadow-[0_0_12px_rgba(180,171,139,0.15)] hover:-translate-y-0.5 active:translate-y-0" 
              onClick={() => navigate(-1)}
            >
              Return to Previous Page
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
