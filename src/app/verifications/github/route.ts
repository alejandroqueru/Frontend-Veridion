import { NextRequest, NextResponse } from 'next/server';
import { authenticateWithGitHub } from '@/features/verifications/components/social/github/github-api';
import { getOAuthRedirectUri } from '@/features/verifications/utils/oauth';

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json({ error: 'Authorization code is required' }, { status: 400 });
    }

    const redirectUri = getOAuthRedirectUri(request.nextUrl.origin);
    const user = await authenticateWithGitHub(code, redirectUri);

    return NextResponse.json({ success: true, user });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to authenticate with GitHub';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
