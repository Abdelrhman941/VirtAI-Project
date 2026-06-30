import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import useReducedMotionPreference from '@/features/overview/hooks/useReducedMotionPreference';

export default function HeroSection({ ctaLabel, ctaTo }) {
  const shouldReduceMotion = useReducedMotionPreference();

  // Choreographed stagger parent variants
  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.08,
      },
    },
  };

  // Eased sliding items (using easeOutExpo curve for modern feel)
  const itemVariants = {
    hidden: { 
      opacity: 0, 
      y: shouldReduceMotion ? 0 : 15 
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0.01 : 0.6,
        ease: [0.16, 1, 0.3, 1] as const, // easeOutExpo
      },
    },
  };

  // Right-side image zoom/fade entrance
  const imageVariants = {
    hidden: { 
      opacity: 0, 
      scale: shouldReduceMotion ? 1 : 0.96 
    },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: shouldReduceMotion ? 0.01 : 0.8,
        ease: [0.16, 1, 0.3, 1] as const, // easeOutExpo
        delay: shouldReduceMotion ? 0 : 0.25,
      },
    },
  };

  return (
    <section className="relative flex min-h-[88vh] items-center px-6 py-24 sm:px-10 lg:px-16 lg:py-32">
      {/* Background radial ambient glow */}
      <div className="absolute top-1/4 right-10 -z-10 h-96 w-96 rounded-full bg-crimson/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-10 -z-10 h-96 w-96 rounded-full bg-gold/5 blur-[120px] pointer-events-none" />

      <motion.div 
        className="mx-auto grid w-full max-w-7xl gap-14 lg:grid-cols-12 lg:items-center"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="lg:col-span-7 flex flex-col items-center text-center md:items-start md:text-left">
          <motion.div 
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/5 px-4 py-1.5 text-xs font-semibold text-gold-soft"
            variants={itemVariants}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse" />
            Trusted AI infrastructure for education
          </motion.div>

          <motion.h1
            className="max-w-[28ch] display-h1 text-offwhite"
            variants={itemVariants}
          >
            The <span className="text-gold">AI Teaching Assistant</span> Built for Academic <span className="text-crimson-soft">Rigor</span>.
          </motion.h1>

          <motion.p 
            className="mt-7 max-w-xl text-base leading-relaxed text-offwhite/80"
            variants={itemVariants}
          >
            Deliver personalized guidance, instant answers, and continuous academic support through
            real-time voice interaction, curriculum-aware reasoning, and lifelike AI avatars.
          </motion.p>

          <motion.div 
            className="mt-10 flex flex-wrap justify-center md:justify-start items-center gap-4"
            variants={itemVariants}
          >
            <Link
              to={ctaTo}
              className="inline-flex cursor-pointer items-center justify-center rounded-full bg-gold px-7 py-3 text-sm font-semibold tracking-wide text-dark transition-[background-color,transform,box-shadow] duration-200 hover:bg-gold-soft hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70 focus-visible:ring-offset-2 focus-visible:ring-offset-dark font-display"
            >
              {ctaLabel}
            </Link>
            <a
              href="#demo"
              className="inline-flex items-center justify-center rounded-full border border-offwhite/20 px-7 py-3 text-sm font-semibold tracking-wide text-offwhite transition-colors duration-200 hover:border-gold/30 hover:text-gold-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-dark"
            >
              View platform
            </a>
          </motion.div>

          <motion.ul 
            className="mt-8 flex flex-wrap justify-center md:justify-start gap-x-6 gap-y-3 text-sm text-offwhite/65"
            variants={itemVariants}
          >
            <li className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-gold/85" />
              Privacy-first
            </li>
            <li className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-gold/85" />
              Low-latency voice
            </li>
            <li className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-gold/85" />
              Classroom-ready architecture
            </li>
          </motion.ul>
        </div>

        <motion.div className="lg:col-span-5" variants={imageVariants}>
          <figure className="overflow-hidden rounded-2xl border border-gold/15 bg-dark/40 relative aspect-video group">
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-tr from-crimson/20 to-gold/20 opacity-0 blur transition duration-500 group-hover:opacity-100" />
            <img
              src="/assets/images/image.webp"
              alt="VirtAI platform classroom preview"
              className="relative block w-full h-full object-cover"
              width={896}
              height={504}
            />
          </figure>
        </motion.div>
      </motion.div>
    </section>
  );
}
