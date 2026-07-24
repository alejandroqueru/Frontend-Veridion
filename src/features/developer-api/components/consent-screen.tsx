'use client';

import { useCallback, useEffect, useState } from 'react';

import type { ConsentRecord } from '../consent-store';

// User-facing consent screen: shows what an app is requesting and lets the user
// Allow / Deny, plus a list of existing grants they can revoke at any time.
// Talks to /api/v1/consent. Styling is intentionally minimal and inline.

interface ConsentScreenProps {
  appId: string;
  appName: string;
  subject: string;
}

type Decision = 'pending' | 'granted' | 'denied';

const card: React.CSSProperties = {
  maxWidth: 460,
  margin: '40px auto',
  padding: 24,
  borderRadius: 12,
  border: '1px solid #e2e5ea',
  background: '#ffffff',
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  color: '#1c2430',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

const button = (variant: 'primary' | 'ghost'): React.CSSProperties => ({
  flex: 1,
  padding: '10px 16px',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  border: variant === 'primary' ? '1px solid #0f7b3f' : '1px solid #d7dbe0',
  background: variant === 'primary' ? '#0f7b3f' : '#ffffff',
  color: variant === 'primary' ? '#ffffff' : '#3a4250',
});

export function ConsentScreen({ appId, appName, subject }: ConsentScreenProps) {
  const [decision, setDecision] = useState<Decision>('pending');
  const [grants, setGrants] = useState<ConsentRecord[]>([]);
  const [busy, setBusy] = useState(false);

  const refreshGrants = useCallback(async () => {
    const res = await fetch(`/api/v1/consent?subject=${encodeURIComponent(subject)}`);
    if (res.ok) {
      const body = (await res.json()) as { grants: ConsentRecord[] };
      setGrants(body.grants);
    }
  }, [subject]);

  useEffect(() => {
    void refreshGrants();
  }, [refreshGrants]);

  const allow = async () => {
    setBusy(true);
    try {
      await fetch('/api/v1/consent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ appId, subject }),
      });
      setDecision('granted');
      await refreshGrants();
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (grant: ConsentRecord) => {
    setBusy(true);
    try {
      await fetch(
        `/api/v1/consent?appId=${encodeURIComponent(grant.appId)}&subject=${encodeURIComponent(grant.subject)}`,
        { method: 'DELETE' },
      );
      if (grant.appId === appId) setDecision('denied');
      await refreshGrants();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={card}>
      <h1 style={{ fontSize: 18, margin: '0 0 4px' }}>Authorize access</h1>
      <p style={{ fontSize: 14, color: '#5b6470', margin: '0 0 16px' }}>
        <strong>{appName}</strong> is requesting permission to read your Veridion verification status.
      </p>
      <div style={{ fontSize: 12, color: '#8a93a0', margin: '0 0 20px', wordBreak: 'break-all' }}>
        Subject: {subject}
      </div>

      {decision === 'granted' ? (
        <div role="status" style={{ color: '#0f7b3f', fontWeight: 600, fontSize: 14 }}>
          ✓ Access granted to {appName}. You can revoke it below at any time.
        </div>
      ) : decision === 'denied' ? (
        <div role="status" style={{ color: '#8a2b2b', fontWeight: 600, fontSize: 14 }}>
          Access denied. {appName} cannot read your data.
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 12 }}>
          <button style={button('primary')} onClick={allow} disabled={busy}>
            Allow
          </button>
          <button style={button('ghost')} onClick={() => setDecision('denied')} disabled={busy}>
            Deny
          </button>
        </div>
      )}

      <div style={{ marginTop: 24, borderTop: '1px solid #eef0f3', paddingTop: 16 }}>
        <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: '#8a93a0', margin: '0 0 10px' }}>
          Authorized applications
        </h2>
        {grants.length === 0 ? (
          <p style={{ fontSize: 13, color: '#8a93a0', margin: 0 }}>No applications authorized yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {grants.map((grant) => (
              <li
                key={grant.appId}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 13 }}
              >
                <span style={{ wordBreak: 'break-all' }}>{grant.appId}</span>
                <button
                  style={{ ...button('ghost'), flex: 'none', padding: '6px 12px', color: '#8a2b2b', borderColor: '#e6a3a3' }}
                  onClick={() => revoke(grant)}
                  disabled={busy}
                  aria-label={`Revoke ${grant.appId}`}
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
