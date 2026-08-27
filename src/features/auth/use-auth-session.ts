'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useWallet } from '@/features/wallet/hooks/useWallet';

import {
  clearStoredSession,
  getAccessToken,
  readStoredSession,
  setAccessToken,
  writeStoredSession,
} from './client-tokens';
import type { Role } from './types';

// Orchestrates the whole session lifecycle for the UI: challenge → sign →
// verify, then refresh-on-demand, then sign-out.
//
// Components should not talk to `/api/v1/auth/*` themselves. They call
// `signIn`, and they make protected requests through `authorizedFetch`, which
// attaches the access token and transparently rotates a stale one. Keeping that
// in one hook is what stops "am I authenticated?" logic from being re-invented
// per screen.

export type AuthStatus = 'anonymous' | 'authenticating' | 'authenticated';

export interface DeviceSession {
  familyId: string;
  device: string;
  createdAt: number;
  lastRotatedAt: number;
  current: boolean;
}

interface VerifyResponse {
  address: string;
  roles: Role[];
  familyId: string;
  accessToken: string;
  refreshToken: string;
}

export function useAuthSession() {
  const { publicKey, signChallenge } = useWallet();

  const [status, setStatus] = useState<AuthStatus>('anonymous');
  const [address, setAddress] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Guards against two components mounting and both trying to restore at once.
  const restoring = useRef(false);

  const adopt = useCallback((session: VerifyResponse) => {
    setAccessToken(session.accessToken);
    writeStoredSession({
      refreshToken: session.refreshToken,
      address: session.address,
      roles: session.roles,
      familyId: session.familyId,
    });
    setAddress(session.address);
    setRoles(session.roles);
    setStatus('authenticated');
    setError(null);
  }, []);

  const forget = useCallback(() => {
    clearStoredSession();
    setAddress(null);
    setRoles([]);
    setStatus('anonymous');
  }, []);

  /** Exchange the stored refresh token for a fresh access token. */
  const refresh = useCallback(async (): Promise<boolean> => {
    const stored = readStoredSession();
    if (!stored) return false;

    const res = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: stored.refreshToken }),
    });

    if (!res.ok) {
      // A refused refresh means the session is gone — expired, revoked, or
      // burned by reuse detection. There is nothing to salvage.
      forget();
      return false;
    }

    adopt((await res.json()) as VerifyResponse);
    return true;
  }, [adopt, forget]);

  // On mount, rotate a stored refresh token back into a usable session. The
  // access token was never persisted, so this is the only way back in without
  // asking the user to sign again.
  useEffect(() => {
    if (restoring.current || getAccessToken()) return;
    if (!readStoredSession()) return;

    restoring.current = true;
    setStatus('authenticating');
    void refresh().finally(() => {
      restoring.current = false;
      setStatus((current) => (current === 'authenticating' ? 'anonymous' : current));
    });
  }, [refresh]);

  /** Prove control of the connected wallet and open a session. */
  const signIn = useCallback(async (): Promise<boolean> => {
    if (!publicKey) {
      setError('Connect a wallet first.');
      return false;
    }

    setStatus('authenticating');
    setError(null);

    try {
      const challengeRes = await fetch('/api/v1/auth/challenge', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address: publicKey }),
      });
      if (!challengeRes.ok) throw new Error('Could not start authentication. Try again.');

      const { message } = (await challengeRes.json()) as { message: string };

      // Throws if the user declines the prompt or the adapter fails.
      const signature = await signChallenge(message);

      const verifyRes = await fetch('/api/v1/auth/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address: publicKey, signature }),
      });
      if (!verifyRes.ok) throw new Error('Signature was not accepted. Try again.');

      adopt((await verifyRes.json()) as VerifyResponse);
      return true;
    } catch (caught) {
      const message =
        typeof caught === 'object' && caught !== null && 'message' in caught
          ? String((caught as { message: unknown }).message)
          : 'Authentication failed.';
      setError(message);
      setStatus('anonymous');
      return false;
    }
  }, [publicKey, signChallenge, adopt]);

  /**
   * `fetch` for protected endpoints: attaches the access token, and on a 401
   * rotates once and retries.
   *
   * The single retry is deliberate — if a freshly refreshed token is still
   * rejected, the session is genuinely gone and retrying again would just loop.
   */
  const authorizedFetch = useCallback(
    async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
      const withAuth = (token: string | null): RequestInit => ({
        ...init,
        headers: {
          ...(init.headers ?? {}),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
      });

      let token = getAccessToken();
      if (!token && (await refresh())) token = getAccessToken();

      const res = await fetch(input, withAuth(token));
      if (res.status !== 401) return res;

      if (!(await refresh())) return res;
      return fetch(input, withAuth(getAccessToken()));
    },
    [refresh],
  );

  /** List the devices this address is signed in on. */
  const listSessions = useCallback(async (): Promise<DeviceSession[]> => {
    const res = await authorizedFetch('/api/v1/auth/sessions');
    if (!res.ok) return [];
    const body = (await res.json()) as { sessions: DeviceSession[] };
    return body.sessions;
  }, [authorizedFetch]);

  /** Revoke one device. Revoking your own ends this session too. */
  const revokeSession = useCallback(
    async (familyId: string): Promise<boolean> => {
      const res = await authorizedFetch(`/api/v1/auth/sessions/${encodeURIComponent(familyId)}`, {
        method: 'DELETE',
      });
      if (res.ok && readStoredSession()?.familyId === familyId) forget();
      return res.ok;
    },
    [authorizedFetch, forget],
  );

  /** Sign out everywhere: revoke every family for this address. */
  const signOutEverywhere = useCallback(async (): Promise<boolean> => {
    const res = await authorizedFetch('/api/v1/auth/sessions', { method: 'DELETE' });
    if (res.ok) forget();
    return res.ok;
  }, [authorizedFetch, forget]);

  return {
    status,
    address,
    roles,
    error,
    isAuthenticated: status === 'authenticated',
    signIn,
    signOut: forget,
    refresh,
    authorizedFetch,
    listSessions,
    revokeSession,
    signOutEverywhere,
  };
}
