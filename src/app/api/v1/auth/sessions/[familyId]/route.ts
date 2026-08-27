import { NextRequest, NextResponse } from 'next/server';

import { emitAuthEvent } from '@/features/auth/audit';
import { requireSession } from '@/features/auth/guard';
import { getSessionStore } from '@/features/auth/session-store';

interface RouteContext {
  params: Promise<{ familyId: string }>;
}

/** Revoke one device: sign out the named session family. */
export async function DELETE(req: NextRequest, context: RouteContext) {
  const auth = await requireSession(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { familyId } = await context.params;
  const family = await getSessionStore().get(familyId);

  // A family belonging to someone else is reported as "not found", not
  // "forbidden": the difference would confirm that a given family id exists.
  if (!family || family.address !== auth.session.address) {
    return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
  }

  await getSessionStore().delete(familyId);
  await emitAuthEvent({
    type: 'auth.session.revoked',
    address: auth.session.address,
    familyId,
    detail: { reason: 'revoked-by-user', self: familyId === auth.session.familyId },
  });

  return NextResponse.json({ revoked: familyId });
}
