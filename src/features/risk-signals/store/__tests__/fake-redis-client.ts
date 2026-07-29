import type { RedisClientLike } from '../redis-client';

/**
 * A minimal in-process fake implementing just the six commands
 * `RedisClientLike` declares, so `RedisRiskEventStore` and
 * `RedisRiskAssessmentStore` can be tested for real (including their async
 * boundaries) without a real Redis server or a client library dependency.
 * Not a general-purpose Redis emulator — only the range/rank semantics the
 * two adapters actually use.
 */
export class FakeRedisClient implements RedisClientLike {
  private zsets = new Map<string, Map<string, number>>();
  private strings = new Map<string, string>();

  async zadd(key: string, score: number, member: string): Promise<void> {
    const set = this.zsets.get(key) ?? new Map<string, number>();
    set.set(member, score);
    this.zsets.set(key, set);
  }

  async zrangebyscore(key: string, min: number | string, max: number | string): Promise<string[]> {
    const set = this.zsets.get(key);
    if (!set) return [];
    const [lo, hi] = [toBound(min, -Infinity), toBound(max, Infinity)];
    return [...set.entries()]
      .filter(([, score]) => score >= lo && score <= hi)
      .sort((a, b) => a[1] - b[1])
      .map(([member]) => member);
  }

  async zremrangebyscore(key: string, min: number | string, max: number | string): Promise<void> {
    const set = this.zsets.get(key);
    if (!set) return;
    const [lo, hi] = [toBound(min, -Infinity), toBound(max, Infinity)];
    for (const [member, score] of set) {
      if (score >= lo && score <= hi) set.delete(member);
    }
  }

  async zremrangebyrank(key: string, start: number, stop: number): Promise<void> {
    const set = this.zsets.get(key);
    if (!set) return;
    const ranked = [...set.entries()].sort((a, b) => a[1] - b[1]).map(([member]) => member);
    const normalizedStop = stop < 0 ? ranked.length + stop : stop;
    for (let i = Math.max(start, 0); i <= normalizedStop && i < ranked.length; i++) {
      set.delete(ranked[i]);
    }
  }

  async zcard(key: string): Promise<number> {
    return this.zsets.get(key)?.size ?? 0;
  }

  async set(key: string, value: string): Promise<void> {
    this.strings.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    return this.strings.get(key) ?? null;
  }

  async keys(pattern: string): Promise<string[]> {
    // Only the trailing-'*' prefix wildcard is supported — the only form
    // either adapter issues.
    const prefix = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern;
    return [...this.strings.keys()].filter((key) => key.startsWith(prefix));
  }
}

function toBound(value: number | string, fallback: number): number {
  if (value === '-inf' || value === '+inf') return value === '-inf' ? -Infinity : Infinity;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
