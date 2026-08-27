import { NextRequest, NextResponse } from 'next/server';

import { authenticateStateless } from '@/features/auth/request-session';
import type { Role } from '@/features/auth/types';

// Central enforcement for every subject- or staff-scoped route.
//
// Before this existed, each protected route carried its own ad hoc check — a
// shared secret header on risk-review, a trusted `subject` query param on
// consent, a client-side boolean on the admin page. This is the one place that
// decides whether a request is allowed to reach a handler at all.
//
// Middleware runs in the edge runtime and does not share module state with
// route handlers, so it verifies the access token cryptographically but cannot
// consult the session store. It is a fail-closed pre-filter; the authoritative
// check — session still live, roles resolved fresh, subject matches — is
// `requireSession` inside each handler. Both call the same verification code,
// so there is one implementation, applied twice, rather than two that drift.
//
// Not listed here: `/admin/review`. Session tokens live in `sessionStorage`, so
// a document navigation carries no credential middleware could read; that page
// gates itself on a server-checked role via `/api/v1/auth/sessions`. The data
// behind it is served by `api/internal/risk-review`, which *is* gated here — so
// the security boundary is enforced regardless of what the page renders.

interface ProtectedRoute {
  /** Matched against the pathname by prefix. */
  prefix: string;
  /** Role required to pass the pre-filter. Subject-scoped routes require only
   * a valid session here; the address-matching check belongs in the handler,
   * which can see the body or query it applies to. */
  role?: Role;
}

const PROTECTED: ProtectedRoute[] = [
  { prefix: '/api/v1/consent' },
  { prefix: '/api/v1/auth/sessions' },
  { prefix: '/api/internal/risk-review', role: 'reviewer' },
];

function match(pathname: string): ProtectedRoute | undefined {
  return PROTECTED.find(
    (route) => pathname === route.prefix || pathname.startsWith(`${route.prefix}/`),
  );
}

export async function middleware(req: NextRequest) {
  const route = match(req.nextUrl.pathname);
  if (!route) return NextResponse.next();

  const result = await authenticateStateless(req.headers, { role: route.role });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.next();
}

export const config = {
  // Kept in sync with PROTECTED above. Next requires these to be static
  // literals, so they cannot be derived from it at build time.
  matcher: ['/api/v1/consent/:path*', '/api/v1/auth/sessions/:path*', '/api/internal/risk-review/:path*'],
};
