import type { Role } from './types';

// Client-side token custody.
//
// Split deliberately:
//   * the access token lives in module memory only. It never touches storage,
//     so no XSS-readable slot holds a directly usable credential, and closing
//     the tab loses it.
//   * the refresh token and identity live in `sessionStorage`, so a page reload
//     restores the session by rotating rather than by prompting for another
//     wallet signature.
//
// Never `localStorage`: sessions are meant to expire, and a credential that
// outlives the browsing session silently outlives its TTL.

const STORAGE_KEY = 'veridion.session';

export interface StoredSession {
  refreshToken: string;
  address: string;
  roles: Role[];
  familyId: string;
}

/** Access token, in memory for the life of the page. */
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

function storage(): Storage | null {
  // Guarded for SSR and for browsers that block storage entirely.
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readStoredSession(): StoredSession | null {
  const store = storage();
  if (!store) return null;

  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (typeof parsed.refreshToken !== 'string' || typeof parsed.address !== 'string') return null;
    return {
      refreshToken: parsed.refreshToken,
      address: parsed.address,
      roles: Array.isArray(parsed.roles) ? (parsed.roles as Role[]) : [],
      familyId: typeof parsed.familyId === 'string' ? parsed.familyId : '',
    };
  } catch {
    return null;
  }
}

export function writeStoredSession(session: StoredSession): void {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // A blocked storage costs a re-sign on reload, nothing more.
  }
}

export function clearStoredSession(): void {
  accessToken = null;
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    // Nothing useful to do; the in-memory token is already gone.
  }
}
