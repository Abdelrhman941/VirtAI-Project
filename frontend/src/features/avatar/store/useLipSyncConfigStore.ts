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
  visemeSSMultiplier: 1.5,
  visemeAAMultiplier: 1.5,
  visemeOMultiplier: 1.5,
  jawOpenMultiplier: 0.1,
  consonantSpeedMultiplier: 2.5,
  vowelSpeedMultiplier: 2.0,
  fftSpeedMultiplier: 1.5,
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
