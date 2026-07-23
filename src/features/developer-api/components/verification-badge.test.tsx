// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VerificationBadge } from './verification-badge';

const ADDRESS = `G${'A'.repeat(55)}`;

function mockFetch(response: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => response,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('VerificationBadge', () => {
  it('renders a verified state from the API', async () => {
    vi.stubGlobal('fetch', mockFetch({ verified: true, status: 'verified' }));
    render(<VerificationBadge address={ADDRESS} />);
    await waitFor(() => expect(screen.getByLabelText('Verified by Veridion')).toBeInTheDocument());
  });

  it('renders an unverified state', async () => {
    vi.stubGlobal('fetch', mockFetch({ verified: false, status: 'unverified' }));
    render(<VerificationBadge address={ADDRESS} />);
    await waitFor(() => expect(screen.getByLabelText('Not verified')).toBeInTheDocument());
  });

  it('degrades to an error state when the request fails', async () => {
    vi.stubGlobal('fetch', mockFetch({}, false));
    render(<VerificationBadge address={ADDRESS} />);
    await waitFor(() => expect(screen.getByLabelText('Verification unavailable')).toBeInTheDocument());
  });

  it('shows an error for a malformed address without calling the API', async () => {
    const fetchSpy = mockFetch({});
    vi.stubGlobal('fetch', fetchSpy);
    render(<VerificationBadge address="not-a-stellar-address" />);
    await waitFor(() => expect(screen.getByLabelText('Verification unavailable')).toBeInTheDocument());
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
