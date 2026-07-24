import { getConsentStore } from './consent-store';
import type { DeliveryDeps, DeliveryResult, WebhookEvent } from './webhook-delivery';
import { deliverToSubscription } from './webhook-delivery';
import { getWebhookStore } from './webhook-store';

// Emits a verification-status-change event to every subscription for a subject —
// but only to apps that still hold the subject's consent. Revoking consent
// therefore also stops webhook delivery, consistent with the read API.
//
// Call this wherever a verification actually changes (the integration seam).

export interface EmitResult {
  subject: string;
  deliveries: { subscriptionId: string; appId: string; result: DeliveryResult }[];
  skippedNoConsent: string[];
}

export async function emitVerificationChange(
  subject: string,
  data: { status: 'verified' | 'unverified'; [key: string]: unknown },
  deps: DeliveryDeps = {},
): Promise<EmitResult> {
  const subs = await getWebhookStore().listForSubject(subject);
  const consent = getConsentStore();

  const event: WebhookEvent = {
    type: 'verification.status.changed',
    subject,
    data,
    timestamp: Date.now(),
  };

  const deliveries: EmitResult['deliveries'] = [];
  const skippedNoConsent: string[] = [];

  for (const sub of subs) {
    if (!(await consent.isGranted(sub.appId, subject))) {
      skippedNoConsent.push(sub.appId);
      continue;
    }
    const result = await deliverToSubscription(sub, event, deps);
    deliveries.push({ subscriptionId: sub.id, appId: sub.appId, result });
  }

  return { subject, deliveries, skippedNoConsent };
}
