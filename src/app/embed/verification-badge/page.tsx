import { VerificationBadge } from '@/features/developer-api/components/verification-badge';

// Standalone page meant to be embedded via <iframe> (or the veridion-badge.js
// loader). Third parties point an iframe at:
//
//   https://<host>/embed/verification-badge?address=G...
//
// Serving the badge from its own page/iframe keeps it isolated from the host
// site: the host cannot read anything inside, and the badge cannot read the host.

export const dynamic = 'force-dynamic';

export default async function VerificationBadgePage({
  searchParams,
}: {
  searchParams: Promise<{ address?: string }>;
}) {
  const { address } = await searchParams;

  return (
    <div style={{ margin: 0, padding: 0, background: 'transparent' }}>
      {address ? (
        <VerificationBadge address={address} />
      ) : (
        <span
          role="status"
          style={{
            display: 'inline-flex',
            padding: '4px 10px',
            borderRadius: 9999,
            fontFamily: 'system-ui, sans-serif',
            fontSize: 13,
            fontWeight: 600,
            color: '#8a2b2b',
            background: '#fdeaea',
            border: '1px solid #e6a3a3',
          }}
        >
          Missing address
        </span>
      )}
    </div>
  );
}
