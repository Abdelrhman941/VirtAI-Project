import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { FiCheck, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { HiOutlineSparkles, HiOutlineSpeakerWave, HiOutlineUser } from 'react-icons/hi2';
import { Link, useNavigate } from 'react-router-dom';

import { avatarImages } from '@/features/avatar/data/avatars';
import useReducedMotionPreference from '@/features/overview/hooks/useReducedMotionPreference';
import { cn } from '@/shared/utils/cn';
import CircuitBoardBackground from '@/widgets/Overview/CircuitBoardBackground';
import { voices as VOICES, Voice } from '../data/voices';

import { loadSetup } from '../services/setupStorage';
import AllSetTab from './AllSetTab';
import AvatarPreview from './AvatarPreview';
import AvatarTab, { Avatar } from './AvatarTab';
import LaunchOverlay from './LaunchOverlay';
import VoiceTab from './VoiceTab';

const TABS = [
  { key: 'avatar', label: 'Avatar', icon: HiOutlineUser },
  { key: 'voice', label: 'Voice', icon: HiOutlineSpeakerWave },
  { key: 'allset', label: 'All Set', icon: HiOutlineSparkles },
];

export default function SetupPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const shouldReduceMotion = useReducedMotionPreference();
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(() => {
    const saved = loadSetup();
    if (!saved || !saved.avatarId) return null;
    return (Object.values(avatarImages).find((av) => (av as Avatar).id === saved.avatarId) as Avatar) ?? null;
  });
  const [selectedVoice, setSelectedVoice] = useState<Voice | null>(() => {
    const saved = loadSetup();
    if (!saved || !saved.voiceId) return null;
    const voice = VOICES.find((vo) => vo.id === saved.voiceId) ?? null;
    const avatar = saved.avatarId ? Object.values(avatarImages).find((av) => (av as Avatar).id === saved.avatarId) as Avatar : null;
    if (avatar && voice && avatar.gender !== voice.gender) return null;
    return voice;
  });
  const [isMovementEnabled, setIsMovementEnabled] = useState<boolean>(() => {
    const saved = loadSetup();
    if (saved && typeof saved.movementEnabled === 'boolean') {
      return saved.movementEnabled;
    }
    return false;
  });



  const [isPlaying, setIsPlaying] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [direction, setDirection] = useState(1);
  const [isLaunching, setIsLaunching] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsPlaying(false);
    setPlayingVoiceId(null);
  }, []);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => stopAudio();
  }, [stopAudio]);

  // Clear voice selection when avatar gender changes
  const handleAvatarSelect = useCallback(
    (avatar: Avatar) => {
      if (selectedAvatar && avatar.gender !== selectedAvatar.gender) {
        setSelectedVoice(null);
        stopAudio();
      }
      setSelectedAvatar(avatar);
    },
    [selectedAvatar, stopAudio]
  );


  const isTabComplete = useCallback(
    (idx: number) => {
      if (idx === 0) {
        return !!selectedAvatar;
      }
      if (idx === 1) {
        return !!selectedVoice;
      }
      return false;
    },
    [selectedAvatar, selectedVoice]
  );

  const canAdvance = isTabComplete(activeTab);

  const goTo = useCallback(
    (idx: number) => {
      setDirection(idx > activeTab ? 1 : -1);
      setActiveTab(idx);
    },
    [activeTab]
  );

  const handleBack = () => {
    if (activeTab === 0) {
      navigate('/');
    } else {
      goTo(activeTab - 1);
    }
  };

  const handleNext = () => {
    if (activeTab < TABS.length - 1 && canAdvance) {
      goTo(activeTab + 1);
    }
  };

  const playPreview = useCallback((voice: Voice | null) => {
    stopAudio();
    if (!voice?.previewUrl) {
      return;
    }
    const audio = new Audio(voice.previewUrl);
    audioRef.current = audio;
    const currentAudio = audio;

    currentAudio.addEventListener('ended', () => {
      if (audioRef.current === currentAudio) {
        setIsPlaying(false);
        setPlayingVoiceId(null);
      }
    });
    currentAudio.addEventListener('error', () => {
      if (audioRef.current === currentAudio) {
        setIsPlaying(false);
        setPlayingVoiceId(null);
      }
    });

    currentAudio
      .play()
      .then(() => {
        if (audioRef.current === currentAudio) {
          setIsPlaying(true);
          setPlayingVoiceId(voice.id);
        }
      })
      .catch(() => {
        if (audioRef.current === currentAudio) {
          setIsPlaying(false);
          setPlayingVoiceId(null);
        }
      });
  }, [stopAudio]);

  const slideVariants = {
    enter: (d: number) => ({ x: shouldReduceMotion ? 0 : d > 0 ? 60 : -60, opacity: 0 }),
    center: {
      x: 0,
      opacity: 1,
      transition: { duration: shouldReduceMotion ? 0.01 : 0.35, ease: [0.16, 1, 0.3, 1] as const }
    },
    exit: (d: number) => ({
      x: shouldReduceMotion ? 0 : d > 0 ? -60 : 60,
      opacity: 0,
      transition: { duration: shouldReduceMotion ? 0.01 : 0.25, ease: [0.16, 1, 0.3, 1] as const }
    }),
  };

  return (
    <div className="relative w-screen h-[100dvh] p-6 box-border bg-[#121212] flex items-center justify-center overflow-hidden">
      <Helmet>
        <title>Setup — VirtAI</title>
      </Helmet>

      <CircuitBoardBackground />
      <div className="absolute top-[10%] left-[15%] w-[450px] h-[450px] rounded-full bg-[radial-gradient(circle,#9b0827_0%,transparent_70%)] blur-[120px] opacity-[0.07] pointer-events-none z-[1]" />
      <div className="absolute bottom-[10%] right-[15%] w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,#b4ab8b_0%,transparent_70%)] blur-[130px] opacity-[0.05] pointer-events-none z-[1]" />

      <motion.div
        className="relative z-10 w-[min(90vw,1200px)] min-h-[min(85dvh,640px)] h-auto p-4 bg-[#1e1e1e] border border-[#333] rounded-[20px] flex flex-col shadow-[0_8px_12px_rgba(0,0,0,0.35)] max-md:w-full max-md:h-full max-md:rounded-none max-md:border-none max-lg:w-[95%] max-lg:h-[90%]"
        initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0.01 : 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-3 pt-4 px-6 pb-0 shrink-0">
          <span className="font-display text-[16px] font-semibold text-[#b0b0b0] tracking-[0.5px]">
            Step <span className="text-primary">{activeTab + 1}</span> of {TABS.length} — {TABS[activeTab].label}
          </span>
          <div className="flex gap-2.5 items-center justify-center ml-3">
            {TABS.map((_, idx) => (
              <div
                key={idx}
                className={cn(
                  'flex-[0_0_8px] w-2 h-2 min-w-2 min-h-2 aspect-square rounded-full bg-white/15 scale-100 origin-center transition-all duration-300 shrink-0',
                  isTabComplete(idx) ? 'bg-[#b4ab8b] shadow-none' : '',
                  activeTab === idx ? 'bg-[#9b0827] shadow-[0_0_0_4px_rgba(155,8,39,0.18)] scale-[1.35]' : ''
                )}
              />
            ))}
          </div>
        </div>

        {/* Main content split */}
        <div className="flex flex-1 min-h-[480px] max-lg:flex-col">
          {/* LEFT: Tabs + content + nav */}
          <div className="flex-[3] flex flex-col min-w-0">
            {/* Tab bar */}
            <div className="flex gap-0 px-6 border-b border-white/[0.08] relative shrink-0 max-md:overflow-x-auto max-md:px-4 max-md:[webkit-overflow-scrolling:touch]" role="tablist">
              {TABS.map((tab, idx) => {
                const Icon = tab.icon;
                const complete = isTabComplete(idx);
                return (
                  <button
                    key={tab.key}
                    role="tab"
                    aria-selected={activeTab === idx}
                    aria-controls={`panel-${tab.key}`}
                    className={`relative flex items-center gap-2 px-5 py-3.5 text-[15px] font-medium text-[#808080] cursor-pointer bg-transparent border-none transition-colors duration-200 whitespace-nowrap font-sans hover:text-[#b0b0b0] max-md:px-[14px] max-md:py-3 max-md:text-[13px] ${activeTab === idx ? 'text-[#c9c0a0] drop-shadow-[0_0_10px_rgba(201,192,160,0.15)]' : ''}`}
                    onClick={() => goTo(idx)}
                  >
                    {complete ? (
                      <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-primary text-[#1a1a1a] text-[11px] shrink-0 shadow-none">
                        <FiCheck />
                      </span>
                    ) : (
                      <Icon size={16} />
                    )}
                    {tab.label}
                    {activeTab === idx && (
                      <motion.div
                        className="absolute -bottom-px left-0 right-0 h-[2px] bg-gradient-to-r from-[#6d001a] to-[#9b0827] rounded-[1px] shadow-none"
                        layoutId="tab-underline"
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 relative max-md:p-4">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={activeTab}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  style={{ height: '100%' }}
                  role="tabpanel"
                  id={`panel-${TABS[activeTab].key}`}
                >
                  {activeTab === 0 && (
                    <AvatarTab selected={selectedAvatar} onSelect={handleAvatarSelect} />
                  )}
                  {activeTab === 1 && (
                    <VoiceTab
                      selected={selectedVoice}
                      onSelect={setSelectedVoice}
                      avatarGender={selectedAvatar?.gender}
                      onPlay={playPreview}
                      onStop={stopAudio}
                      isPlaying={isPlaying}
                      playingVoiceId={playingVoiceId}
                    />
                  )}
                  {activeTab === 2 && (
                    <AllSetTab
                      avatar={selectedAvatar}
                      voice={selectedVoice}
                      movementEnabled={isMovementEnabled}
                      onLaunch={() => setIsLaunching(true)}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center px-6 py-3 pb-4 shrink-0 border-t border-white/[0.06] max-md:px-4 max-md:pt-2.5 max-md:pb-4">
              {activeTab === 0 ? (
                <Link to="/" className="flex items-center gap-2 font-medium font-sans border border-white/15 cursor-pointer bg-white/[0.06] text-white transition-all duration-200 ease-out px-6 py-2.5 text-[15px] rounded-lg disabled:opacity-35 disabled:cursor-not-allowed hover:not:disabled:bg-white/[0.12] hover:not:disabled:border-white/25 hover:not:disabled:-translate-y-px max-md:px-4 max-md:py-2.5 max-md:text-[13px]">
                  <FiChevronLeft size={16} />
                  Overview
                </Link>
              ) : (
                <button className="flex items-center gap-2 font-medium font-sans border border-white/15 cursor-pointer bg-white/[0.06] text-white transition-all duration-200 ease-out px-6 py-2.5 text-[15px] rounded-lg disabled:opacity-35 disabled:cursor-not-allowed hover:not:disabled:bg-white/[0.12] hover:not:disabled:border-white/25 hover:not:disabled:-translate-y-px max-md:px-4 max-md:py-2.5 max-md:text-[13px]" onClick={handleBack}>
                  <FiChevronLeft size={16} />
                  Back
                </button>
              )}

              {activeTab < TABS.length - 1 && (
                <button
                  className="flex items-center gap-2 font-medium font-sans border cursor-pointer text-white transition-all duration-200 ease-out px-6 py-2.5 text-[15px] rounded-lg disabled:opacity-35 disabled:cursor-not-allowed hover:not:disabled:-translate-y-px max-md:px-4 max-md:py-2.5 max-md:text-[13px] bg-gradient-to-br from-[#6d001a] to-[#9b0827] border-[#9b0827]/40 shadow-none hover:not:disabled:from-[#8a0022] hover:not:disabled:to-[#b50b2f] hover:not:disabled:border-[#b50b2f]/50"
                  onClick={handleNext}
                  disabled={!canAdvance}
                >
                  {activeTab === 0 ? 'Configure Voice' : 'Finalize Setup'}
                  <FiChevronRight size={16} />
                </button>
              )}
            </div>
          </div>

          {/* RIGHT: Avatar preview */}
          <div className="flex-1 min-w-[240px] max-w-[280px] bg-white/[0.04] border-l border-white/[0.08] flex flex-col max-lg:max-w-none max-lg:min-w-0 max-lg:border-l-0 max-lg:border-t max-lg:border-white/[0.08] max-lg:px-5 max-lg:py-3 max-lg:max-h-[100px] max-lg:overflow-visible max-md:fixed max-md:top-3 max-md:right-3 max-md:z-50 max-md:w-16 max-md:h-16 max-md:rounded-full max-md:bg-[#1e1e1e] max-md:border max-md:border-[#333] max-md:p-0.5 max-md:max-h-none max-md:justify-center max-md:overflow-hidden">
            <AvatarPreview
              avatar={selectedAvatar}
              voice={selectedVoice}
              isPlaying={isPlaying && selectedVoice?.id === playingVoiceId}
              onPlayPreview={() => playPreview(selectedVoice)}
              onStopPreview={stopAudio}
              movementEnabled={isMovementEnabled}
              onMovementToggle={setIsMovementEnabled}
            />
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {isLaunching && (
          <LaunchOverlay
            avatar={selectedAvatar}
            onComplete={() => navigate('/classroom', { replace: true })}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
