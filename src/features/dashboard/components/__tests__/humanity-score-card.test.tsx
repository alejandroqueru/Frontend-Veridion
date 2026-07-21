// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { HumanityScoreCard } from '../humanity-score-card';
import { useScoreExplanation } from '@/features/scoring/hooks';
import type { ScoreExplanation } from '@/features/scoring/types';

vi.mock('@/features/scoring/hooks', () => ({
  useScoreExplanation: vi.fn(),
}));

function emptyExplanation(totalScore: number): ScoreExplanation {
  return {
    algorithmVersion: 'v2',
    computedAt: Date.now(),
    totalScore,
    categories: [],
    history: [],
    warnings: [],
  };
}

describe('HumanityScoreCard', () => {
  it('renders the rounded total score from the engine — never from the raw verification store', () => {
    vi.mocked(useScoreExplanation).mockReturnValue(emptyExplanation(42.7));

    render(<HumanityScoreCard />);

    expect(screen.getByText('43')).toBeInTheDocument();
    expect(screen.getByText('Humanity points')).toBeInTheDocument();
  });

  it('renders 0 for a fresh user with no verifications', () => {
    vi.mocked(useScoreExplanation).mockReturnValue(emptyExplanation(0));

    render(<HumanityScoreCard />);

    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
