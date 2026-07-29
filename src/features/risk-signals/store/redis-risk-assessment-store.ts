import type { RiskAssessment } from '../types';
import type { RedisClientLike } from './redis-client';
import type { RiskAssessmentStore } from './risk-assessment-store';

const KEY_PREFIX = 'risk-assessment:';

function keyFor(subject: string): string {
  return `${KEY_PREFIX}${subject}`;
}

/**
 * Redis-backed implementation of `RiskAssessmentStore` (see
 * risk-assessment-store.ts). Same swap-in shape as `RedisRiskEventStore`:
 * `setRiskAssessmentStore(new RedisRiskAssessmentStore(client))`.
 *
 * One key per subject holding the JSON-encoded latest assessment — `save`
 * always overwrites, matching the in-memory store's "latest wins" semantics
 * (this store only ever needs the most recent assessment per subject, not
 * a history; `RiskEventStore` is where history lives).
 */
export class RedisRiskAssessmentStore implements RiskAssessmentStore {
  constructor(private readonly client: RedisClientLike) {}

  async save(assessment: RiskAssessment): Promise<void> {
    await this.client.set(keyFor(assessment.subject), JSON.stringify(assessment));
  }

  async getLatest(subject: string): Promise<RiskAssessment | null> {
    const raw = await this.client.get(keyFor(subject));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as RiskAssessment;
    } catch {
      return null;
    }
  }

  async listAbove(minScore: number, limit: number): Promise<RiskAssessment[]> {
    const keys = await this.client.keys(`${KEY_PREFIX}*`);
    const raws = await Promise.all(keys.map((key) => this.client.get(key)));

    const assessments: RiskAssessment[] = [];
    for (const raw of raws) {
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as RiskAssessment;
        if (parsed.score >= minScore) assessments.push(parsed);
      } catch {
        // Skip an unparseable entry rather than fail the whole listing.
      }
    }

    return assessments.sort((a, b) => b.computedAt - a.computedAt).slice(0, limit);
  }
}
