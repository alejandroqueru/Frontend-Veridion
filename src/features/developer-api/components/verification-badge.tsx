'use client';

import { useEffect, useState } from 'react';

// Self-contained, framework-light badge. Uses inline styles (not the host's CSS)
// so it renders identically wherever it is embedded — typically inside an
// <iframe> served from the /embed/verification-badge page.
//
// It degrades gracefully across every state and never shows more than a
// verified/unverified signal.

type BadgeState = 'loading' | 'verified' | 'unverified' | 'error';

const STELLAR_ADDRESS = /^G[A-Z2-7]{55}$/;

const PALETTE: Record<Exclude<BadgeState, 'loading'>, { fg: string; bg: string; border: string; label: string; icon: string }> = {
  verified: { fg: '#0f7b3f', bg: '#e8f7ee', border: '#9ad9b4', label: 'Verified by Veridion', icon: '✓' },
  unverified: { fg: '#8a6d1f', bg: '#fdf6e3', border: '#e6d29a', label: 'Not verified', icon: '—' },
  error: { fg: '#8a2b2b', bg: '#fdeaea', border: '#e6a3a3', label: 'Verification unavailable', icon: '!' },
};

export interface VerificationBadgeProps {
  address: string;
  /** Base URL of the badge API; defaults to same-origin. */
  apiBase?: string;
}

export function VerificationBadge({ address, apiBase = '' }: VerificationBadgeProps) {
  const [state, setState] = useState<BadgeState>('loading');

  useEffect(() => {
    let cancelled = false;

    if (!STELLAR_ADDRESS.test(address)) {
      setState('error');
      return;
    }

    setState('loading');
    fetch(`${apiBase}/api/v1/public/verification-badge?address=${encodeURIComponent(address)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ status?: string }>;
      })
      .then((body) => {
        if (cancelled) return;
        setState(body.status === 'verified' ? 'verified' : 'unverified');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [address, apiBase]);

  const containerStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 9999,
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.4,
    border: '1px solid',
    whiteSpace: 'nowrap',
  };

  if (state === 'loading') {
    return (
      <span
        role="status"
        aria-label="Checking verification"
        style={{ ...containerStyle, color: '#5b6470', background: '#f1f3f5', borderColor: '#d7dbe0' }}
      >
        <span aria-hidden style={{ opacity: 0.7 }}>
          …
        </span>
        Checking…
      </span>
    );
  }

  const p = PALETTE[state];
  return (
    <span
      role="status"
      aria-label={p.label}
      style={{ ...containerStyle, color: p.fg, background: p.bg, borderColor: p.border }}
    >
      <span
        aria-hidden
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 16,
          height: 16,
          borderRadius: 9999,
          background: p.fg,
          color: p.bg,
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        {p.icon}
      </span>
      {p.label}
    </span>
  );
}
