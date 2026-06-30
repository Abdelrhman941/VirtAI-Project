/**
 * Voice configurations for the Setup page.
 * Each maps to a real Microsoft Edge TTS voice ID.
 */
export interface Voice {
  id: string;
  name: string;
  shortName: string;
  desc: string;
  gender: string;
  greeting: string;
  previewUrl: string;
}

export const voices: readonly Voice[] = Object.freeze(([
  {
    id: 'aria',
    name: 'Aria',
    shortName: 'Aria',
    desc: 'Warm & Professional',
    gender: 'female',
    greeting: "Hello! I'm Dr. Mariam — ready to help you learn something amazing today.",
    previewUrl: '/audio/previews/aria.mp3',
  },
  {
    id: 'jenny',
    name: 'Jenny',
    shortName: 'Jenny',
    desc: 'Friendly & Energetic',
    gender: 'female',
    greeting: "Hey there! I'm Dr. Mariam — let's make learning fun and easy together!",
    previewUrl: '/audio/previews/jenny.mp3',
  },
  {
    id: 'sonia',
    name: 'Sonia',
    shortName: 'Sonia',
    desc: 'Elegant & Articulate',
    gender: 'female',
    greeting:
      "Good day! I'm Dr. Mariam — it would be my pleasure to guide you through your studies.",
    previewUrl: '/audio/previews/sonia.mp3',
  },
  {
    id: 'guy',
    name: 'Guy',
    shortName: 'Guy',
    desc: 'Deep & Calm',
    gender: 'male',
    greeting: "Welcome! Let's take this one step at a time, nice and easy.",
    previewUrl: '/audio/previews/guy.mp3',
  },
  {
    id: 'christopher',
    name: 'Christopher',
    shortName: 'Chris',
    desc: 'Clear & Authoritative',
    gender: 'male',
    greeting: "Good day! I'm here as your dedicated tutor for every question you have.",
    previewUrl: '/audio/previews/christopher.mp3',
  },
  {
    id: 'ryan',
    name: 'Ryan',
    shortName: 'Ryan',
    desc: 'Confident & Engaging',
    gender: 'male',
    greeting: "Hey there! Let's dive in and explore something new together!",
    previewUrl: '/audio/previews/ryan.mp3',
  },
] as Voice[]).map((v) => Object.freeze(v) as Voice));

export const getVoiceById = (id: string) => voices.find((v: Voice) => v.id === id) ?? null;

export const getVoicesByGender = (gender: string) => voices.filter((v: Voice) => v.gender === gender);
