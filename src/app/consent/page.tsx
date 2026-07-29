import { ConsentScreen } from '@/features/developer-api/components/consent-screen';

// Consent authorization screen. A third-party app sends the user here to grant
// access, e.g.:
//   /consent?appId=<app>&appName=<name>&subject=G...
//
// DEMO NOTE: in production this page must authenticate the user (wallet
// signature) and derive `subject` from that session rather than the query
// string. See src/app/api/v1/consent/route.ts.

export const dynamic = 'force-dynamic';

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ appId?: string; appName?: string; subject?: string }>;
}) {
  const { appId, appName, subject } = await searchParams;

  if (!appId || !subject) {
    return (
      <div style={{ maxWidth: 460, margin: '40px auto', fontFamily: 'system-ui, sans-serif', color: '#8a2b2b' }}>
        Missing <code>appId</code> or <code>subject</code>.
      </div>
    );
  }

  return <ConsentScreen appId={appId} appName={appName ?? appId} subject={subject} />;
}
