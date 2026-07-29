import { describe, expect, it } from 'vitest';

import type { RiskSignal } from '../../types';
import { computeRiskAssessment } from '../risk-engine';

const NOW = 1_700_000_000_000;
const zero = (type: RiskSignal['type']): RiskSignal => ({ type, score: 0, detail: 'none' });
const maxed = (type: RiskSignal['type']): RiskSignal => ({ type, score: 1, detail: 'maxed' });

describe('computeRiskAssessment', () => {
  it('scores 0 when every signal is clean', () => {
    const assessment = computeRiskAssessment({
      subject: 'wallet-normal',
      correlation: zero('device-correlation'),
      velocity: zero('velocity'),
      now: NOW,
    });
    expect(assessment.score).toBe(0);
    expect(assessment.subject).toBe('wallet-normal');
    expect(assessment.computedAt).toBe(NOW);
  });

  it('is monotonic — a higher individual signal score never lowers the aggregate', () => {
    const low = computeRiskAssessment({
      subject: 's',
      correlation: { type: 'device-correlation', score: 0.2, detail: '' },
      velocity: zero('velocity'),
      now: NOW,
    });
    const high = computeRiskAssessment({
      subject: 's',
      correlation: { type: 'device-correlation', score: 0.8, detail: '' },
      velocity: zero('velocity'),
      now: NOW,
    });
    expect(high.score).toBeGreaterThan(low.score);
  });

  it('never exceeds 100 even when every signal is maxed out', () => {
    const assessment = computeRiskAssessment({
      subject: 's',
      correlation: maxed('device-correlation'),
      velocity: maxed('velocity'),
      disposablePhone: maxed('disposable-phone'),
      networkCorrelation: maxed('network-correlation'),
      geoMismatch: maxed('geo-mismatch'),
      now: NOW,
    });
    expect(assessment.score).toBe(100);
  });

  it('omits the optional signals from the list when not provided', () => {
    const assessment = computeRiskAssessment({
      subject: 's',
      correlation: zero('device-correlation'),
      velocity: zero('velocity'),
      now: NOW,
    });
    expect(assessment.signals.some((s) => s.type === 'disposable-phone')).toBe(false);
    expect(assessment.signals.some((s) => s.type === 'network-correlation')).toBe(false);
    expect(assessment.signals.some((s) => s.type === 'geo-mismatch')).toBe(false);
    expect(assessment.signals).toHaveLength(2);
  });

  it('includes each optional signal when provided, even at score 0', () => {
    const assessment = computeRiskAssessment({
      subject: 's',
      correlation: zero('device-correlation'),
      velocity: zero('velocity'),
      disposablePhone: zero('disposable-phone'),
      networkCorrelation: zero('network-correlation'),
      geoMismatch: zero('geo-mismatch'),
      now: NOW,
    });
    expect(assessment.signals).toHaveLength(5);
  });

  it('weights every signal so a single maxed signal alone never reaches 100', () => {
    const types: RiskSignal['type'][] = [
      'device-correlation',
      'velocity',
      'disposable-phone',
      'network-correlation',
      'geo-mismatch',
    ];
    for (const type of types) {
      const base = {
        subject: 's',
        correlation: zero('device-correlation'),
        velocity: zero('velocity'),
        now: NOW,
      };
      const assessment = computeRiskAssessment({ ...base, [signalInputKeyFor(type)]: maxed(type) });
      expect(assessment.score).toBeLessThan(100);
    }
  });
});

function signalInputKeyFor(type: RiskSignal['type']): 'correlation' | 'velocity' | 'disposablePhone' | 'networkCorrelation' | 'geoMismatch' {
  switch (type) {
    case 'device-correlation':
      return 'correlation';
    case 'velocity':
      return 'velocity';
    case 'disposable-phone':
      return 'disposablePhone';
    case 'network-correlation':
      return 'networkCorrelation';
    case 'geo-mismatch':
      return 'geoMismatch';
  }
}
