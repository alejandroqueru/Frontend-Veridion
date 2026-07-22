// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, vi } from 'vitest';
import { PhysicalVerificationFlow } from '../physical-verification-flow';
import { useVerificationStore } from '../../../store/verification-store';
import * as mockAdapter from '../../../services/physical-verification-mock';

describe('PhysicalVerificationFlow', () => {
  beforeEach(() => {
    localStorage.clear();
    useVerificationStore.setState({ events: [], completedVerifications: {}, machines: {} });
  });

  it('walks through instructions → details → processing → done, then records a verification event', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    render(<PhysicalVerificationFlow methodId="proof-clean-hands" onSuccess={onSuccess} />);

    // Step 1: instructions
    expect(screen.getByText(/confirm you are not listed on any government sanctions list/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /continue/i }));

    // Step 2: details — submit is disabled until the required checkbox is checked
    const submitButton = screen.getByRole('button', { name: /submit/i });
    expect(submitButton).toBeDisabled();

    await user.click(screen.getByLabelText(/i confirm i am not on any sanctions list/i));
    expect(submitButton).toBeEnabled();

    await user.click(submitButton);

    // Step 3 → 4: processing then done
    await waitFor(() => expect(screen.getByText(/verification submitted/i)).toBeInTheDocument(), { timeout: 3000 });
    expect(onSuccess).toHaveBeenCalled();

    const state = useVerificationStore.getState();
    expect(state.isVerificationCompleted('proof-clean-hands')).toBe(true);
  });

  it('shows the error and lets the user retry after a failed submission, without losing entered data', async () => {
    const user = userEvent.setup();
    vi.spyOn(mockAdapter, 'submitPhysicalVerification')
      .mockResolvedValueOnce({ success: false, error: 'Please complete all required fields.' })
      .mockResolvedValueOnce({ success: true });

    render(<PhysicalVerificationFlow methodId="binance" />);

    await user.click(screen.getByRole('button', { name: /continue/i }));
    await user.type(screen.getByLabelText(/babt token id/i), '0xabc123');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByLabelText(/babt token id/i)).toHaveValue('0xabc123');

    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toHaveFocus();

    await user.click(retryButton);
    await waitFor(() => expect(screen.getByText(/verification submitted/i)).toBeInTheDocument());
  });
});
