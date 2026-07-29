// @vitest-environment jsdom
// (useVerificationStore's zustand `persist` middleware needs localStorage,
// only present under jsdom — see verification-store.integration.test.ts.)

import fs from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { useVerificationStore } from '@/features/verifications/store/verification-store';

import { getRiskAssessment, recordVerificationSignal } from '../service';
import { resetRiskAssessmentStore } from '../store/risk-assessment-store';
import { resetRiskEventStore } from '../store/risk-event-store';

const NOW = 1_700_000_000_000;

describe('risk-signals service — synthetic signal combinations', () => {
  beforeEach(() => {
    resetRiskEventStore();
    resetRiskAssessmentStore();
  });

  it('scores a normal user (one provider, no reuse, no disposable phone) at 0', () => {
    const assessment = recordVerificationSignal({
      subject: 'wallet-normal',
      fingerprint: 'fp-normal',
      providerId: 'github',
      now: NOW,
    });

    expect(assessment.score).toBe(0);
    expect(assessment.signals.every((s) => s.score === 0)).toBe(true);
  });

  it('raises the score for implausibly fast multi-provider completion (velocity abuse)', () => {
    const subject = 'wallet-velocity';
    const providers = ['github', 'discord', 'linkedin', 'email-verification'];

    let last;
    for (const [i, providerId] of providers.entries()) {
      last = recordVerificationSignal({
        subject,
        fingerprint: `fp-velocity-${i}`, // distinct devices, so no correlation signal should fire
        providerId,
        now: NOW + i * 500, // 500ms apart — no human clicks through 4 OAuth/OTP flows this fast
      });
    }

    expect(last!.score).toBeGreaterThan(0);
    expect(last!.signals.find((s) => s.type === 'velocity')?.score).toBeGreaterThan(0);
    expect(last!.signals.find((s) => s.type === 'device-correlation')?.score).toBe(0);
  });

  it('raises the score when one device signal fans out across many distinct accounts (device reuse / bot farm)', () => {
    const fingerprint = 'fp-shared-device';

    let last;
    for (let i = 0; i < 8; i++) {
      last = recordVerificationSignal({
        subject: `wallet-farm-${i}`,
        fingerprint,
        providerId: 'github',
        now: NOW + i * 60 * 60 * 1000, // spread an hour apart — not a velocity signal
      });
    }

    expect(last!.score).toBeGreaterThan(0);
    expect(last!.signals.find((s) => s.type === 'device-correlation')?.score).toBeGreaterThan(0);
    expect(last!.signals.find((s) => s.type === 'velocity')?.score).toBe(0);
  });

  it('raises the score for a disposable/VOIP phone pattern', () => {
    const assessment = recordVerificationSignal({
      subject: 'wallet-phone',
      fingerprint: 'fp-phone',
      providerId: 'phone-verification',
      phone: '+18005551234',
      now: NOW,
    });

    expect(assessment.signals.find((s) => s.type === 'disposable-phone')?.score).toBe(1);
    expect(assessment.score).toBeGreaterThan(0);
  });

  it('does not flag a normal phone number as disposable', () => {
    const assessment = recordVerificationSignal({
      subject: 'wallet-real-phone',
      fingerprint: 'fp-real-phone',
      providerId: 'phone-verification',
      phone: '+14158479213',
      now: NOW,
    });

    expect(assessment.signals.find((s) => s.type === 'disposable-phone')?.score).toBe(0);
  });

  it('getRiskAssessment returns the most recently computed assessment for a subject', () => {
    recordVerificationSignal({ subject: 'wallet-latest', fingerprint: 'fp-1', providerId: 'github', now: NOW });
    const second = recordVerificationSignal({
      subject: 'wallet-latest',
      fingerprint: 'fp-1',
      providerId: 'discord',
      now: NOW + 1,
    });

    expect(getRiskAssessment('wallet-latest')).toEqual(second);
  });

  it('returns null for a subject with no recorded signals', () => {
    expect(getRiskAssessment('never-seen-subject')).toBeNull();
  });
});

describe('risk-signals isolation from Human Score', () => {
  beforeEach(() => {
    resetRiskEventStore();
    resetRiskAssessmentStore();
  });

  it('never mutates verification-store state (the Human Score source of truth)', () => {
    const before = useVerificationStore.getState().events;

    recordVerificationSignal({ subject: 'wallet-isolation', fingerprint: 'fp-isolation', providerId: 'github', now: NOW });
    getRiskAssessment('wallet-isolation');

    // Same array reference: nothing in the risk-signals write/read path
    // touched the verification store, even indirectly.
    expect(useVerificationStore.getState().events).toBe(before);
  });

  it('flags a fully "verified" account as risky without changing its Human Score inputs', () => {
    // Simulate an account that has completed every provider (would score a
    // full Human Score) but is clearly a bot-farm identity: reused device,
    // implausible velocity, disposable phone.
    const subject = 'wallet-fully-verified-but-risky';
    const fingerprint = 'fp-farm-shared';

    // Prime the fingerprint with other farmed accounts first.
    for (let i = 0; i < 6; i++) {
      recordVerificationSignal({ subject: `wallet-farm-${i}`, fingerprint, providerId: 'github', now: NOW + i * 1000 });
    }

    useVerificationStore.getState().completeVerification('github', 'social', 6);
    useVerificationStore.getState().completeVerification('discord', 'social', 5);
    const eventsBeforeRisk = useVerificationStore.getState().events;

    const assessment = recordVerificationSignal({
      subject,
      fingerprint,
      providerId: 'phone-verification',
      phone: '+18005551234',
      now: NOW + 6000,
    });

    expect(assessment.score).toBeGreaterThan(0);
    // The Human Score's event log is byte-for-byte unchanged by computing risk.
    expect(useVerificationStore.getState().events).toBe(eventsBeforeRisk);
  });

  it('the risk-signals feature never imports the scoring engine or the verification store', () => {
    const featureDir = path.resolve(__dirname, '..');
    // Match actual import/export specifiers only (not prose in comments —
    // several files here document this exact boundary by name).
    const forbidden = [
      /from\s+['"][^'"]*@\/features\/scoring[^'"]*['"]/,
      /from\s+['"][^'"]*verification-store[^'"]*['"]/,
    ];
    const offenders: string[] = [];

    function walk(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === '__tests__') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry.name)) continue;
        const content = fs.readFileSync(full, 'utf8');
        if (forbidden.some((re) => re.test(content))) offenders.push(full);
      }
    }

    walk(featureDir);
    expect(offenders).toEqual([]);
  });
});
