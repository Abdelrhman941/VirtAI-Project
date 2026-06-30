import techStack from '@/features/overview/data/techStack';
import { motion } from 'framer-motion';

export default function TechStackSection() {
  return (
    <section id="tech-stack" className="relative mx-auto max-w-5xl px-6 py-24 md:py-32">
      <motion.h2
        className="mb-14 text-center display-h2 text-offwhite"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.6 }}
      >
        Tech <span className="text-gold">Stack</span>
      </motion.h2>

      <div className="mt-12 flex flex-wrap items-center justify-center gap-x-10 gap-y-12">
        {techStack.map((t, i) => {
          const Icon = t.icon;
          return (
            <motion.div
              key={t.id}
              className="group flex items-center gap-3 opacity-60 transition-opacity transition-transform duration-300 hover:opacity-100 hover:scale-105"
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 0.6, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
            >
              <Icon className="h-7 w-7 text-gold drop-shadow-sm" />
              <span className="text-base font-semibold tracking-wide text-offwhite">{t.label}</span>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
