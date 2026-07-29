// Raw correlation data: which device/network signal was present at which
// provider completion, for which subject, and when. Kept entirely separate
// from `verifications/store/verification-store.ts` (per-user verification
// UX state) so risk logic can query across *all* subjects without touching,
// exposing, or depending on any single user's client-side store — and so
// raw fingerprints are never sent back to the frontend (only aggregated
// signals are, via `service.ts#getRiskAssessment`).
//
// Same swappable-interface shape as `developer-api/consent-store.ts`: a
// small interface, an in-memory default good enough for a demo/single
// instance, and `set*Store`/`reset*Store` seams for production (Redis/KV)
// or tests.

export interface RiskEventRecord {
  fingerprint: string;
  subject: string;
  providerId: string;
  timestamp: number;
}

export interface RiskEventStore {
  record(event: RiskEventRecord): void;
  /** Distinct subjects seen under this device/network signal within the trailing window ending at `now`. */
  distinctSubjectsForFingerprint(fingerprint: string, windowMs: number, now: number): string[];
  /** Completion timestamps recorded for this subject within the trailing window ending at `now`. */
  timestampsForSubject(subject: string, windowMs: number, now: number): number[];
}

/**
 * Longest lookback any engine config uses today is the correlation window
 * (24h, see `engine/correlation-engine.ts`). Retaining a week gives room to
 * widen that window later without an unrelated storage change, while still
 * bounding how long a single fingerprint's/subject's history can grow.
 */
const MAX_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export class InMemoryRiskEventStore implements RiskEventStore {
  private byFingerprint = new Map<string, RiskEventRecord[]>();
  private bySubject = new Map<string, RiskEventRecord[]>();

  record(event: RiskEventRecord): void {
    this.pushPruned(this.byFingerprint, event.fingerprint, event);
    this.pushPruned(this.bySubject, event.subject, event);
  }

  distinctSubjectsForFingerprint(fingerprint: string, windowMs: number, now: number): string[] {
    const cutoff = now - windowMs;
    const events = this.byFingerprint.get(fingerprint) ?? [];
    return [...new Set(events.filter((e) => e.timestamp >= cutoff).map((e) => e.subject))];
  }

  timestampsForSubject(subject: string, windowMs: number, now: number): number[] {
    const cutoff = now - windowMs;
    const events = this.bySubject.get(subject) ?? [];
    return events.filter((e) => e.timestamp >= cutoff).map((e) => e.timestamp);
  }

  private pushPruned(map: Map<string, RiskEventRecord[]>, key: string, event: RiskEventRecord): void {
    const cutoff = event.timestamp - MAX_RETENTION_MS;
    const existing = (map.get(key) ?? []).filter((e) => e.timestamp >= cutoff);
    existing.push(event);
    map.set(key, existing);
  }
}

let store: RiskEventStore = new InMemoryRiskEventStore();

export function getRiskEventStore(): RiskEventStore {
  return store;
}

/** Swap in a durable implementation (production) or a fresh one (tests). */
export function setRiskEventStore(next: RiskEventStore): void {
  store = next;
}

/** Reset to a fresh in-memory store — primarily for tests. */
export function resetRiskEventStore(): void {
  store = new InMemoryRiskEventStore();
}
