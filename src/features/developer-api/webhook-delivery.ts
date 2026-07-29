import { createHmac } from 'node:crypto';

import type { WebhookEventType, WebhookSubscription } from './webhook-store';

// Signing + delivery for webhooks.
//
// Payloads are signed with the subscription's secret (HMAC-SHA256) so the
// receiver can verify authenticity and integrity — the same scheme Stripe/GitHub
// use. Delivery retries on failure with exponential backoff.
//
// `fetch` and `sleep` are injectable so delivery is fully unit-testable without
// real network calls or real waiting.

export interface WebhookEvent {
  type: WebhookEventType;
  subject: string;
  data: Record<string, unknown>;
  /** Epoch millis; also folded into the signature to prevent replay. */
  timestamp: number;
}

/** HMAC-SHA256 of `${timestamp}.${body}`, hex-encoded. */
export function signPayload(timestamp: number, body: string, secret: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

export interface DeliveryDeps {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxRetries?: number;
  baseDelayMs?: number;
}

export interface DeliveryResult {
  delivered: boolean;
  attempts: number;
  /** Backoff delays that were waited between attempts (ms). */
  delays: number[];
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Deliver an event to one subscription, retrying with exponential backoff.
 * Backoff: baseDelayMs * 2^attempt (attempt 0-indexed) — e.g. 500, 1000, 2000…
 */
export async function deliverToSubscription(
  sub: WebhookSubscription,
  event: WebhookEvent,
  deps: DeliveryDeps = {},
): Promise<DeliveryResult> {
  const doFetch = deps.fetch ?? fetch;
  const sleep = deps.sleep ?? defaultSleep;
  const maxRetries = deps.maxRetries ?? 4;
  const baseDelayMs = deps.baseDelayMs ?? 500;

  const body = JSON.stringify(event);
  const signature = signPayload(event.timestamp, body, sub.secret);
  const delays: number[] = [];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = baseDelayMs * 2 ** (attempt - 1);
      delays.push(delay);
      await sleep(delay);
    }

    try {
      const res = await doFetch(sub.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-veridion-event': event.type,
          'x-veridion-timestamp': String(event.timestamp),
          'x-veridion-signature': `sha256=${signature}`,
        },
        body,
      });
      if (res.ok) {
        return { delivered: true, attempts: attempt + 1, delays };
      }
    } catch {
      // Network error — fall through to retry.
    }
  }

  return { delivered: false, attempts: maxRetries + 1, delays };
}
