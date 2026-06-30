const STORAGE_KEY = 'virtai-setup';

/**
 * Load setup configuration from localStorage.
 * Returns null if nothing stored or data is corrupt.
 */
export function loadSetup() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);

    // Explicit schema validation
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.avatarId !== 'string') return null;
    if (typeof parsed.voiceId !== 'string') return null;

    // Optional boolean validation
    if (parsed.movementEnabled !== undefined && typeof parsed.movementEnabled !== 'boolean') return null;
    if (parsed.documentsSkipped !== undefined && typeof parsed.documentsSkipped !== 'boolean') return null;
    if (parsed.documentsUploaded !== undefined && typeof parsed.documentsUploaded !== 'boolean') return null;

    return parsed;
  } catch (error) {
    console.warn('Failed to load setup configuration from localStorage:', error);
    return null;
  }
}

/**
 * Save setup configuration to localStorage.
 * @param {{ avatarId: string, voiceId: string, movementEnabled?: boolean, documentsSkipped?: boolean, documentsUploaded?: boolean }} config
 */
export function saveSetup(config) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...config, savedAt: Date.now() }));
  } catch (error) {
    console.warn('Failed to save setup configuration to localStorage (quota exceeded?):', error);
  }
}

/** Remove setup configuration from localStorage. */
export function clearSetup() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to remove setup configuration from localStorage:', error);
  }
}
