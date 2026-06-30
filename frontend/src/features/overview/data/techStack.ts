import {
  HiOutlineCpuChip,
  HiOutlineCube,
  HiOutlineDocumentMagnifyingGlass,
  HiOutlineGlobeAlt,
  HiOutlinePaintBrush,
  HiOutlineSignal,
  HiOutlineSparkles,
  HiOutlineSpeakerWave,
} from 'react-icons/hi2';

const techStack = [
  { id: 'react', label: 'React 18', icon: HiOutlineGlobeAlt },
  { id: 'vite', label: 'Vite', icon: HiOutlineCpuChip },
  { id: 'threejs', label: 'Three.js', icon: HiOutlineCube },
  { id: 'websocket', label: 'WebSocket', icon: HiOutlineSignal },
  { id: 'tts-asr', label: 'TTS / ASR', icon: HiOutlineSpeakerWave },
  { id: 'rag', label: 'RAG Pipeline', icon: HiOutlineDocumentMagnifyingGlass },
  { id: 'tailwind', label: 'Tailwind CSS', icon: HiOutlinePaintBrush },
  { id: 'motion', label: 'Motion', icon: HiOutlineSparkles },
];

export default techStack;
