import React from 'react';
import { PiList, PiUserCircleFill } from 'react-icons/pi';
import { FiHelpCircle } from 'react-icons/fi';
import { useNavigate, useLocation } from 'react-router-dom';

interface ClassroomLeftRailProps {
  className?: string;
}

export function ClassroomLeftRail({ className }: ClassroomLeftRailProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleSessionsClick = () => {
    if (location.pathname.startsWith('/classroom') || location.pathname === '/') {
      window.dispatchEvent(new CustomEvent('open-sessions'));
    } else {
      navigate('/classroom');
    }
  };

  const isClassroomActive = location.pathname.startsWith('/classroom');
  const isSetupActive = location.pathname.startsWith('/setup');
  const isHelpActive = location.pathname.startsWith('/help');

  return (
    <nav className={`hidden lg:flex w-16 min-w-[4rem] max-w-[4rem] flex-shrink-0 sticky top-0 h-screen flex-col items-center gap-6 pt-6 pb-6 bg-dark border-r border-gold/15 z-[100] ${className || ''}`}>
      <button 
        className={`p-3 flex items-center justify-center rounded-xl transition-[background-color,color,transform] duration-300 ${isClassroomActive ? 'bg-gold/10 text-gold' : 'bg-transparent text-white/50 hover:bg-gold/5 hover:text-gold-soft'}`}
        onClick={handleSessionsClick}
        aria-label="Open sessions drawer"
        title="Chats"
      >
        <PiList size={28} />
      </button>

      <button 
        className={`p-3 flex items-center justify-center rounded-xl transition-[background-color,color,transform] duration-300 ${isSetupActive ? 'bg-gold/10 text-gold' : 'bg-transparent text-white/50 hover:bg-gold/5 hover:text-gold-soft'}`}
        onClick={() => navigate('/setup')}
        aria-label="Go to setup"
        title="Setup Profile"
      >
        <PiUserCircleFill size={30} />
      </button>

      <button
        className={`p-3 flex items-center justify-center rounded-xl transition-[background-color,color,transform] duration-300 mt-auto ${isHelpActive ? 'bg-gold/10 text-gold' : 'bg-transparent text-white/50 hover:bg-gold/5 hover:text-gold-soft'}`}
        onClick={() => navigate('/help')}
        aria-label="Feature Tour"
        title="Help & Tour"
      >
        <FiHelpCircle size={26} />
      </button>
    </nav>
  );
}
