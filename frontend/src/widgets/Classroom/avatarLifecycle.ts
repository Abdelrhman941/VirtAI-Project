const isAvatarDebugEnabled = (env: any) => false;
import { logger as defaultLogger } from '@/shared/utils/logger';

export const AVATAR_STATUS = {
  LOADING: 'loading',
  SCENE_MOUNTED: 'scene-mounted',
  SCENE_READY: 'scene-ready',
  VISIBLE: 'visible',
  FAILED: 'failed',
} as const;

export type AvatarStatus = typeof AVATAR_STATUS[keyof typeof AVATAR_STATUS];

export const AVATAR_LIFECYCLE_EVENTS = {
  SCENE_MOUNTED: 'scene-mounted',
  FIRST_FRAME_VALIDATED: 'first-frame-validated',
  VISIBLE: 'visible',
  FAILED: 'failed',
  RETRY: 'retry',
} as const;

export type AvatarLifecycleEvent = typeof AVATAR_LIFECYCLE_EVENTS[keyof typeof AVATAR_LIFECYCLE_EVENTS];

export function resolveAvatarLifecycleTransition(currentStatus: AvatarStatus, event: AvatarLifecycleEvent) {
  if (event === AVATAR_LIFECYCLE_EVENTS.RETRY) {
    return {
      status: AVATAR_STATUS.LOADING,
      changed: currentStatus !== AVATAR_STATUS.LOADING,
    };
  }

  if (event === AVATAR_LIFECYCLE_EVENTS.FAILED) {
    return {
      status: AVATAR_STATUS.FAILED,
      changed: currentStatus !== AVATAR_STATUS.FAILED,
    };
  }

  if (event === AVATAR_LIFECYCLE_EVENTS.SCENE_MOUNTED) {
    if (currentStatus === AVATAR_STATUS.LOADING) {
      return { status: AVATAR_STATUS.SCENE_MOUNTED, changed: true };
    }

    if (
      currentStatus === AVATAR_STATUS.SCENE_MOUNTED ||
      currentStatus === AVATAR_STATUS.SCENE_READY ||
      currentStatus === AVATAR_STATUS.VISIBLE
    ) {
      return { status: currentStatus, changed: false, stale: true, reason: 'Already mounted' };
    }
    
    return { status: currentStatus, changed: false, rejected: true, reason: 'Cannot mount from current status' };
  }

  if (event === AVATAR_LIFECYCLE_EVENTS.FIRST_FRAME_VALIDATED) {
    if (
      currentStatus === AVATAR_STATUS.LOADING ||
      currentStatus === AVATAR_STATUS.SCENE_MOUNTED
    ) {
      return { status: AVATAR_STATUS.SCENE_READY, changed: true };
    }

    if (currentStatus === AVATAR_STATUS.SCENE_READY || currentStatus === AVATAR_STATUS.VISIBLE) {
      return { status: currentStatus, changed: false, stale: true, reason: 'Already validated' };
    }
    
    return { status: currentStatus, changed: false, rejected: true, reason: 'Cannot validate first frame from current status' };
  }

  if (event === AVATAR_LIFECYCLE_EVENTS.VISIBLE) {
    if (currentStatus === AVATAR_STATUS.SCENE_READY) {
      return { status: AVATAR_STATUS.VISIBLE, changed: true };
    }

    if (currentStatus === AVATAR_STATUS.VISIBLE) {
      return { status: currentStatus, changed: false, stale: true, reason: 'Already visible' };
    }
    
    return { status: currentStatus, changed: false, rejected: true, reason: 'Cannot become visible unless scene is ready' };
  }

  return { status: currentStatus, changed: false, rejected: true, reason: `Unknown event or invalid transition from ${currentStatus} via ${event}` };
}

export interface AvatarLifecycleTelemetryPayload {
  avatarId?: string | null;
  lifecycleState?: AvatarStatus | null;
  event?: AvatarLifecycleEvent | null;
  source?: string | null;
  previousStatus?: AvatarStatus | null;
  nextStatus?: AvatarStatus | null;
  changed?: boolean;
  rejected?: boolean;
  stale?: boolean;
  failureReason?: string | null;
  timestamp?: string;
}

export function createAvatarLifecycleTelemetry({
  avatarId = null,
  lifecycleState = null,
  event = null,
  source = null,
  previousStatus = null,
  nextStatus = null,
  changed = false,
  rejected = false,
  stale = false,
  failureReason = null,
  timestamp = new Date().toISOString(),
}: AvatarLifecycleTelemetryPayload = {}) {
  return {
    avatarId,
    lifecycleState,
    event,
    source,
    previousStatus,
    nextStatus,
    changed,
    rejected,
    stale,
    failureReason,
    timestamp,
  };
}

export interface EmitTelemetryOptions {
  env?: Record<string, unknown>;
  logger?: typeof defaultLogger;
  target?: any;
}

export function emitAvatarLifecycleTelemetry(payload: AvatarLifecycleTelemetryPayload, {
  env = import.meta.env,
  logger = defaultLogger,
  target = typeof window !== 'undefined' ? window : null,
}: EmitTelemetryOptions = {}) {
  if (!isAvatarDebugEnabled(env)) {
    return null;
  }

  const record = createAvatarLifecycleTelemetry(payload);
  if (target) {
    target.__VIRTAI_AVATAR_DEBUG__ = target.__VIRTAI_AVATAR_DEBUG__ || {};
    target.__VIRTAI_AVATAR_DEBUG__.lifecycleTelemetry =
      target.__VIRTAI_AVATAR_DEBUG__.lifecycleTelemetry || [];
    target.__VIRTAI_AVATAR_DEBUG__.lifecycleTelemetry.push(record);
  }

  logger.info('[AvatarLifecycleTelemetry]', record);
  return record;
}

export interface InstallDebugControlsOptions {
  onRetry?: () => void;
  env?: Record<string, unknown>;
  target?: any;
}

export function installAvatarLifecycleDebugControls({
  onRetry,
  env = import.meta.env,
  target = typeof window !== 'undefined' ? window : null,
}: InstallDebugControlsOptions = {}) {
  if (!isAvatarDebugEnabled(env) || !target || typeof onRetry !== 'function') {
    return null;
  }

  target.__VIRTAI_AVATAR_DEBUG__ = target.__VIRTAI_AVATAR_DEBUG__ || {};
  target.__VIRTAI_AVATAR_DEBUG__.retry = onRetry;

  return () => {
    if (target.__VIRTAI_AVATAR_DEBUG__?.retry === onRetry) {
      delete target.__VIRTAI_AVATAR_DEBUG__.retry;
    }
  };
}
