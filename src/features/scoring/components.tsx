'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/shared/ui/badge';
import { Clock, Sparkles } from 'lucide-react';
import { useScoreSimulation } from './hooks';
import { selectActiveEvents } from './engine';
import { getSchema, CURRENT_ALGORITHM_VERSION } from './schema';
import type { ScoreExplanation, VerificationEvent } from './types';

// ── Temporal weighting badge ────────────────────────────────────────────

export interface BadgeTone {
  text: string;
  className: string;
}

/** Pure — kept separate from the component so it's unit-testable without rendering. */
export function getBadgeTone(decayFactor: number): BadgeTone {
  if (decayFactor >= 0.9) {
    return { text: 'Fresh', className: 'border-green-500/50 text-green-400 bg-green-500/10' };
  }
  if (decayFactor >= 0.5) {
    return { text: 'Fading', className: 'border-yellow-500/50 text-yellow-400 bg-yellow-500/10' };
  }
  return { text: 'Stale', className: 'border-orange-500/50 text-orange-400 bg-orange-500/10' };
}

interface TemporalWeightingBadgeProps {
  decayFactor: number;
}

export function TemporalWeightingBadge({ decayFactor }: TemporalWeightingBadgeProps) {
  const tone = getBadgeTone(decayFactor);
  return (
    <Badge variant="outline" className={`rounded-full text-xs ${tone.className}`}>
      {tone.text} · {Math.round(decayFactor * 100)}%
    </Badge>
  );
}

// ── Contribution breakdown ──────────────────────────────────────────────

interface ContributionBreakdownProps {
  explanation: ScoreExplanation;
}

/** Per-verification contribution detail, computed directly from engine output — no separate data source. */
export function ContributionBreakdown({ explanation }: ContributionBreakdownProps) {
  const contributions = explanation.categories.flatMap((category) => category.providers);

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-lighter-gray-text">Score contributions</h4>

      {contributions.length === 0 ? (
        <div className="rounded-2xl border border-custom-border bg-card-darker p-4">
          <p className="text-sm text-gray-text">
            Complete a verification to see how it contributes to your Human Score.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {contributions.map((contribution) => {
            const isCapped = contribution.cappedPoints < contribution.contributedPoints - 0.01;

            return (
              <li
                key={contribution.providerId}
                className="rounded-2xl border border-custom-border bg-card-darker p-3 sm:p-4 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-white">{contribution.label}</span>
                  <div className="flex items-center gap-2">
                    <TemporalWeightingBadge decayFactor={contribution.decayFactor} />
                    <span className="text-sm font-semibold text-[#7EDA76]">
                      {contribution.cappedPoints.toFixed(1)} pts
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-text">
                  {contribution.rawWeight.toFixed(1)} base × {Math.round(contribution.decayFactor * 100)}% freshness
                  {isCapped ? ` · capped from ${contribution.contributedPoints.toFixed(1)}` : ''}
                </p>
              </li>
            );
          })}
        </ul>
      )}

    </div>
  );
}

// ── Verification history timeline ───────────────────────────────────────

interface VerificationHistoryTimelineProps {
  explanation: ScoreExplanation;
}

function formatOccurredAt(occurredAt: number): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(occurredAt));
}

/**
 * Renders the full, unfiltered event log (superseded events included) so
 * re-verifying a provider is visible as history rather than a silent
 * overwrite — the active event per provider is highlighted, older ones for
 * the same provider are shown greyed out.
 */
export function VerificationHistoryTimeline({ explanation }: VerificationHistoryTimelineProps) {
  const schema = getSchema(explanation.algorithmVersion);
  const activeEventIds = new Set(
    [...selectActiveEvents(explanation.history).values()].map((event) => event.eventId),
  );
  const sorted = [...explanation.history].sort((a, b) => b.occurredAt - a.occurredAt);

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-lighter-gray-text">Verification history</h4>

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-custom-border bg-card-darker p-4 flex items-start gap-3">
          <Clock className="h-5 w-5 text-gray-text flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-text">No verifications recorded yet.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {sorted.map((event) => {
            const isActive = activeEventIds.has(event.eventId);
            const label = schema.providers[event.providerId]?.label ?? event.providerId;

            return (
              <li
                key={event.eventId}
                className={`rounded-2xl border p-3 sm:p-4 flex items-center justify-between gap-3 ${
                  isActive ? 'border-green-500/20 bg-dark-green-bg' : 'border-custom-border bg-card-darker opacity-60'
                }`}
              >
                <div className="min-w-0">
                  <span
                    className={`text-sm font-medium ${isActive ? 'text-green-200' : 'text-gray-400 line-through'}`}
                  >
                    {label}
                  </span>
                  <p className="text-xs text-gray-text mt-0.5">
                    {formatOccurredAt(event.occurredAt)}
                    {event.source === 'migrated-legacy' ? ' · migrated' : ''}
                  </p>
                </div>
                <span className="text-xs text-gray-text flex-shrink-0">
                  {isActive ? 'Active' : 'Superseded'}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Score simulator ──────────────────────────────────────────────────────

/**
 * Every simulated provider uses `legacyPoints: baseWeight` — that bypasses
 * signal scoring entirely (see hasLegacyPoints in engine.ts), so this
 * always previews the maximum achievable contribution for a provider, which
 * is exact for boolean providers and an honest ceiling for signal-based
 * ones (Stellar) where we have no real account data to simulate against.
 */
function buildHypotheticalEvent(providerId: string, category: string, baseWeight: number): VerificationEvent {
  return {
    eventId: `sim:${providerId}`,
    providerId,
    category,
    occurredAt: Date.now(),
    algorithmVersionAtCapture: CURRENT_ALGORITHM_VERSION,
    rawPayload: { legacyPoints: baseWeight },
    source: 'live',
  };
}

export function ScoreSimulator() {
  const schema = getSchema(CURRENT_ALGORITHM_VERSION);
  const { baseline, simulate } = useScoreSimulation();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const completedProviderIds = useMemo(
    () => new Set(selectActiveEvents(baseline.history).keys()),
    [baseline.history],
  );

  const candidateProviders = Object.values(schema.providers).filter(
    (provider) => provider.id !== '__unknown__' && !completedProviderIds.has(provider.id),
  );

  const hypotheticalEvents = useMemo(
    () =>
      [...selected].map((providerId) => {
        const provider = schema.providers[providerId];
        return buildHypotheticalEvent(providerId, provider.category, provider.baseWeight);
      }),
    [selected, schema],
  );

  const simulated = simulate(hypotheticalEvents);
  const delta = simulated.totalScore - baseline.totalScore;

  function toggle(providerId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(providerId)) next.delete(providerId);
      else next.add(providerId);
      return next;
    });
  }

  if (candidateProviders.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-medium text-lighter-gray-text">Score simulator</h4>
        {selected.size > 0 && (
          <Badge variant="outline" className="rounded-full border-green-500/50 text-green-400 bg-green-500/10">
            <Sparkles className="h-3 w-3 mr-1" />+{delta.toFixed(1)} pts
          </Badge>
        )}
      </div>
      <p className="text-xs text-gray-text">
        Select pending verifications to preview their effect on your Human Score. Nothing is saved.
      </p>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {candidateProviders.map((provider) => {
          const isSelected = selected.has(provider.id);
          return (
            <li key={provider.id}>
              <button
                type="button"
                onClick={() => toggle(provider.id)}
                aria-pressed={isSelected}
                className={`w-full text-left rounded-2xl border p-3 transition-colors ${
                  isSelected
                    ? 'border-green-500 bg-dark-green-bg'
                    : 'border-custom-border bg-card-darker hover:border-gray-600/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-white">{provider.label}</span>
                  <span className="text-xs text-gray-text">up to +{provider.baseWeight}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
