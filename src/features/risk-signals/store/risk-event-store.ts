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
  /** Client IP as seen by the ingestion route, when available. A separate, weaker correlation axis from `fingerprint` — see `engine/network-correlation-engine.ts`. */
  ip?: string;
}

/**
 * Async from the start, even though the in-memory default below resolves
 * synchronously under the hood: a store that's genuinely swappable for
 * Redis (see `redis-risk-event-store.ts`) can't be sync, since real network
 * I/O can't be forced into a synchronous return. Designing the interface
 * async now means the swap is a one-line `setRiskEventStore` call later,
 * not a breaking interface change across every caller.
 */
export interface RiskEventStore {
  record(event: RiskEventRecord): Promise<void>;
  /** Distinct subjects seen under this device/network signal within the trailing window ending at `now`. */
  distinctSubjectsForFingerprint(fingerprint: string, windowMs: number, now: number): Promise<string[]>;
  /** Distinct subjects seen from this client IP within the trailing window ending at `now`. */
  distinctSubjectsForIp(ip: string, windowMs: number, now: number): Promise<string[]>;
  /** Completion timestamps recorded for this subject within the trailing window ending at `now`. */
  timestampsForSubject(subject: string, windowMs: number, now: number): Promise<number[]>;
}

/**
 * Longest lookback any engine config uses today is the correlation window
 * (24h, see `engine/correlation-engine.ts`). Retaining a week gives room to
 * widen that window later without an unrelated storage change, while still
 * bounding how long a single fingerprint's/subject's history can grow.
 */
const MAX_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Time-based pruning alone doesn't bound memory within the retention
 * window: the ingestion route's rate limiting (see `api/internal/risk-signal
 * /route.ts`) makes flooding one key expensive, but isn't a hard guarantee.
 * This caps each key at the N most recent events regardless of age, so a
 * single fingerprint/subject can never grow the store unboundedly even if
 * the rate limit is bypassed or misconfigured.
 */
const MAX_ENTRIES_PER_KEY = 500;

export class InMemoryRiskEventStore implements RiskEventStore {
  private byFingerprint = new Map<string, RiskEventRecord[]>();
  private bySubject = new Map<string, RiskEventRecord[]>();
  private byIp = new Map<string, RiskEventRecord[]>();

  async record(event: RiskEventRecord): Promise<void> {
    this.pushPruned(this.byFingerprint, event.fingerprint, event);
    this.pushPruned(this.bySubject, event.subject, event);
    if (event.ip) this.pushPruned(this.byIp, event.ip, event);
  }

  async distinctSubjectsForFingerprint(fingerprint: string, windowMs: number, now: number): Promise<string[]> {
    const cutoff = now - windowMs;
    const events = this.byFingerprint.get(fingerprint) ?? [];
    return [...new Set(events.filter((e) => e.timestamp >= cutoff).map((e) => e.subject))];
  }

  async distinctSubjectsForIp(ip: string, windowMs: number, now: number): Promise<string[]> {
    const cutoff = now - windowMs;
    const events = this.byIp.get(ip) ?? [];
    return [...new Set(events.filter((e) => e.timestamp >= cutoff).map((e) => e.subject))];
  }

  async timestampsForSubject(subject: string, windowMs: number, now: number): Promise<number[]> {
    const cutoff = now - windowMs;
    const events = this.bySubject.get(subject) ?? [];
    return events.filter((e) => e.timestamp >= cutoff).map((e) => e.timestamp);
  }

  private pushPruned(map: Map<string, RiskEventRecord[]>, key: string, event: RiskEventRecord): void {
    const cutoff = event.timestamp - MAX_RETENTION_MS;
    const existing = (map.get(key) ?? []).filter((e) => e.timestamp >= cutoff);
    existing.push(event);
    // Trim oldest-first so the cap always keeps the most recent activity —
    // the events any window query actually cares about.
    if (existing.length > MAX_ENTRIES_PER_KEY) {
      existing.splice(0, existing.length - MAX_ENTRIES_PER_KEY);
    }
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
