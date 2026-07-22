import { NextRequest, NextResponse } from 'next/server';
import { authenticateWithLinkedIn } from '@/features/verifications/components/social/linkedin/linkedin-api';
import { getOAuthRedirectUri } from '@/features/verifications/utils/oauth';

/**
 * Previously LinkedIn was the only provider whose token exchange ran
 * client-side (`linkedin-api.ts` imported dynamically from `linkedin-auth.tsx`),
 * reading `LINKEDIN_CLIENT_SECRET` — a non-`NEXT_PUBLIC_` var that is
 * `undefined` in the browser bundle, so the flow threw whenever exercised.
 * Moving the exchange here (server-side, where that secret is actually
 * available) is both the fix and the only place a client secret should ever
 * be used.
 */
export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json({ error: 'Authorization code is required' }, { status: 400 });
    }

    const redirectUri = getOAuthRedirectUri(request.nextUrl.origin);
    const user = await authenticateWithLinkedIn(code, redirectUri);

    return NextResponse.json({ success: true, user });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to authenticate with LinkedIn';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
