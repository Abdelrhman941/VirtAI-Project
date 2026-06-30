import { useState, useCallback } from 'react';
import { loadSetup } from '@/features/setup';
import { getAvatarById } from '@/features/avatar/data/avatars';

export interface SetupConfig {
  avatarId?: string;
  voiceId?: string;
  movementEnabled?: boolean;
  avatarName?: string;
  [key: string]: unknown;
}

const SETUP_STORAGE_KEYS = ['virtai-setup', 'virtai:setup', 'setupConfig', 'setup'];

function normalizeSetupConfig(rawConfig: SetupConfig | unknown): SetupConfig {
  if (!rawConfig || typeof rawConfig !== 'object') {
    return {};
  }
  const typedConfig = rawConfig as Record<string, unknown>;
  return {
    ...(typeof typedConfig.avatarId === 'string' && { avatarId: typedConfig.avatarId }),
    ...(typeof typedConfig.voiceId === 'string' && { voiceId: typedConfig.voiceId }),
    ...(typeof typedConfig.movementEnabled === 'boolean' && {
      movementEnabled: typedConfig.movementEnabled,
    }),
    ...(typeof typedConfig.avatarName === 'string' && { avatarName: typedConfig.avatarName }),
  };
}

function hasSetupSelection(config: SetupConfig) {
  return !!config.avatarId || !!config.voiceId || typeof config.movementEnabled === 'boolean';
}

function readSetupStorageKey(key: string) {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function loadClassroomSetup() {
  const primary = normalizeSetupConfig(loadSetup());
  if (hasSetupSelection(primary)) {
    return primary;
  }
  for (const key of SETUP_STORAGE_KEYS) {
    const fallback = normalizeSetupConfig(readSetupStorageKey(key));
    if (hasSetupSelection(fallback)) {
      return fallback;
    }
  }
  return primary;
}

export function getDefaultVoiceId() {
  return 'guy';
}

export function useClassroomState() {
  const [setupConfig] = useState<SetupConfig>(loadClassroomSetup);
  
  const activeAvatarId = setupConfig.avatarId || 'avatar1';
  const activeVoiceId = setupConfig.voiceId || getDefaultVoiceId();
  const movementEnabled = setupConfig.movementEnabled ?? true;
  const avatarData = getAvatarById(activeAvatarId);
  const avatarName = setupConfig.avatarName || avatarData?.name || 'AI Tutor';

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isDocumentsOpen, setIsDocumentsOpen] = useState<boolean>(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(400);

  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);
  const toggleDocuments = useCallback(() => setIsDocumentsOpen((prev) => !prev), []);

  return {
    setupConfig,
    activeAvatarId,
    activeVoiceId,
    movementEnabled,
    avatarName,
    isSettingsOpen,
    isDocumentsOpen,
    sidebarWidth,
    setSidebarWidth,
    openSettings,
    closeSettings,
    toggleDocuments,
  };
}
