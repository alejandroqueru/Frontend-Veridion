// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { ContributionBreakdown, ScoreSimulator, VerificationHistoryTimeline } from './components';
import { useScoreSimulation } from './hooks';
import type { ScoreExplanation, VerificationEvent } from './types';

vi.mock('./hooks', () => ({
  useScoreSimulation: vi.fn(),
}));

const baseExplanation: ScoreExplanation = {
  algorithmVersion: 'v2',
  computedAt: 0,
  totalScore: 0,
  categories: [],
  history: [],
  warnings: [],
};

// ── ContributionBreakdown ────────────────────────────────────────────

describe('ContributionBreakdown', () => {
  it('shows the empty state when there are no contributions', () => {
    render(<ContributionBreakdown explanation={baseExplanation} />);
    expect(screen.getByText(/complete a verification/i)).toBeInTheDocument();
  });

  it('renders each provider contribution with its points and freshness', () => {
    const explanation: ScoreExplanation = {
      ...baseExplanation,
      totalScore: 6,
      categories: [
        {
          category: 'social',
          label: 'Social',
          earnedPoints: 6,
          cap: 24,
          providers: [
            {
              providerId: 'google',
              category: 'social',
              label: 'Google',
              activeEventId: 'e1',
              occurredAt: Date.now(),
              rawWeight: 6,
              decayFactor: 1,
              contributedPoints: 6,
              cappedPoints: 6,
              isUnknownProvider: false,
              eventCount: 1,
            },
          ],
        },
      ],
    };

    render(<ContributionBreakdown explanation={explanation} />);
    expect(screen.getByText('Google')).toBeInTheDocument();
    expect(screen.getByText('6.0 pts')).toBeInTheDocument();
    expect(screen.getByText(/100% freshness/)).toBeInTheDocument();
  });

  it('shows a capped indicator when cappedPoints is less than the raw contribution', () => {
    const explanation: ScoreExplanation = {
      ...baseExplanation,
      totalScore: 5,
      categories: [
        {
          category: 'alpha',
          label: 'Alpha',
          earnedPoints: 5,
          cap: 5,
          providers: [
            {
              providerId: 'a',
              category: 'alpha',
              label: 'A',
              activeEventId: 'e1',
              occurredAt: Date.now(),
              rawWeight: 8,
              decayFactor: 1,
              contributedPoints: 8,
              cappedPoints: 5,
              isUnknownProvider: false,
              eventCount: 1,
            },
          ],
        },
      ],
    };

    render(<ContributionBreakdown explanation={explanation} />);
    expect(screen.getByText(/capped from 8.0/)).toBeInTheDocument();
  });
});

// ── ScoreSimulator ────────────────────────────────────────────────────

describe('ScoreSimulator', () => {
  it('lists pending providers and previews a score delta when one is selected, without writing to the store', () => {
    const simulate = vi.fn(
      (hypotheticalEvents: unknown[]): ScoreExplanation => ({
        ...baseExplanation,
        totalScore: hypotheticalEvents.length > 0 ? 6 : 0,
      }),
    );
    vi.mocked(useScoreSimulation).mockReturnValue({ baseline: baseExplanation, simulate, isHydrated: true });

    render(<ScoreSimulator />);

    // Nothing selected yet — no delta badge, and simulate was called with an empty hypothetical set.
    expect(screen.queryByText(/pts$/)).not.toBeInTheDocument();
    expect(simulate).toHaveBeenCalledWith([]);

    fireEvent.click(screen.getByText('Google'));

    expect(simulate).toHaveBeenLastCalledWith([
      expect.objectContaining({ providerId: 'google', category: 'social' }),
    ]);
    expect(screen.getByText('+6.0 pts')).toBeInTheDocument();
  });

  it('toggling a provider off removes it from the hypothetical set', () => {
    const simulate = vi.fn(
      (hypotheticalEvents: unknown[]): ScoreExplanation => ({
        ...baseExplanation,
        totalScore: hypotheticalEvents.length > 0 ? 6 : 0,
      }),
    );
    vi.mocked(useScoreSimulation).mockReturnValue({ baseline: baseExplanation, simulate, isHydrated: true });

    render(<ScoreSimulator />);

    const googleButton = screen.getByText('Google');
    fireEvent.click(googleButton);
    expect(screen.getByText('+6.0 pts')).toBeInTheDocument();

    fireEvent.click(googleButton);
    expect(simulate).toHaveBeenLastCalledWith([]);
    expect(screen.queryByText(/pts$/)).not.toBeInTheDocument();
  });
});

// ── VerificationHistoryTimeline ───────────────────────────────────────

function makeEvent(overrides: Partial<VerificationEvent>): VerificationEvent {
  return {
    eventId: 'e1',
    providerId: 'google',
    category: 'social',
    occurredAt: Date.now(),
    algorithmVersionAtCapture: 'v2',
    rawPayload: {},
    source: 'live',
    ...overrides,
  };
}

describe('VerificationHistoryTimeline', () => {
  it('shows an empty state with no history', () => {
    render(<VerificationHistoryTimeline explanation={baseExplanation} />);
    expect(screen.getByText(/no verifications recorded/i)).toBeInTheDocument();
  });

  it('marks only the latest event per provider Active, older ones Superseded', () => {
    const older = makeEvent({ eventId: 'e1', occurredAt: 1000 });
    const newer = makeEvent({ eventId: 'e2', occurredAt: 2000 });
    const explanation: ScoreExplanation = { ...baseExplanation, history: [older, newer] };

    render(<VerificationHistoryTimeline explanation={explanation} />);

    expect(screen.getAllByText('Active')).toHaveLength(1);
    expect(screen.getAllByText('Superseded')).toHaveLength(1);
  });

  it('flags migrated-legacy events distinctly from live ones', () => {
    const explanation: ScoreExplanation = {
      ...baseExplanation,
      history: [makeEvent({ source: 'migrated-legacy' })],
    };

    render(<VerificationHistoryTimeline explanation={explanation} />);
    expect(screen.getByText(/migrated/)).toBeInTheDocument();
  });

  it('resolves the provider label from the schema for the explanation\'s algorithm version', () => {
    const explanation: ScoreExplanation = {
      ...baseExplanation,
      history: [makeEvent({ providerId: 'github' })],
    };

    render(<VerificationHistoryTimeline explanation={explanation} />);
    expect(screen.getByText('GitHub')).toBeInTheDocument();
  });
});
