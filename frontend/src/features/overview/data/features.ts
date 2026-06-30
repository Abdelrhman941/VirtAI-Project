import {
  HiOutlineAcademicCap,
  HiOutlineBolt,
  HiOutlineDocumentText,
  HiOutlineMicrophone,
  HiOutlineUser,
} from 'react-icons/hi2';

const features = [
  {
    id: 'streaming',
    icon: HiOutlineBolt,
    title: 'Real-time Streaming Chat',
    description:
      'WebSocket-powered token-by-token streaming so you see the AI think in real time — no waiting for a full response.',
  },
  {
    id: 'rag',
    icon: HiOutlineDocumentText,
    title: 'RAG from Your Documents',
    description:
      'Upload PDFs and get NotebookLM-style retrieval-augmented answers grounded in your own materials.',
  },
  {
    id: 'voice',
    icon: HiOutlineMicrophone,
    title: 'Voice-First Experience',
    description:
      'Full-duplex ASR + TTS speech loop — talk naturally and hear the AI respond with human-like voice.',
  },
  {
    id: 'avatar',
    icon: HiOutlineUser,
    title: 'Synchronized Avatar States',
    description:
      'A clear avatar state machine keeps Greeting, Listening, Thinking, Talking, and Reacting in sync with every response.',
  },
  {
    id: 'learning',
    icon: HiOutlineAcademicCap,
    title: 'Learning-Centric UX',
    description:
      'Step-by-step breakdowns and focus mode designed to help you actually learn, not just get answers.',
  },
];

export default features;
