// The internal (non-public) interface for the risk-signal engine. This is
// the ONLY module other features should import from — everything under
// `engine/` and `store/` is an implementation detail.
//
// `recordVerificationSignal` is the single write path: it records the raw
// event, recomputes every signal from scratch, and persists the resulting
// assessment. `getRiskAssessment` is the single read path — e.g. for a
// future admin review workflow. Neither function imports or touches
// `@/features/scoring` or `verifications/store/verification-store`: risk
// state is computed and stored entirely independently of the Human Score,
// so a "fully verified" account can be flagged here without its score
// changing at all. See `__tests__/service.test.ts` for the test that
// enforces this boundary.

import { computeCorrelationSignal, DEFAULT_CORRELATION_CONFIG } from './engine/correlation-engine';
import { computeDisposablePhoneSignal } from './engine/disposable-phone-engine';
import { computeRiskAssessment } from './engine/risk-engine';
import { computeVelocitySignal, DEFAULT_VELOCITY_CONFIG } from './engine/velocity-engine';
import { getRiskAssessmentStore } from './store/risk-assessment-store';
import { getRiskEventStore } from './store/risk-event-store';
import type { RiskAssessment } from './types';

export interface RecordVerificationSignalInput {
  /** The account being verified — a wallet address or Veridion user token, same identifier space as the public API's `subject`. */
  subject: string;
  /** Hashed device/browser signal from `services/fingerprint.ts`. */
  fingerprint: string;
  providerId: string;
  /** Present only for phone/SMS completions. */
  phone?: string;
  /** Injectable for deterministic tests; defaults to the real clock. */
  now?: number;
}

/**
 * Records a verification-completion signal and recomputes + persists the
 * subject's risk assessment. Call this once per completed provider
 * (wired into `use-oauth-provider.ts` and `use-otp-flow.ts` via
 * `hooks/use-risk-signal-reporter.ts`).
 */
export function recordVerificationSignal(input: RecordVerificationSignalInput): RiskAssessment {
  const now = input.now ?? Date.now();
  const eventStore = getRiskEventStore();

  eventStore.record({
    fingerprint: input.fingerprint,
    subject: input.subject,
    providerId: input.providerId,
    timestamp: now,
  });

  const distinctSubjects = eventStore.distinctSubjectsForFingerprint(
    input.fingerprint,
    DEFAULT_CORRELATION_CONFIG.windowMs,
    now,
  );
  const timestamps = eventStore.timestampsForSubject(input.subject, DEFAULT_VELOCITY_CONFIG.windowMs, now);

  const correlation = computeCorrelationSignal(distinctSubjects);
  const velocity = computeVelocitySignal(timestamps, now);
  const disposablePhone = input.phone ? computeDisposablePhoneSignal(input.phone) : undefined;

  const assessment = computeRiskAssessment({ subject: input.subject, correlation, velocity, disposablePhone, now });
  getRiskAssessmentStore().save(assessment);
  return assessment;
}

/**
 * Reads the most recently computed risk assessment for a subject, or `null`
 * if none has been recorded yet. Internal-only — never wired into the
 * public `api/v1/*` surface consumed by third-party apps.
 */
export function getRiskAssessment(subject: string): RiskAssessment | null {
  return getRiskAssessmentStore().getLatest(subject);
}
