// Risk engine types. Deliberately isolated from `@/features/scoring` and
// `verifications/store/verification-store` — this feature reads verification
// *completion events* (providerId + timestamp) as plain inputs, but never
// imports the Human Score engine or the verification store. See
// `service.ts` for the write/read entrypoints and
// `__tests__/service.test.ts` for the boundary test that enforces this.

export type RiskSignalType = 'device-correlation' | 'velocity' | 'disposable-phone';

export interface RiskSignal {
  type: RiskSignalType;
  /** Always in [0, 1] — 0 means "nothing anomalous", 1 means maximal confidence for this signal alone. */
  score: number;
  /** Human-readable explanation, safe to show to an internal reviewer (never sent to the public API). */
  detail: string;
}

export interface RiskAssessment {
  subject: string;
  /** 0-100 aggregate risk score. Stored independently of the Human Score. */
  score: number;
  signals: RiskSignal[];
  computedAt: number;
}
