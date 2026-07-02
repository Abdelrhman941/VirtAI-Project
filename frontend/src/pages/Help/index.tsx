import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FeatureCard, Feature } from './FeatureCard';
import { FiArrowLeft } from 'react-icons/fi';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/shared/components/ui/carousel';
import Autoplay from 'embla-carousel-autoplay';
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

  const autoplayPlugin = React.useMemo(() => {
    return Autoplay({
      delay: 5000,
      stopOnInteraction: true,
      stopOnMouseEnter: true,
    });
  }, []);

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
            
            <Carousel
              plugins={[autoplayPlugin]}
              opts={{
                loop: true,
              }}
              className="w-full"
            >
              <div className={styles.contentRow}>
                <div className="flex-1 overflow-hidden min-h-[460px] flex items-center">
                  <CarouselContent className="w-full">
                    {features.map((feature) => (
                      <CarouselItem key={feature.id} className="w-full select-none">
                        <div className={styles.featureCardWrapper}>
                          <FeatureCard feature={feature} />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                </div>
                
                <div className={styles.navControls}>
                  <CarouselPrevious
                    className="static translate-y-0 w-12 h-12 rounded-full border-gold text-gold-soft hover:bg-gold/10 hover:text-white"
                  />
                  <CarouselNext
                    className="static translate-y-0 w-12 h-12 rounded-full border-gold text-gold-soft hover:bg-gold/10 hover:text-white"
                  />
                </div>
              </div>
            </Carousel>
          </div>
        </div>
      </div>
    </div>
  );
}
