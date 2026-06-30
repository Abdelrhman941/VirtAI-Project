const howItWorks = [
  {
    step: 1,
    label: 'Voice Input',
    description: 'The student speaks naturally through the browser microphone.',
    input: 'Mic stream detected',
    processing: 'Capturing waveform and voice activity',
    output: 'Audio packet: "Can you explain Newton’s second law?"',
  },
  {
    step: 2,
    label: 'ASR',
    description: 'Automatic Speech Recognition converts spoken audio into text in real time.',
    input: 'Audio packet from microphone',
    processing: 'Decoding phonemes into words',
    output: 'Transcript: "Explain Newton second law"',
  },
  {
    step: 3,
    label: 'RAG',
    description: 'Retrieval-Augmented Generation fetches relevant course material for context.',
    input: 'Transcript query',
    processing: 'Searching indexed lecture and textbook chunks',
    output: 'Context injected: "F = m × a, Week 2 lecture notes"',
  },
  {
    step: 4,
    label: 'LLM',
    description: 'A large language model generates an accurate, context-aware answer.',
    input: 'Question + retrieved context',
    processing: 'Generating answer tokens with reasoning context',
    output: 'Response draft ready for speech',
  },
  {
    step: 5,
    label: 'TTS',
    description: 'Text-to-Speech synthesises the response into natural-sounding audio.',
    input: 'Generated response text',
    processing: 'Synthesising neural speech waveform',
    output: 'Audio stream with prosody',
  },
  {
    step: 6,
    label: 'Avatar',
    description: 'A lip-synced 3D avatar delivers the answer with matching visemes.',
    input: 'Audio stream + viseme timeline',
    processing: 'Driving facial blendshapes and timing',
    output: 'Avatar speaks the final answer',
  },
];

export default howItWorks;
