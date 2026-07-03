import { create } from 'zustand';

export interface LipSyncParams {
  headBobFrequency: number;
  headBobAmplitude: number;
  fallbackDamping: number;
  blinkDuration: number;
  blinkBaseDelay: number;
  blinkRandomVariance: number;
  browThinking: number;
  frownThinking: number;
  smileSpeaking: number;
  defaultDampSpeed: number;
  visemeSSMultiplier: number;
  visemeAAMultiplier: number;
  visemeOMultiplier: number;
  jawOpenMultiplier: number;
  consonantSpeedMultiplier: number;
  vowelSpeedMultiplier: number;
  fftSpeedMultiplier: number;
  jawDampSpeed: number;
  vowelDampSpeed: number;
  consonantDampSpeed: number;
  microIdleAmplitude: number;
  coarticulationBlend: number;
  jawSensitivity: number;
  formantSensitivity: number;
  isPlaygroundActive: boolean;
}

export const defaultLipSyncParams: LipSyncParams = {
  headBobFrequency: 2,
  headBobAmplitude: 0.05,
  fallbackDamping: 5,
  blinkDuration: 0.15,
  blinkBaseDelay: 2.5,
  blinkRandomVariance: 3.5,
  browThinking: 0.6,
  frownThinking: 0.3,
  smileSpeaking: 0.2,
  defaultDampSpeed: 12,
  visemeSSMultiplier: 0.6,
  visemeAAMultiplier: 0.4,
  visemeOMultiplier: 0.5,
  jawOpenMultiplier: 0.05,
  consonantSpeedMultiplier: 2.0,
  vowelSpeedMultiplier: 1.5,
  fftSpeedMultiplier: 1.0,
  jawDampSpeed: 8,
  vowelDampSpeed: 7,
  consonantDampSpeed: 15,
  microIdleAmplitude: 0.008,
  coarticulationBlend: 0.5,
  jawSensitivity: 0.5,
  formantSensitivity: 0.7,
  isPlaygroundActive: false,
};

export const presets: Record<string, Partial<LipSyncParams>> = {
  Default: {},
  Natural: {
    blinkBaseDelay: 3.0,
    blinkRandomVariance: 2.0,
    headBobFrequency: 1.5,
    headBobAmplitude: 0.03,
    smileSpeaking: 0.3,
    defaultDampSpeed: 10,
    jawDampSpeed: 7,
    vowelDampSpeed: 6,
    consonantDampSpeed: 12,
    microIdleAmplitude: 0.02,
    coarticulationBlend: 0.4,
  },
  Expressive: {
    blinkBaseDelay: 1.5,
    blinkRandomVariance: 4.0,
    headBobFrequency: 3,
    headBobAmplitude: 0.08,
    smileSpeaking: 0.6,
    browThinking: 0.8,
    frownThinking: 0.5,
    defaultDampSpeed: 15,
    jawDampSpeed: 10,
    vowelDampSpeed: 9,
    consonantDampSpeed: 18,
    microIdleAmplitude: 0.025,
    coarticulationBlend: 0.2,
    jawSensitivity: 0.85,
    formantSensitivity: 1.4,
  },
  Calm: {
    blinkBaseDelay: 4.0,
    blinkRandomVariance: 1.0,
    headBobFrequency: 1.0,
    headBobAmplitude: 0.02,
    smileSpeaking: 0.1,
    browThinking: 0.3,
    frownThinking: 0.1,
    defaultDampSpeed: 8,
    jawDampSpeed: 6,
    vowelDampSpeed: 5,
    consonantDampSpeed: 10,
    microIdleAmplitude: 0.01,
    coarticulationBlend: 0.5,
    jawSensitivity: 0.5,
    formantSensitivity: 1.0,
  },
  Robot: {
    blinkBaseDelay: 2.0,
    blinkRandomVariance: 0.0,
    headBobFrequency: 0,
    headBobAmplitude: 0,
    smileSpeaking: 0,
    browThinking: 0,
    frownThinking: 0,
    defaultDampSpeed: 20,
    consonantSpeedMultiplier: 4.0,
    vowelSpeedMultiplier: 4.0,
    jawDampSpeed: 20,
    vowelDampSpeed: 20,
    consonantDampSpeed: 20,
    microIdleAmplitude: 0.0,
    coarticulationBlend: 0.0,
    jawSensitivity: 0.9,
    formantSensitivity: 1.5,
  },
};

interface LipSyncConfigStore {
  params: LipSyncParams;
  updateParam: (key: keyof LipSyncParams, value: number | boolean) => void;
  resetParams: () => void;
  setPlaygroundActive: (active: boolean) => void;
  loadPreset: (presetName: string) => void;
}

export const useLipSyncConfigStore = create<LipSyncConfigStore>((set) => ({
  params: defaultLipSyncParams,
  updateParam: (key, value) =>
    set((state) => ({ params: { ...state.params, [key]: value } })),
  resetParams: () => set({ params: defaultLipSyncParams }),
  setPlaygroundActive: (active) =>
    set((state) => ({ params: { ...state.params, isPlaygroundActive: active } })),
  loadPreset: (presetName) =>
    set((state) => {
      const presetValues = presets[presetName] || {};
      return {
        params: {
          ...defaultLipSyncParams,
          ...presetValues,
          isPlaygroundActive: state.params.isPlaygroundActive,
        },
      };
    }),
}));
