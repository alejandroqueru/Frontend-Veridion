import { randomUUID } from 'node:crypto';

// Webhook subscription store. Like the consent store, this is stateful and
// defined behind an interface with an in-memory default — swap in a durable
// implementation (Redis/Postgres/KV) via `setWebhookStore` for production.
//
// A subscription says: "app <appId> wants events about <subject> delivered to
// <url>". Delivery itself (signing, retries) lives in webhook-delivery.ts.

export type WebhookEventType = 'verification.status.changed';

export interface WebhookSubscription {
  id: string;
  appId: string;
  subject: string;
  url: string;
  /** Per-subscription secret used to sign delivered payloads. */
  secret: string;
  createdAt: number;
}

export interface WebhookStore {
  create(input: { appId: string; subject: string; url: string; secret: string }): Promise<WebhookSubscription>;
  delete(id: string, appId: string): Promise<boolean>;
  listForApp(appId: string): Promise<WebhookSubscription[]>;
  listForSubject(subject: string): Promise<WebhookSubscription[]>;
}

export class InMemoryWebhookStore implements WebhookStore {
  private subs = new Map<string, WebhookSubscription>();

  async create(input: { appId: string; subject: string; url: string; secret: string }): Promise<WebhookSubscription> {
    const sub: WebhookSubscription = {
      id: randomUUID(),
      appId: input.appId,
      subject: input.subject,
      url: input.url,
      secret: input.secret,
      createdAt: Date.now(),
    };
    this.subs.set(sub.id, sub);
    return sub;
  }

  async delete(id: string, appId: string): Promise<boolean> {
    const sub = this.subs.get(id);
    // Scope deletion to the owning app so one app can't delete another's sub.
    if (!sub || sub.appId !== appId) return false;
    return this.subs.delete(id);
  }

  async listForApp(appId: string): Promise<WebhookSubscription[]> {
    return [...this.subs.values()].filter((s) => s.appId === appId);
  }

  async listForSubject(subject: string): Promise<WebhookSubscription[]> {
    return [...this.subs.values()].filter((s) => s.subject === subject);
  }
}

let store: WebhookStore = new InMemoryWebhookStore();

export function setWebhookStore(next: WebhookStore): void {
  store = next;
}

export function resetWebhookStore(): void {
  store = new InMemoryWebhookStore();
}

export function getWebhookStore(): WebhookStore {
  return store;
}
