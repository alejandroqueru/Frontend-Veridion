import { isDisposablePhoneNumber } from '../services/disposable-phone-patterns';
import type { RiskSignal } from '../types';

/** Thin adapter turning the boolean disposable-phone check into a normalized RiskSignal, for symmetry with the other two signals. */
export function computeDisposablePhoneSignal(phone: string): RiskSignal {
  const flagged = isDisposablePhoneNumber(phone);

  return {
    type: 'disposable-phone',
    score: flagged ? 1 : 0,
    detail: flagged
      ? 'Phone number matches a known disposable/VOIP/test pattern.'
      : 'No disposable/VOIP pattern match.',
  };
}
