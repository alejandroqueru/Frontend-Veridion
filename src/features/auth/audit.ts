import type { AuthEvent, AuthEventType } from './types';

// Authentication audit events.
//
// Scope split, per issue #29: this feature *defines and emits* the auth event
// types; the application-wide audit platform (issue #30) owns hash-chained,
// tamper-evident storage and integrity verification. Until that platform lands,
// events go to an in-memory sink with the same swappable-store convention used
// elsewhere in this codebase — so wiring #30 in is `setAuthAuditSink(...)` and
// nothing else in this feature changes.
//
// Emitting must never break authentication: a sink that throws is swallowed. A
// failed audit write is a monitoring problem, not a reason to lock users out.

export interface AuthAuditSink {
  record(event: AuthEvent): Promise<void>;
  /** Read back recent events. The durable platform will offer richer querying;
   * this is the minimum the acceptance criteria need. */
  list(): Promise<AuthEvent[]>;
}

/** Bounded so a long-running demo instance cannot grow without limit. */
const MAX_RETAINED = 1000;

export class InMemoryAuthAuditSink implements AuthAuditSink {
  private events: AuthEvent[] = [];

  async record(event: AuthEvent): Promise<void> {
    this.events.push(event);
    if (this.events.length > MAX_RETAINED) {
      this.events.splice(0, this.events.length - MAX_RETAINED);
    }
  }

  async list(): Promise<AuthEvent[]> {
    return [...this.events];
  }
}

let sink: AuthAuditSink = new InMemoryAuthAuditSink();

/** Point auth auditing at the durable audit platform (issue #30). */
export function setAuthAuditSink(next: AuthAuditSink): void {
  sink = next;
}

/** Reset to a fresh in-memory sink — primarily for tests. */
export function resetAuthAuditSink(): void {
  sink = new InMemoryAuthAuditSink();
}

export function getAuthAuditSink(): AuthAuditSink {
  return sink;
}

export interface EmitAuthEventInput {
  type: AuthEventType;
  address?: string;
  familyId?: string;
  detail?: Record<string, string | number | boolean>;
}

/** Emit an auth-lifecycle event. Never throws. */
export async function emitAuthEvent(input: EmitAuthEventInput): Promise<void> {
  try {
    await sink.record({ ...input, at: Date.now() });
  } catch {
    // Deliberately swallowed — see module header.
  }
}
