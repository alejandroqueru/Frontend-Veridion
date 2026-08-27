// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConsentScreen } from './consent-screen';

const ADDRESS = `G${'A'.repeat(55)}`;
const OTHER_ADDRESS = `G${'B'.repeat(55)}`;

// The screen drives the session through `useAuthSession`, so that hook is the
// seam: mocking it lets each test stage one outcome of the wallet prompt
// (accepted, declined, adapter error) without a browser extension.
const session = {
  status: 'anonymous' as 'anonymous' | 'authenticating' | 'authenticated',
  address: null as string | null,
  isAuthenticated: false,
  error: null as string | null,
  signIn: vi.fn(),
  authorizedFetch: vi.fn(),
};

vi.mock('@/features/auth/use-auth-session', () => ({
  useAuthSession: () => session,
}));

/** Default: every request succeeds and the grant list is empty. */
function respondOk() {
  session.authorizedFetch.mockImplementation((_url: string, init?: RequestInit) =>
    Promise.resolve({
      ok: true,
      json: async () => (init?.method === 'POST' ? { granted: true } : { grants: [] }),
    }),
  );
}

/** Put the screen in the state a user reaches after a successful signature. */
function alreadySignedIn() {
  session.status = 'authenticated';
  session.address = ADDRESS;
  session.isAuthenticated = true;
}

beforeEach(() => {
  session.status = 'anonymous';
  session.address = null;
  session.isAuthenticated = false;
  session.error = null;
  session.signIn = vi.fn().mockResolvedValue(true);
  session.authorizedFetch = vi.fn();
  respondOk();
});

afterEach(() => vi.restoreAllMocks());

describe('ConsentScreen — signing prompt', () => {
  it('asks the user to sign before granting, and explains why', () => {
    render(<ConsentScreen appId="app-1" appName="Acme Wallet" subject={ADDRESS} />);

    expect(screen.getByText('Acme Wallet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign to allow' })).toBeInTheDocument();
    expect(screen.getByText(/does not move funds/i)).toBeInTheDocument();
  });

  it('signs, then grants, when the user allows', async () => {
    render(<ConsentScreen appId="app-1" appName="Acme Wallet" subject={ADDRESS} />);

    await userEvent.click(screen.getByRole('button', { name: 'Sign to allow' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Access granted/i));
    expect(session.signIn).toHaveBeenCalled();
    expect(session.authorizedFetch).toHaveBeenCalledWith(
      '/api/v1/consent',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('does not prompt again for an already-signed-in user', async () => {
    alreadySignedIn();
    render(<ConsentScreen appId="app-1" appName="Acme Wallet" subject={ADDRESS} />);

    await userEvent.click(screen.getByRole('button', { name: 'Allow' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Access granted/i));
    expect(session.signIn).not.toHaveBeenCalled();
  });
});

describe('ConsentScreen — signature failures', () => {
  it('does not grant when the user declines to sign', async () => {
    session.signIn = vi.fn().mockResolvedValue(false);
    render(<ConsentScreen appId="app-1" appName="Acme Wallet" subject={ADDRESS} />);

    await userEvent.click(screen.getByRole('button', { name: 'Sign to allow' }));

    await waitFor(() => expect(session.signIn).toHaveBeenCalled());
    // The decisive assertion: a declined signature never reaches the API.
    expect(session.authorizedFetch).not.toHaveBeenCalledWith(
      '/api/v1/consent',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(screen.queryByText(/Access granted/i)).not.toBeInTheDocument();
  });

  it('surfaces a declined signature as a clear error', () => {
    session.error = 'Request rejected in the wallet.';
    render(<ConsentScreen appId="app-1" appName="Acme Wallet" subject={ADDRESS} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Request rejected in the wallet.');
  });

  it('surfaces a wallet-kit signing error as a clear error', () => {
    session.error = 'Failed to sign the message';
    render(<ConsentScreen appId="app-1" appName="Acme Wallet" subject={ADDRESS} />);

    expect(screen.getByRole('alert')).toHaveTextContent(/Failed to sign the message/i);
  });

  it('shows a busy state while the wallet prompt is open', () => {
    session.status = 'authenticating';
    render(<ConsentScreen appId="app-1" appName="Acme Wallet" subject={ADDRESS} />);

    const button = screen.getByRole('button', { name: /Waiting for wallet/i });
    expect(button).toBeDisabled();
  });
});

describe('ConsentScreen — subject binding', () => {
  it('refuses to act when signed in as a different address', async () => {
    alreadySignedIn();
    session.address = OTHER_ADDRESS;
    render(<ConsentScreen appId="app-1" appName="Acme Wallet" subject={ADDRESS} />);

    expect(screen.getByRole('status')).toHaveTextContent(/signed in as a different address/i);
    // It must not even try to read the subject's grants.
    await waitFor(() => expect(session.authorizedFetch).not.toHaveBeenCalled());
  });
});

describe('ConsentScreen — deny', () => {
  it('shows a denied message when the user clicks Deny', async () => {
    render(<ConsentScreen appId="app-1" appName="Acme Wallet" subject={ADDRESS} />);
    await userEvent.click(screen.getByRole('button', { name: 'Deny' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Access denied/i));
  });
});
