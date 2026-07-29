// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConsentScreen } from './consent-screen';

const ADDRESS = `G${'A'.repeat(55)}`;

afterEach(() => vi.restoreAllMocks());

describe('ConsentScreen', () => {
  it('grants access when the user clicks Allow', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ granted: true }) });
      }
      // GET list
      return Promise.resolve({ ok: true, json: async () => ({ grants: [] }) });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ConsentScreen appId="app-1" appName="Acme Wallet" subject={ADDRESS} />);
    expect(screen.getByText('Acme Wallet')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Allow' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Access granted/i));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/consent',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('shows a denied message when the user clicks Deny', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ grants: [] }) }),
    );
    render(<ConsentScreen appId="app-1" appName="Acme Wallet" subject={ADDRESS} />);
    await userEvent.click(screen.getByRole('button', { name: 'Deny' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Access denied/i));
  });
});
