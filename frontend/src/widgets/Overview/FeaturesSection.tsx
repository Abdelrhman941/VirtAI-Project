import features from '@/features/overview/data/features';
import { motion } from 'framer-motion';
import SectionHeader from '@/shared/components/SectionHeader';

export default function FeaturesSection() {
  return (
    <section id="features" className="relative mx-auto max-w-6xl px-6 py-24 md:py-32">
      <SectionHeader
        className="mb-20 max-w-2xl"
        titlePrefix="Core"
        titleHighlight="Features"
        description="Everything you need for an immersive AI-powered learning experience, engineered for reliability."
      />

      <div className="flex flex-col divide-y divide-gold/10 border-t border-b border-gold/15">
        {features.map((f, i) => {
          const Icon = f.icon;
          return (
            <motion.div
              key={f.id}
              className="group relative flex flex-col items-start gap-5 px-4 -mx-4 py-10 md:flex-row md:items-center md:gap-12 lg:py-12 rounded-xl border border-transparent transition-[background-color,border-color] duration-300 hover:bg-gold/[0.02] hover:border-gold/10"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-crimson/10 text-crimson-soft border border-crimson/20 transition-[transform,background-color,color,border-color] duration-300 group-hover:scale-110 group-hover:bg-crimson/20 group-hover:text-crimson-glow animate-pulse-slow">
                <Icon className="h-6 w-6" />
              </div>
              <div className="flex-1 md:pr-8 lg:pr-12">
                <h3 className="display-h3 text-offwhite group-hover:text-gold transition-colors duration-200">{f.title}</h3>
              </div>
              <div className="flex-1">
                <p className="text-base leading-relaxed text-offwhite/60 transition-colors duration-200 group-hover:text-offwhite/80">{f.description}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
