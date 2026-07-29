// Stores the latest computed risk assessment per subject — entirely
// separate from Human Score storage (which, per
// `verifications/store/verification-store.ts`, doesn't even have a score
// field: Human Score is always recomputed from `events`). This store is the
// one place a risk score is persisted, and it's read-only from the outside
// via `service.ts#getRiskAssessment` — nothing writes here except
// `service.ts#recordVerificationSignal`.
//
// Same swappable-interface shape as `developer-api/consent-store.ts`.

import type { RiskAssessment } from '../types';

export interface RiskAssessmentStore {
  save(assessment: RiskAssessment): void;
  getLatest(subject: string): RiskAssessment | null;
}

export class InMemoryRiskAssessmentStore implements RiskAssessmentStore {
  private latest = new Map<string, RiskAssessment>();

  save(assessment: RiskAssessment): void {
    this.latest.set(assessment.subject, assessment);
  }

  getLatest(subject: string): RiskAssessment | null {
    return this.latest.get(subject) ?? null;
  }
}

let store: RiskAssessmentStore = new InMemoryRiskAssessmentStore();

export function getRiskAssessmentStore(): RiskAssessmentStore {
  return store;
}

/** Swap in a durable implementation (production) or a fresh one (tests). */
export function setRiskAssessmentStore(next: RiskAssessmentStore): void {
  store = next;
}

/** Reset to a fresh in-memory store — primarily for tests. */
export function resetRiskAssessmentStore(): void {
  store = new InMemoryRiskAssessmentStore();
}
