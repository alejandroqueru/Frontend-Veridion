// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Audit log store integration tests.
 * Uses real Zustand persist + real localStorage (jsdom) to confirm
 * the append-only invariant, immutability guarantees, and persistence.
 */
describe('useAuditLogStore — append-only audit log', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('starts with an empty entries array and "never-verified" status', async () => {
    const { useAuditLogStore } = await import('../audit-log-store');
    expect(useAuditLogStore.getState().getEntries()).toHaveLength(0);
    expect(useAuditLogStore.getState().dataSubjectStatus).toBe('never-verified');
  });

  it('appendEntry makes the entry readable via getEntries()', async () => {
    const { useAuditLogStore } = await import('../audit-log-store');
    useAuditLogStore.getState().appendEntry('export', { note: 'first export' });
    const entries = useAuditLogStore.getState().getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe('export');
    expect(entries[0].details.note).toBe('first export');
  });

  it('entries are Object.frozen after appending and cannot be mutated', async () => {
    const { useAuditLogStore } = await import('../audit-log-store');
    useAuditLogStore.getState().appendEntry('access', { providerId: 'google' });
    const entries = useAuditLogStore.getState().getEntries();
    const entry = entries[0];

    expect(Object.isFrozen(entry)).toBe(true);
    // Attempting to mutate a frozen object should throw in strict mode or silently fail
    expect(() => {
      (entry as Record<string, unknown>).action = 'deletion';
    }).toThrow();
  });

  it('entry details are also frozen', async () => {
    const { useAuditLogStore } = await import('../audit-log-store');
    useAuditLogStore.getState().appendEntry('access', { providerId: 'github' });
    const entry = useAuditLogStore.getState().getEntries()[0];
    expect(Object.isFrozen(entry.details)).toBe(true);
  });

  it('a second appendEntry does not overwrite the first', async () => {
    const { useAuditLogStore } = await import('../audit-log-store');
    useAuditLogStore.getState().appendEntry('export', { exportNum: 1 });
    useAuditLogStore.getState().appendEntry('access', { providerId: 'github' });
    const entries = useAuditLogStore.getState().getEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0].action).toBe('export');
    expect(entries[1].action).toBe('access');
  });

  it('markDeleted sets dataSubjectStatus to "deleted" and appends a deletion entry', async () => {
    const { useAuditLogStore } = await import('../audit-log-store');
    useAuditLogStore.getState().markDeleted();
    expect(useAuditLogStore.getState().dataSubjectStatus).toBe('deleted');
    const entries = useAuditLogStore.getState().getEntries();
    expect(entries.find((e) => e.action === 'deletion')).toBeDefined();
  });

  it('each entry has a unique id', async () => {
    const { useAuditLogStore } = await import('../audit-log-store');
    useAuditLogStore.getState().appendEntry('export');
    useAuditLogStore.getState().appendEntry('access', { providerId: 'google' });
    useAuditLogStore.getState().appendEntry('export');
    const entries = useAuditLogStore.getState().getEntries();
    const ids = entries.map((e) => e.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('entries persist across simulated page reloads (same localStorage)', async () => {
    const { useAuditLogStore } = await import('../audit-log-store');
    useAuditLogStore.getState().appendEntry('export', { session: 1 });
    expect(useAuditLogStore.getState().getEntries()).toHaveLength(1);

    // Simulate page reload: fresh module import against same localStorage
    vi.resetModules();
    const { useAuditLogStore: reloaded } = await import('../audit-log-store');
    const entries = reloaded.getState().getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe('export');
  });

  it('re-frozen entries from rehydration are still immutable', async () => {
    const { useAuditLogStore } = await import('../audit-log-store');
    useAuditLogStore.getState().appendEntry('access', { providerId: 'discord' });

    vi.resetModules();
    const { useAuditLogStore: reloaded } = await import('../audit-log-store');
    const entry = reloaded.getState().getEntries()[0];

    expect(Object.isFrozen(entry)).toBe(true);
    expect(() => {
      (entry as Record<string, unknown>).timestamp = 0;
    }).toThrow();
  });

  it('appendEntry records both export and deletion events accurately', async () => {
    const { useAuditLogStore } = await import('../audit-log-store');
    const beforeExport = Date.now();
    useAuditLogStore.getState().appendEntry('export', { note: 'user-triggered' });
    const beforeDeletion = Date.now();
    useAuditLogStore.getState().markDeleted();
    const after = Date.now();

    const entries = useAuditLogStore.getState().getEntries();
    const exportEntry = entries.find((e) => e.action === 'export')!;
    const deletionEntry = entries.find((e) => e.action === 'deletion')!;

    expect(exportEntry.timestamp).toBeGreaterThanOrEqual(beforeExport);
    expect(deletionEntry.timestamp).toBeGreaterThanOrEqual(beforeDeletion);
    expect(deletionEntry.timestamp).toBeLessThanOrEqual(after);
    expect(exportEntry.details.note).toBe('user-triggered');
  });
});
