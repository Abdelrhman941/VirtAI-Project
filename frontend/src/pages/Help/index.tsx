import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FeatureCard, Feature } from './FeatureCard';
import { FiChevronLeft, FiChevronRight, FiArrowLeft } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import useReducedMotionPreference from '@/features/overview/hooks/useReducedMotionPreference';
import styles from './Help.module.css';

const features: Feature[] = [
  { id: 'chat', title: 'Chat with your tutor', videoSrc: '/help/chat.mp4', desc: 'Realtime voice and text chat with VirtAI.' },
  { id: 'explain', title: 'Presentation Mode', videoSrc: '/help/explain.mp4', desc: 'Slide-by-slide explanation of your document.' },
  { id: 'diagram', title: 'Generate Diagrams', videoSrc: '/help/diagram.mp4', desc: 'Generate mermaid diagrams from your context.' },
  { id: 'quiz', title: 'Take a Quiz', videoSrc: '/help/quiz.mp4', desc: 'Test your knowledge with auto-generated quizzes.' },
  { id: 'visualize', title: 'Visualize answers', videoSrc: '/help/visualize.mp4', desc: 'Generate images and visualizations inline.' },
  { id: 'setup', title: 'Avatar & System Setup', videoSrc: '/help/setup.mp4', desc: 'Configure your avatar and system preferences.' },
];

export default function HelpPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const shouldReduceMotion = useReducedMotionPreference();

  const handleNext = () => {
    setDirection(1);
    setCurrentStep((prev) => Math.min(prev + 1, features.length - 1));
  };

  const handlePrev = () => {
    setDirection(-1);
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const slideVariants = {
    enter: (d) => ({
      x: shouldReduceMotion ? 0 : d > 0 ? 50 : -50,
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        duration: shouldReduceMotion ? 0.01 : 0.35,
        ease: [0.16, 1, 0.3, 1] as const, // easeOutExpo
      }
    },
    exit: (d) => ({
      x: shouldReduceMotion ? 0 : d > 0 ? -50 : 50,
      opacity: 0,
      transition: {
        duration: shouldReduceMotion ? 0.01 : 0.25,
        ease: [0.16, 1, 0.3, 1] as const, // easeOutExpo
      }
    })
  };

  return (
    <div className="classroom-shell w-full h-full flex bg-dark relative">
      
      <div className="relative flex-1 flex">
        
        <button 
          className={styles.backBtn}
          onClick={() => navigate('/classroom')}
          aria-label="Back to classroom"
        >
          <FiArrowLeft /> Back to classroom
        </button>

        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 overflow-y-auto">
          <div className={styles.helpContainer}>
            <div className={styles.helpHeader}>
              <h1 className={`${styles.helpTitle} font-display`}>
                <span className="text-gold">Features</span> Tour
              </h1>
              <p className={styles.helpTagline}>Discover what you can do with VirtAI</p>
            </div>
            
            <div className={styles.contentRow}>
              <div className="flex-1 overflow-hidden min-h-[460px] flex items-center">
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={currentStep}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className={styles.featureCardWrapper}
                  >
                    <FeatureCard feature={features[currentStep]} />
                  </motion.div>
                </AnimatePresence>
              </div>
              
              <div className={styles.navControls}>
                <button 
                  className={styles.navBtn} 
                  onClick={handlePrev} 
                  disabled={currentStep === 0}
                  aria-label="Previous feature"
                >
                  <FiChevronLeft />
                </button>
                <button 
                  className={styles.navBtn} 
                  onClick={handleNext} 
                  disabled={currentStep === features.length - 1}
                  aria-label="Next feature"
                >
                  <FiChevronRight />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
