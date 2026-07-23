// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
import { useOAuthProvider } from '../use-oauth-provider';
import { useVerificationStore } from '../../store/verification-store';

function setSearch(search: string) {
  window.history.pushState({}, '', `/dashboard${search}`);
}

describe('useOAuthProvider — resumable OAuth redirect flow', () => {
  beforeEach(() => {
    localStorage.clear();
    useVerificationStore.setState({ events: [], completedVerifications: {}, machines: {} });
    setSearch('');
    vi.restoreAllMocks();
  });

  it('resumes and completes the exchange when the browser returns with a code matching the persisted nonce', async () => {
    // Simulates the attempt having been started (and the nonce persisted)
    // before the browser navigated away — as if the tab/browser was closed
    // mid-redirect and reopened later on this same URL.
    useVerificationStore.getState().dispatchMachineEvent('github', { type: 'CONNECT' });
    useVerificationStore.getState().dispatchMachineEvent('github', { type: 'AWAIT_EXTERNAL', nonce: 'resume-nonce' });
    setSearch('?code=abc123&state=resume-nonce');

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, user: { login: 'octocat' } }),
    }) as unknown as typeof fetch;

    const onSuccess = vi.fn();
    renderHook(() =>
      useOAuthProvider({
        providerId: 'github',
        points: 6,
        clientId: 'client-id',
        exchangeEndpoint: '/verifications/github',
        buildAuthorizeUrl: () => 'https://github.com/login/oauth/authorize',
        onSuccess,
      }),
    );

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ login: 'octocat' }));
    expect(useVerificationStore.getState().isVerificationCompleted('github')).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      '/verifications/github',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ code: 'abc123' }) }),
    );
  });

  it('ignores a callback whose state does not match the persisted nonce (stale attempt / CSRF)', async () => {
    useVerificationStore.getState().dispatchMachineEvent('github', { type: 'CONNECT' });
    useVerificationStore.getState().dispatchMachineEvent('github', { type: 'AWAIT_EXTERNAL', nonce: 'expected-nonce' });
    setSearch('?code=abc123&state=someone-elses-nonce');

    global.fetch = vi.fn();

    renderHook(() =>
      useOAuthProvider({
        providerId: 'github',
        points: 6,
        clientId: 'client-id',
        exchangeEndpoint: '/verifications/github',
        buildAuthorizeUrl: () => 'https://github.com/login/oauth/authorize',
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetch).not.toHaveBeenCalled();
    expect(useVerificationStore.getState().getMachineState('github').status).toBe('pending_external');
  });

  it('does nothing when there is no in-flight attempt recorded, even if code/state are present', async () => {
    setSearch('?code=abc123&state=anything');
    global.fetch = vi.fn();

    renderHook(() =>
      useOAuthProvider({
        providerId: 'github',
        points: 6,
        clientId: 'client-id',
        exchangeEndpoint: '/verifications/github',
        buildAuthorizeUrl: () => 'https://github.com/login/oauth/authorize',
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('transitions to failed and surfaces the error when the exchange call is rejected', async () => {
    useVerificationStore.getState().dispatchMachineEvent('discord', { type: 'CONNECT' });
    useVerificationStore.getState().dispatchMachineEvent('discord', { type: 'AWAIT_EXTERNAL', nonce: 'n1' });
    setSearch('?code=bad-code&state=n1');

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'invalid code' }),
    }) as unknown as typeof fetch;

    const onError = vi.fn();
    const { result } = renderHook(() =>
      useOAuthProvider({
        providerId: 'discord',
        points: 6,
        clientId: 'client-id',
        exchangeEndpoint: '/verifications/discord',
        buildAuthorizeUrl: () => 'https://discord.com/api/oauth2/authorize',
        onError,
      }),
    );

    await waitFor(() => expect(result.current.status).toBe('failed'));
    expect(result.current.error).toBe('invalid code');
    expect(onError).toHaveBeenCalled();
    expect(useVerificationStore.getState().isVerificationCompleted('discord')).toBe(false);
  });

  it('reports a configuration error immediately when the client ID is missing, without touching the network', () => {
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useOAuthProvider({
        providerId: 'linkedin',
        points: 6,
        clientId: undefined,
        exchangeEndpoint: '/verifications/linkedin',
        buildAuthorizeUrl: () => 'https://www.linkedin.com/oauth/v2/authorization',
        onError,
      }),
    );

    act(() => {
      result.current.start();
    });

    expect(result.current.status).toBe('failed');
    expect(onError).toHaveBeenCalled();
  });
});
