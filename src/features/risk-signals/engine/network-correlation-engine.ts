import type { RiskSignal } from '../types';

export interface NetworkCorrelationConfig {
  /** How far back to look when counting distinct accounts from one client IP. */
  windowMs: number;
  /**
   * Distinct accounts at or below this count is normal — deliberately
   * higher than `correlation-engine.ts`'s device threshold: an IP is a much
   * noisier signal than a device fingerprint (NAT, corporate/campus
   * networks, and mobile carrier-grade NAT legitimately put many real
   * people behind one address), so this needs more headroom before it's
   * evidence of anything.
   */
  maxDistinctSubjects: number;
}

export const DEFAULT_NETWORK_CORRELATION_CONFIG: NetworkCorrelationConfig = {
  windowMs: 24 * 60 * 60 * 1000, // 24h
  maxDistinctSubjects: 8,
};

/**
 * Pure function, same shape as `correlation-engine.ts#computeCorrelationSignal`
 * but keyed on client IP instead of device fingerprint — an independent axis
 * that catches a bot farm rotating browser fingerprints (or even devices)
 * while still operating from one host/network, which device correlation
 * alone would miss.
 */
export function computeNetworkCorrelationSignal(
  distinctSubjects: readonly string[],
  config: NetworkCorrelationConfig = DEFAULT_NETWORK_CORRELATION_CONFIG,
): RiskSignal {
  const count = distinctSubjects.length;
  const overage = count - config.maxDistinctSubjects;
  const score = overage > 0 ? Math.min(1, overage / config.maxDistinctSubjects) : 0;

  return {
    type: 'network-correlation',
    score,
    detail: `${count} distinct account(s) verified from this client IP within ${config.windowMs}ms (threshold ${config.maxDistinctSubjects}).`,
  };
}
