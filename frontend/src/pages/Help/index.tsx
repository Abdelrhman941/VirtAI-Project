import { Button } from '@/shared/components/ui/button';
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/shared/components/ui/carousel';
import Autoplay from 'embla-carousel-autoplay';
import { useEffect, useMemo, useState } from 'react';
import { FiArrowLeft } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { Feature, FeatureCard } from './FeatureCard';

const features: Feature[] = [
  {
    id: 'chat',
    title: 'Chat with your tutor',
    videoSrc: '/help/chat.mp4',
    desc: 'Realtime voice and text chat with VirtAI.',
  },
  {
    id: 'explain',
    title: 'Presentation Mode',
    videoSrc: '/help/explain.mp4',
    desc: 'Slide-by-slide explanation of your document.',
  },
  {
    id: 'diagram',
    title: 'Generate Tree-Map',
    videoSrc: '/help/diagram.mp4',
    desc: 'Generate treemap diagram from your context.',
  },
  {
    id: 'quiz',
    title: 'Take a Quiz',
    videoSrc: '/help/quiz.mp4',
    desc: 'Test your knowledge with auto-generated quizzes.',
  },
  {
    id: 'visualize',
    title: 'Visualize answers',
    videoSrc: '/help/visualize.mp4',
    desc: 'Generate images and visualizations inline.',
  },
  {
    id: 'setup',
    title: 'Avatar & System Setup',
    videoSrc: '/help/setup.mp4',
    desc: 'Configure your avatar and system preferences.',
  },
];

export default function HelpPage() {
  const navigate = useNavigate();
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const dir =
    typeof document !== 'undefined' && document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr';

  useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    api.on('select', () => setCurrent(api.selectedScrollSnap()));
  }, [api]);

  const autoplayPlugin = useMemo(() => {
    return Autoplay({ delay: 5500, stopOnInteraction: true, stopOnMouseEnter: true });
  }, []);

  return (
    <div className="w-full h-full overflow-y-auto bg-dark flex flex-col justify-center">
      <section className="mx-auto w-full max-w-6xl px-6 py-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/classroom')}
          className="mb-6 gap-2 text-muted-foreground hover:text-white"
        >
          <FiArrowLeft className="rtl:rotate-180" /> Back to classroom
        </Button>

        <header className="mb-8 flex items-baseline justify-between border-b border-white/10 pb-4">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-white">
            <span className="text-primary">Features</span> Tour
          </h1>
          <span className="text-sm text-muted-foreground">
            {current + 1} / {features.length}
          </span>
        </header>

        <Carousel
          setApi={setApi}
          dir={dir}
          opts={{ align: 'start', loop: true, direction: dir }}
          plugins={[autoplayPlugin]}
          className="w-full"
        >
          <CarouselContent className="-ms-4">
            {features.map((f) => (
              <CarouselItem key={f.id} className="ps-4">
                <FeatureCard feature={f} />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden md:flex border-white/15 bg-white/[0.02] text-white hover:bg-white/10" />
          <CarouselNext className="hidden md:flex border-white/15 bg-white/[0.02] text-white hover:bg-white/10" />
        </Carousel>
      </section>
    </div>
  );
}
