// The minimal Redis command surface the risk-signals adapters need.
// Deliberately NOT a dependency on a specific client library — no `ioredis`
// or `redis` package is installed in this project (see package.json; every
// other "swap for Redis in production" comment in this codebase, e.g.
// verifications/services/otp-service.ts, is likewise unimplemented). This
// interface exists so the adapters below can be written and tested now,
// against a hand-rolled fake (see __tests__), without adding a real network
// client as a hard dependency for a demo app that has nowhere to point it.
//
// A real `ioredis` client instance satisfies this interface structurally —
// its method names and signatures for these six commands match exactly —
// so wiring a real Redis in production is `new RedisRiskEventStore(new
// Redis(process.env.REDIS_URL))`, not a rewrite.
export interface RedisClientLike {
  zadd(key: string, score: number, member: string): Promise<unknown>;
  zrangebyscore(key: string, min: number | string, max: number | string): Promise<string[]>;
  zremrangebyscore(key: string, min: number | string, max: number | string): Promise<unknown>;
  /** Removes members ranked [start, stop] (0 = lowest score = oldest, since we always score by timestamp). */
  zremrangebyrank(key: string, start: number, stop: number): Promise<unknown>;
  zcard(key: string): Promise<number>;
  set(key: string, value: string): Promise<unknown>;
  get(key: string): Promise<string | null>;
  /**
   * Used only by RedisRiskAssessmentStore#listAbove. A real production
   * deployment with many keys should prefer SCAN over KEYS (KEYS blocks the
   * server for O(n) on the whole keyspace) — kept as KEYS here to match the
   * rest of this codebase's demo-grade conventions rather than overbuild a
   * cursor-based scan for a method nothing calls at production scale yet.
   */
  keys(pattern: string): Promise<string[]>;
}
