import { NextRequest, NextResponse } from 'next/server';

import { emitAuthEvent } from '@/features/auth/audit';
import { requireSession } from '@/features/auth/guard';
import { getSessionStore } from '@/features/auth/session-store';
import type { SessionFamily } from '@/features/auth/types';

// Device management: see where you are signed in, and sign out everywhere.
//
// Scoped to the caller's own address throughout — this is subject-scoped data,
// so no staff role grants a view of someone else's devices.

function present(family: SessionFamily, currentFamilyId: string) {
  return {
    familyId: family.familyId,
    device: family.device,
    createdAt: family.createdAt,
    lastRotatedAt: family.lastRotatedAt,
    /** Lets the UI label the row the user is reading this on. */
    current: family.familyId === currentFamilyId,
  };
}

/** List the caller's active session families. */
export async function GET(req: NextRequest) {
  const auth = await requireSession(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const families = await getSessionStore().listForAddress(auth.session.address);
  return NextResponse.json({
    address: auth.session.address,
    roles: auth.session.roles,
    sessions: families
      .sort((a, b) => b.lastRotatedAt - a.lastRotatedAt)
      .map((family) => present(family, auth.session.familyId)),
  });
}

/** Sign out everywhere: revoke every family for the caller's address. */
export async function DELETE(req: NextRequest) {
  const auth = await requireSession(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const revoked = await getSessionStore().deleteForAddress(auth.session.address);
  await emitAuthEvent({
    type: 'auth.session.revoked',
    address: auth.session.address,
    detail: { reason: 'sign-out-everywhere', revoked },
  });

  return NextResponse.json({ revoked });
}
