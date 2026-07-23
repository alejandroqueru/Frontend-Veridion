/**
 * Shared verification lifecycle state machine.
 *
 * One instance of this machine tracks a single verification method's
 * in-flight UX state (idle → connecting → pending_external → verified|failed,
 * with failed → connecting via RETRY). It is intentionally NOT responsible
 * for scoring/points — that stays entirely in `@/features/scoring`, driven by
 * `recordVerificationEvent` in the verification store. This machine only
 * answers "what should the UI show right now for provider X", including
 * across a page reload while an OAuth redirect or OTP code is outstanding.
 */

export type VerificationLifecycleStatus =
  | 'idle'
  | 'connecting'
  | 'pending_external'
  | 'verified'
  | 'failed';

export interface VerificationMachineState {
  status: VerificationLifecycleStatus;
  /** CSRF/resume token for the current or most recently started external round-trip. */
  nonce: string | null;
  /** epoch ms when the current attempt (connecting/pending_external) began. */
  startedAt: number | null;
  /** Consecutive failed attempts; reset by RESET, incremented by RETRY. */
  retryCount: number;
  error: string | null;
  /** Provider-specific data needed to resume (e.g. masked identifier, redirect uri used). */
  context: Record<string, unknown>;
}

export const INITIAL_MACHINE_STATE: VerificationMachineState = {
  status: 'idle',
  nonce: null,
  startedAt: null,
  retryCount: 0,
  error: null,
  context: {},
};

export type VerificationMachineEvent =
  | { type: 'CONNECT' }
  | { type: 'AWAIT_EXTERNAL'; nonce: string; context?: Record<string, unknown> }
  | { type: 'SUCCEED' }
  | { type: 'FAIL'; error: string }
  | { type: 'RETRY' }
  | { type: 'RESET' };

const ALLOWED_EVENTS: Record<VerificationLifecycleStatus, ReadonlyArray<VerificationMachineEvent['type']>> = {
  idle: ['CONNECT'],
  connecting: ['AWAIT_EXTERNAL', 'SUCCEED', 'FAIL', 'RESET'],
  pending_external: ['SUCCEED', 'FAIL', 'RESET'],
  verified: ['RESET'],
  failed: ['RETRY', 'RESET'],
};

export function canTransition(status: VerificationLifecycleStatus, eventType: VerificationMachineEvent['type']): boolean {
  return ALLOWED_EVENTS[status].includes(eventType);
}

/**
 * Pure reducer — no Date.now() side-stepping needed by callers since the
 * timestamp is only observable through the returned state, keeping this
 * trivially unit-testable. Invalid transitions are no-ops (return the same
 * state reference) rather than throwing, since UI effects can race (e.g. a
 * stale OAuth callback firing after a RESET).
 */
export function verificationMachineReducer(
  state: VerificationMachineState,
  event: VerificationMachineEvent,
): VerificationMachineState {
  if (!canTransition(state.status, event.type)) {
    return state;
  }

  switch (event.type) {
    case 'CONNECT':
      return {
        ...INITIAL_MACHINE_STATE,
        status: 'connecting',
        startedAt: Date.now(),
        retryCount: state.retryCount,
      };

    case 'AWAIT_EXTERNAL':
      return {
        ...state,
        status: 'pending_external',
        nonce: event.nonce,
        context: { ...state.context, ...(event.context ?? {}) },
      };

    case 'SUCCEED':
      return {
        ...state,
        status: 'verified',
        error: null,
      };

    case 'FAIL':
      return {
        ...state,
        status: 'failed',
        error: event.error,
      };

    case 'RETRY':
      return {
        ...INITIAL_MACHINE_STATE,
        status: 'connecting',
        startedAt: Date.now(),
        retryCount: state.retryCount + 1,
      };

    case 'RESET':
      return { ...INITIAL_MACHINE_STATE };

    default:
      return state;
  }
}

export function createInitialMachineState(): VerificationMachineState {
  return { ...INITIAL_MACHINE_STATE, context: {} };
}

export function isInFlight(status: VerificationLifecycleStatus): boolean {
  return status === 'connecting' || status === 'pending_external';
}

export function isTerminal(status: VerificationLifecycleStatus): boolean {
  return status === 'verified' || status === 'failed';
}

/** A pending_external state older than this is treated as stale/abandoned rather than resumable. */
export const PENDING_EXTERNAL_STALE_AFTER_MS = 15 * 60 * 1000;

export function isStalePending(state: VerificationMachineState, now: number = Date.now()): boolean {
  return (
    state.status === 'pending_external' &&
    state.startedAt !== null &&
    now - state.startedAt > PENDING_EXTERNAL_STALE_AFTER_MS
  );
}
