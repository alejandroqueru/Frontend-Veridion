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

// Async for the same reason as RiskEventStore (see risk-event-store.ts):
// a genuinely swappable-to-Redis store can't have a synchronous interface.
export interface RiskAssessmentStore {
  save(assessment: RiskAssessment): Promise<void>;
  getLatest(subject: string): Promise<RiskAssessment | null>;
  /** All stored assessments at or above `minScore`, most recent first. Powers the internal review endpoint (see api/internal/risk-review). */
  listAbove(minScore: number, limit: number): Promise<RiskAssessment[]>;
}

export class InMemoryRiskAssessmentStore implements RiskAssessmentStore {
  private latest = new Map<string, RiskAssessment>();

  async save(assessment: RiskAssessment): Promise<void> {
    this.latest.set(assessment.subject, assessment);
  }

  async getLatest(subject: string): Promise<RiskAssessment | null> {
    return this.latest.get(subject) ?? null;
  }

  async listAbove(minScore: number, limit: number): Promise<RiskAssessment[]> {
    return [...this.latest.values()]
      .filter((a) => a.score >= minScore)
      .sort((a, b) => b.computedAt - a.computedAt)
      .slice(0, limit);
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
