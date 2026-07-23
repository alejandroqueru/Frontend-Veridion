// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, vi } from 'vitest';
import { VerificationModal } from '../verification-modal';
import { useVerificationStore } from '../../store/verification-store';

const baseProps = {
  title: 'Verify your GitHub account ownership',
  points: '0/6',
  time: '5-10 minutes',
  price: 'Free',
  status: 'Account Verification',
  achievements: [],
  requirements: ['Must have an active GitHub account'],
};

describe('VerificationModal', () => {
  beforeEach(() => {
    localStorage.clear();
    useVerificationStore.setState({ events: [], completedVerifications: {}, machines: {} });
  });

  it('renders the accessible title, requirements, and the correct provider body for the given verificationId', () => {
    render(
      <VerificationModal
        {...baseProps}
        isOpen
        onClose={vi.fn()}
        verificationId="github"
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByText('Verify your GitHub account ownership').length).toBeGreaterThan(0);
    expect(screen.getByText('Must have an active GitHub account')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /verify with github/i })).toBeInTheDocument();
  });

  it('renders the Physical Verification workflow for a physical method id instead of the old no-op button', () => {
    render(
      <VerificationModal
        {...baseProps}
        title="Prove you're not on sanctions lists"
        isOpen
        onClose={vi.fn()}
        verificationId="proof-clean-hands"
      />,
    );

    expect(screen.getByText(/confirm you are not listed on any government sanctions list/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
  });

  it('closes on Escape (Radix Dialog keyboard handling wired through onOpenChange → onClose)', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <VerificationModal
        {...baseProps}
        isOpen
        onClose={onClose}
        verificationId="github"
      />,
    );

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('announces a failed provider status via an assertive live region and focuses the Retry button', async () => {
    useVerificationStore.getState().dispatchMachineEvent('discord', { type: 'CONNECT' });
    useVerificationStore.getState().dispatchMachineEvent('discord', { type: 'FAIL', error: 'Discord did not respond.' });

    render(
      <VerificationModal
        {...baseProps}
        title="Verify that you own a Discord account"
        isOpen
        onClose={vi.fn()}
        verificationId="discord"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Discord did not respond.');
    });
    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toHaveFocus();
  });
});
