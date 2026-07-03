import { AnimatePresence, motion } from 'framer-motion';
import { FiCheck } from 'react-icons/fi';

export default function SelectionCheckmark({ isSelected = false, className = '', size = 12 }) {
  return (
    <AnimatePresence>
      {isSelected && (
        <motion.span
          className={className}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          transition={{ type: 'tween', ease: [0.2, 0.8, 0.2, 1], duration: 0.2 }}
        >
          <FiCheck size={size} />
        </motion.span>
      )}
    </AnimatePresence>
  );
}
