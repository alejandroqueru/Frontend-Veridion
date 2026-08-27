import { describe, expect, it } from 'vitest';

import { hasRole, requireRole, resolveRoles } from './roles';

const ALICE = `G${'A'.repeat(55)}`;
const BOB = `G${'B'.repeat(55)}`;

describe('resolveRoles', () => {
  it('gives every authenticated address the implicit subject role', () => {
    expect(resolveRoles(ALICE, {})).toEqual(['subject']);
  });

  it('reads staff roles from the server-held allowlist', () => {
    expect(resolveRoles(ALICE, { VERIDION_REVIEWER_ADDRESSES: ALICE })).toEqual(['subject', 'reviewer']);
    expect(resolveRoles(ALICE, { VERIDION_ADMIN_ADDRESSES: `${BOB},${ALICE}` })).toEqual(['subject', 'admin']);
  });

  it('tolerates whitespace and empty entries in the allowlist', () => {
    expect(resolveRoles(ALICE, { VERIDION_REVIEWER_ADDRESSES: ` ${ALICE} , ,` })).toContain('reviewer');
  });

  it('does not grant a staff role to an address that is not listed', () => {
    expect(resolveRoles(BOB, { VERIDION_REVIEWER_ADDRESSES: ALICE })).toEqual(['subject']);
  });
});

describe('hasRole', () => {
  it('honors role implication downward', () => {
    expect(hasRole(['admin'], 'reviewer')).toBe(true);
    expect(hasRole(['senior-reviewer'], 'reviewer')).toBe(true);
  });

  it('does not imply upward', () => {
    expect(hasRole(['reviewer'], 'senior-reviewer')).toBe(false);
    expect(hasRole(['reviewer'], 'admin')).toBe(false);
  });

  it('does not let a staff role stand in for subject authority', () => {
    // `subject` authorizes acting on your own address; it is not something an
    // admin role confers over someone else's data.
    expect(hasRole(['admin'], 'subject')).toBe(false);
  });
});

describe('requireRole', () => {
  it('allows a satisfied role', () => {
    expect(requireRole(['subject', 'reviewer'], 'reviewer')).toEqual({ ok: true });
  });

  it('rejects a missing role with 403', () => {
    const result = requireRole(['subject'], 'reviewer');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });
});
