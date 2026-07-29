// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Deletion cascade integration tests.
 * Uses real Zustand stores + real localStorage (jsdom) to confirm the
 * cascade removes data from every first-party store, not just the top-level score.
 */
describe('cascadeDeleteUserData — deletion cascade', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('clears all verification events after deletion', async () => {
    const { useVerificationStore } = await import(
      '@/features/verifications/store/verification-store'
    );
    const { cascadeDeleteUserData } = await import('../deletion-service');

    useVerificationStore.getState().completeVerification('google', 'social', 6);
    useVerificationStore.getState().completeVerification('github', 'social', 6);
    expect(useVerificationStore.getState().events).toHaveLength(2);

    cascadeDeleteUserData();

    expect(useVerificationStore.getState().events).toHaveLength(0);
  });

  it('clears all machine/session records after deletion', async () => {
    const { useVerificationStore } = await import(
      '@/features/verifications/store/verification-store'
    );
    const { cascadeDeleteUserData } = await import('../deletion-service');

    useVerificationStore.getState().dispatchMachineEvent('discord', { type: 'CONNECT' });
    useVerificationStore.getState().dispatchMachineEvent('discord', {
      type: 'AWAIT_EXTERNAL',
      nonce: 'abc',
      context: {},
    });
    expect(Object.keys(useVerificationStore.getState().machines)).toHaveLength(1);

    cascadeDeleteUserData();

    expect(Object.keys(useVerificationStore.getState().machines)).toHaveLength(0);
  });

  it('disconnects the wallet (clears publicKey, walletName, isConnected)', async () => {
    const { useWalletStore } = await import('@/features/wallet/store/wallet-store');
    const { cascadeDeleteUserData } = await import('../deletion-service');

    useWalletStore.getState().setWalletInfo('GABC123', 'Freighter');
    expect(useWalletStore.getState().isConnected).toBe(true);

    cascadeDeleteUserData();

    expect(useWalletStore.getState().publicKey).toBeNull();
    expect(useWalletStore.getState().walletName).toBeNull();
    expect(useWalletStore.getState().isConnected).toBe(false);
  });

  it('marks dataSubjectStatus as "deleted" in the audit log store', async () => {
    const { useAuditLogStore } = await import('../audit-log-store');
    const { cascadeDeleteUserData } = await import('../deletion-service');

    cascadeDeleteUserData();

    expect(useAuditLogStore.getState().dataSubjectStatus).toBe('deleted');
  });

  it('appends a "deletion" audit log entry with a timestamp', async () => {
    const { useAuditLogStore } = await import('../audit-log-store');
    const { cascadeDeleteUserData } = await import('../deletion-service');

    const before = Date.now();
    cascadeDeleteUserData();
    const after = Date.now();

    const entries = useAuditLogStore.getState().getEntries();
    const deletionEntry = entries.find((e) => e.action === 'deletion');
    expect(deletionEntry).toBeDefined();
    expect(deletionEntry!.timestamp).toBeGreaterThanOrEqual(before);
    expect(deletionEntry!.timestamp).toBeLessThanOrEqual(after);
  });

  it('post-deletion status is "deleted", not "never-verified"', async () => {
    const { useAuditLogStore } = await import('../audit-log-store');
    const { cascadeDeleteUserData } = await import('../deletion-service');

    cascadeDeleteUserData();

    const status = useAuditLogStore.getState().dataSubjectStatus;
    expect(status).toBe('deleted');
    expect(status).not.toBe('never-verified');
    expect(status).not.toBe('active');
  });

  it('returns a DeletionReport listing which stores were cleared', async () => {
    const { useVerificationStore } = await import(
      '@/features/verifications/store/verification-store'
    );
    const { cascadeDeleteUserData } = await import('../deletion-service');

    useVerificationStore.getState().completeVerification('google', 'social', 6);
    useVerificationStore.getState().completeVerification('github', 'social', 6);

    const report = cascadeDeleteUserData();

    expect(report.storesCleared).toContain('verification-storage');
    expect(report.storesCleared).toContain('wallet-storage');
    expect(report.eventsRemoved).toBe(2);
    expect(report.clearedAt).toBeGreaterThan(0);
  });

  it('audit log entries are preserved after deletion (7-year retention floor)', async () => {
    const { useAuditLogStore } = await import('../audit-log-store');
    const { cascadeDeleteUserData } = await import('../deletion-service');

    // Simulate a prior export entry
    useAuditLogStore.getState().appendEntry('export', { note: 'prior export' });
    const countBefore = useAuditLogStore.getState().getEntries().length;

    cascadeDeleteUserData();

    // Audit entries should only grow (deletion entry added), never shrink
    const countAfter = useAuditLogStore.getState().getEntries().length;
    expect(countAfter).toBeGreaterThan(countBefore);
    const priorExport = useAuditLogStore.getState().getEntries().find((e) => e.action === 'export');
    expect(priorExport).toBeDefined();
  });

  it('nothing silently retained — completedVerifications is empty post-deletion', async () => {
    const { useVerificationStore } = await import(
      '@/features/verifications/store/verification-store'
    );
    const { cascadeDeleteUserData } = await import('../deletion-service');

    useVerificationStore.getState().completeVerification('google', 'social', 6);
    useVerificationStore.getState().completeVerification('linkedin', 'social', 6);
    useVerificationStore.getState().completeVerification('government-id', 'physical', 1000);

    cascadeDeleteUserData();

    expect(useVerificationStore.getState().completedVerifications).toEqual({});
    expect(useVerificationStore.getState().isVerificationCompleted('google')).toBe(false);
    expect(useVerificationStore.getState().isVerificationCompleted('government-id')).toBe(false);
  });
});
