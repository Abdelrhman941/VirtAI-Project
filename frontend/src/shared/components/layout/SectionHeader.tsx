import { motion } from 'framer-motion';

export default function SectionHeader({ titlePrefix = '', titleHighlight = '', description = '', className = '', descriptionClassName = 'mt-5 text-lg leading-relaxed text-offwhite/70' }) {
  const safeTitlePrefix = titlePrefix ?? '';
  const safeTitleHighlight = titleHighlight ?? '';
  const safeDescription = description ?? '';

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6 }}
    >
      <h2
        className="display-h2 text-offwhite"
      >
        {safeTitlePrefix} <span className="text-gold">{safeTitleHighlight}</span>
      </h2>
      <p className={descriptionClassName}>
        {safeDescription}
      </p>
    </motion.div>
  );
}
