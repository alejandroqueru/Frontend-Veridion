import { describe, it, expect } from 'vitest';
import { buildDataExport } from '../export-service';
import type { VerificationEvent } from '@/features/scoring/types';
import type { VerificationStatus } from '@/features/verifications/store/verification-store';
import type { AuditLogEntry } from '../types';

// ── Fixtures ──────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<VerificationEvent> = {}): VerificationEvent {
  return {
    eventId: 'e1',
    providerId: 'google',
    category: 'social',
    occurredAt: 1_700_000_000_000,
    algorithmVersionAtCapture: 'v2',
    rawPayload: { legacyPoints: 6 },
    source: 'live',
    ...overrides,
  };
}

function makeStatus(id: string): VerificationStatus {
  return { id: id as VerificationStatus['id'], type: 'social', completed: true, points: 6 };
}

function makeAuditEntry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return Object.freeze({
    id: 'audit-1',
    timestamp: 1_700_000_000_001,
    action: 'access' as const,
    details: { providerId: 'google' },
    ...overrides,
  });
}

const baseWallet = { publicKey: 'GABC123', walletName: 'Freighter', network: 'testnet' as const };

// ── Tests ─────────────────────────────────────────────────────────────

describe('buildDataExport — export completeness', () => {
  it('includes all verification events in the export', () => {
    const events = [makeEvent({ eventId: 'e1' }), makeEvent({ eventId: 'e2', providerId: 'github' })];
    const payload = buildDataExport({
      events,
      completedVerifications: {},
      walletState: baseWallet,
      auditEntries: [],
    });
    expect(payload.verificationEvents).toHaveLength(2);
    expect(payload.verificationEvents[0].eventId).toBe('e1');
    expect(payload.verificationEvents[1].eventId).toBe('e2');
  });

  it('includes completedVerifications map', () => {
    const completed = { google: makeStatus('google'), github: makeStatus('github') };
    const payload = buildDataExport({
      events: [],
      completedVerifications: completed,
      walletState: baseWallet,
      auditEntries: [],
    });
    expect(Object.keys(payload.completedVerifications)).toHaveLength(2);
    expect(payload.completedVerifications.google?.completed).toBe(true);
  });

  it('includes wallet metadata (publicKey, walletName, network)', () => {
    const payload = buildDataExport({
      events: [],
      completedVerifications: {},
      walletState: { publicKey: 'GABC', walletName: 'Lobstr', network: 'mainnet' },
      auditEntries: [],
    });
    expect(payload.wallet.publicKey).toBe('GABC');
    expect(payload.wallet.walletName).toBe('Lobstr');
    expect(payload.wallet.network).toBe('mainnet');
  });

  it('includes the audit log entries', () => {
    const entries = [makeAuditEntry(), makeAuditEntry({ id: 'audit-2', action: 'export' })];
    const payload = buildDataExport({
      events: [],
      completedVerifications: {},
      walletState: baseWallet,
      auditEntries: entries,
    });
    expect(payload.auditLog).toHaveLength(2);
    expect(payload.auditLog[0].action).toBe('access');
    expect(payload.auditLog[1].action).toBe('export');
  });

  it('does NOT include machine/session state (excluded by design)', () => {
    const payload = buildDataExport({
      events: [],
      completedVerifications: {},
      walletState: baseWallet,
      auditEntries: [],
    });
    // DataExportPayload type has no 'machines' field — this is a type-level guarantee.
    // At runtime the key simply must not exist.
    expect('machines' in payload).toBe(false);
  });

  it('produces valid JSON with required schema fields', () => {
    const payload = buildDataExport({
      events: [makeEvent()],
      completedVerifications: { google: makeStatus('google') },
      walletState: baseWallet,
      auditEntries: [makeAuditEntry()],
    });

    // Must serialize without throwing
    const json = JSON.stringify(payload);
    const parsed = JSON.parse(json);

    expect(parsed.schemaVersion).toBe('1.0');
    expect(typeof parsed.exportedAt).toBe('string');
    expect(new Date(parsed.exportedAt).getTime()).toBeGreaterThan(0);
    expect(parsed.subject.walletPublicKey).toBe('GABC123');
  });

  it('export object is structurally independent of the source arrays (no shared references)', () => {
    const events = [makeEvent()];
    const payload = buildDataExport({
      events,
      completedVerifications: {},
      walletState: baseWallet,
      auditEntries: [],
    });

    // Mutating the original array does not affect the export
    events.push(makeEvent({ eventId: 'e-late' }));
    expect(payload.verificationEvents).toHaveLength(1);
  });

  it('handles an empty store snapshot gracefully (no events, no wallet)', () => {
    const payload = buildDataExport({
      events: [],
      completedVerifications: {},
      walletState: { publicKey: null, walletName: null, network: 'testnet' },
      auditEntries: [],
    });
    expect(payload.verificationEvents).toHaveLength(0);
    expect(payload.wallet.publicKey).toBeNull();
    expect(payload.schemaVersion).toBe('1.0');
  });
});
