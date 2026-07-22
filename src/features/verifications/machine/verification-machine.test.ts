import {
  INITIAL_MACHINE_STATE,
  createInitialMachineState,
  isInFlight,
  isStalePending,
  isTerminal,
  verificationMachineReducer,
  type VerificationMachineState,
} from './verification-machine';

describe('verificationMachineReducer', () => {
  it('starts at idle', () => {
    expect(createInitialMachineState().status).toBe('idle');
  });

  it('idle --CONNECT--> connecting', () => {
    const next = verificationMachineReducer(createInitialMachineState(), { type: 'CONNECT' });
    expect(next.status).toBe('connecting');
    expect(next.startedAt).not.toBeNull();
  });

  it('connecting --AWAIT_EXTERNAL--> pending_external, storing nonce and context', () => {
    const connecting = verificationMachineReducer(createInitialMachineState(), { type: 'CONNECT' });
    const pending = verificationMachineReducer(connecting, {
      type: 'AWAIT_EXTERNAL',
      nonce: 'abc123',
      context: { redirectUri: 'https://example.com/dashboard' },
    });
    expect(pending.status).toBe('pending_external');
    expect(pending.nonce).toBe('abc123');
    expect(pending.context).toEqual({ redirectUri: 'https://example.com/dashboard' });
  });

  it('connecting --SUCCEED--> verified (providers with no external redirect, e.g. Stellar/Google)', () => {
    const connecting = verificationMachineReducer(createInitialMachineState(), { type: 'CONNECT' });
    const verified = verificationMachineReducer(connecting, { type: 'SUCCEED' });
    expect(verified.status).toBe('verified');
    expect(verified.error).toBeNull();
  });

  it('pending_external --SUCCEED--> verified', () => {
    let state = verificationMachineReducer(createInitialMachineState(), { type: 'CONNECT' });
    state = verificationMachineReducer(state, { type: 'AWAIT_EXTERNAL', nonce: 'n1' });
    state = verificationMachineReducer(state, { type: 'SUCCEED' });
    expect(state.status).toBe('verified');
  });

  it('pending_external --FAIL--> failed, recording the error', () => {
    let state = verificationMachineReducer(createInitialMachineState(), { type: 'CONNECT' });
    state = verificationMachineReducer(state, { type: 'AWAIT_EXTERNAL', nonce: 'n1' });
    state = verificationMachineReducer(state, { type: 'FAIL', error: 'state mismatch' });
    expect(state.status).toBe('failed');
    expect(state.error).toBe('state mismatch');
  });

  it('connecting --FAIL--> failed', () => {
    const connecting = verificationMachineReducer(createInitialMachineState(), { type: 'CONNECT' });
    const failed = verificationMachineReducer(connecting, { type: 'FAIL', error: 'network error' });
    expect(failed.status).toBe('failed');
    expect(failed.error).toBe('network error');
  });

  it('failed --RETRY--> connecting, incrementing retryCount and clearing the error', () => {
    let state = verificationMachineReducer(createInitialMachineState(), { type: 'CONNECT' });
    state = verificationMachineReducer(state, { type: 'FAIL', error: 'boom' });
    state = verificationMachineReducer(state, { type: 'RETRY' });
    expect(state.status).toBe('connecting');
    expect(state.retryCount).toBe(1);
    expect(state.error).toBeNull();
  });

  it('retryCount survives across multiple retries', () => {
    let state = verificationMachineReducer(createInitialMachineState(), { type: 'CONNECT' });
    state = verificationMachineReducer(state, { type: 'FAIL', error: 'e1' });
    state = verificationMachineReducer(state, { type: 'RETRY' });
    state = verificationMachineReducer(state, { type: 'FAIL', error: 'e2' });
    state = verificationMachineReducer(state, { type: 'RETRY' });
    expect(state.retryCount).toBe(2);
  });

  it('verified --RESET--> idle (re-verification / manual reset)', () => {
    let state = verificationMachineReducer(createInitialMachineState(), { type: 'CONNECT' });
    state = verificationMachineReducer(state, { type: 'SUCCEED' });
    state = verificationMachineReducer(state, { type: 'RESET' });
    expect(state).toEqual(INITIAL_MACHINE_STATE);
  });

  it('ignores invalid transitions instead of throwing (idle cannot SUCCEED directly)', () => {
    const idle = createInitialMachineState();
    const result = verificationMachineReducer(idle, { type: 'SUCCEED' });
    expect(result).toBe(idle);
  });

  it('ignores RETRY from a non-failed state', () => {
    const connecting = verificationMachineReducer(createInitialMachineState(), { type: 'CONNECT' });
    const result = verificationMachineReducer(connecting, { type: 'RETRY' });
    expect(result).toBe(connecting);
  });

  it('ignores AWAIT_EXTERNAL from idle (must CONNECT first)', () => {
    const idle = createInitialMachineState();
    const result = verificationMachineReducer(idle, { type: 'AWAIT_EXTERNAL', nonce: 'x' });
    expect(result).toBe(idle);
  });

  it('RESET is always allowed, from any state', () => {
    const states: VerificationMachineState[] = [
      createInitialMachineState(),
      verificationMachineReducer(createInitialMachineState(), { type: 'CONNECT' }),
      verificationMachineReducer(
        verificationMachineReducer(createInitialMachineState(), { type: 'CONNECT' }),
        { type: 'AWAIT_EXTERNAL', nonce: 'n' },
      ),
    ];
    for (const state of states) {
      expect(verificationMachineReducer(state, { type: 'RESET' }).status).toBe('idle');
    }
  });
});

describe('isInFlight / isTerminal', () => {
  it('classifies each status correctly', () => {
    expect(isInFlight('idle')).toBe(false);
    expect(isInFlight('connecting')).toBe(true);
    expect(isInFlight('pending_external')).toBe(true);
    expect(isInFlight('verified')).toBe(false);
    expect(isInFlight('failed')).toBe(false);

    expect(isTerminal('verified')).toBe(true);
    expect(isTerminal('failed')).toBe(true);
    expect(isTerminal('idle')).toBe(false);
    expect(isTerminal('connecting')).toBe(false);
  });
});

describe('isStalePending', () => {
  it('treats a fresh pending_external as resumable, not stale', () => {
    const state = verificationMachineReducer(
      verificationMachineReducer(createInitialMachineState(), { type: 'CONNECT' }),
      { type: 'AWAIT_EXTERNAL', nonce: 'n' },
    );
    expect(isStalePending(state, state.startedAt! + 1000)).toBe(false);
  });

  it('treats a pending_external older than the staleness window as stale', () => {
    const state = verificationMachineReducer(
      verificationMachineReducer(createInitialMachineState(), { type: 'CONNECT' }),
      { type: 'AWAIT_EXTERNAL', nonce: 'n' },
    );
    expect(isStalePending(state, state.startedAt! + 20 * 60 * 1000)).toBe(true);
  });

  it('non-pending states are never stale', () => {
    expect(isStalePending(createInitialMachineState())).toBe(false);
  });
});
