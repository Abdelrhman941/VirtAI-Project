import { motion } from 'framer-motion';

const FAQS = [
  {
    question: 'How fast is the voice recognition?',
    answer:
      'Our pipeline is optimized for edge and cloud to deliver sub-200ms Automatic Speech Recognition (ASR). This ensures that conversations with your AI TA feel completely natural and interruptible, just like talking to a human.',
  },
  {
    question: 'Can the AI TA access my course materials?',
    answer:
      'Yes. You can upload PDFs, slides, and syllabus documents to your dedicated vector database. The AI uses Retrieval-Augmented Generation (RAG) to cite your materials directly when answering student questions.',
  },
  {
    question: 'Does it support multiple languages?',
    answer:
      'Currently, our voice models and features exclusively support English. We are continually evaluating additional languages for future updates.',
  },
  {
    question: 'How do you handle student privacy?',
    answer:
      'We are strictly FERPA compliant. Voice streams are processed in memory and immediately discarded. Transcripts are anonymized before being used for any aggregate analytics provided to the educator.',
  },
];

export default function FAQSection() {
  return (
    <section id="faq" className="relative mx-auto max-w-4xl px-6 py-24 md:py-32">
      {/* Background ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 h-80 w-80 rounded-full bg-gold/5 blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-16"
      >
        <h2 className="display-h2 text-offwhite mb-4">
          Frequently Asked <span className="text-gold">Questions</span>
        </h2>
        <p className="text-offwhite/60 text-sm max-w-2xl mx-auto">
          Everything you need to know about integrating VirtAI into your classroom.
        </p>
      </motion.div>

      <div className="flex flex-col gap-4">
        {FAQS.map((faq, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.8 }}
            transition={{ duration: 0.4, delay: idx * 0.1 }}
          >
            <details className="group border-b border-gold/10 pb-4 transition-[background-color,border-color] duration-300 px-3 hover:bg-gold/[0.01] rounded-xl [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-center justify-between gap-4 py-3 text-lg font-medium text-offwhite transition-colors hover:text-gold-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70 focus-visible:ring-offset-2 focus-visible:ring-offset-dark">
                {faq.question}
                <span className="relative ml-1.5 flex h-5 w-5 shrink-0 items-center justify-center text-gold-soft transition-colors group-hover:text-gold">
                  <svg
                    className="absolute inset-0 h-5 w-5 opacity-100 transition-transform transition-opacity duration-300 group-open:rotate-180 group-open:opacity-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <svg
                    className="absolute inset-0 h-5 w-5 rotate-90 opacity-0 transition-transform transition-opacity duration-300 group-open:rotate-180 group-open:opacity-100"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                  </svg>
                </span>
              </summary>
              <div className="mt-2 pr-12 text-sm leading-relaxed text-offwhite/75 animate-in slide-in-from-top-1 fade-in duration-200">
                {faq.answer}
              </div>
            </details>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
