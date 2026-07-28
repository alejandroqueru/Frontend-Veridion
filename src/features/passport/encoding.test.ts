import {
  compressJson,
  decompressJson,
  encodePassportPayload,
  decodePassportPayload,
  encodePassportSnapshot,
  decodePassportSnapshot,
  PASSPORT_PAYLOAD_VERSION,
  type PassportPayloadV2,
} from './encoding';
import { DEFAULT_PRESENTATION_OPTIONS } from './types';
import type { PassportSnapshot } from './types';

const NOW = new Date('2026-01-01T00:00:00.000Z').getTime();

const SAMPLE_SNAPSHOT: PassportSnapshot = {
  algorithmVersion: 'v2',
  computedAt: NOW,
  totalScore: 42,
  categories: [
    {
      category: 'social',
      label: 'Social',
      earnedPoints: 6,
      cap: 24,
      providers: [
        {
          providerId: 'github',
          category: 'social',
          label: 'GitHub',
          points: 6,
          occurredAt: NOW,
          isUnknownProvider: false,
        },
      ],
    },
  ],
};

describe('compressJson / decompressJson — low-level primitives', () => {
  it('round-trips an arbitrary JSON value', () => {
    const value = { a: 1, b: ['x', 'y'], c: { nested: true } };
    expect(decompressJson(compressJson(value))).toEqual(value);
  });

  it('decompressJson never throws on garbage input', () => {
    expect(() => decompressJson('%%%not-a-real-code%%%')).not.toThrow();
    expect(decompressJson('%%%not-a-real-code%%%')).toBeUndefined();
  });

  it('decompressJson returns undefined for an empty string', () => {
    expect(decompressJson('')).toBeUndefined();
  });
});

describe('encodePassportSnapshot / decodePassportSnapshot — round trip', () => {
  it('produces a standard base64url string (A-Za-z0-9-_, no padding) safe to use as a URL path segment', () => {
    // Deliberately not lz-string's own "URI-safe" alphabet (A-Za-z0-9+-$) —
    // '+' and '$' were observed to not survive unchanged through every
    // URL-handling layer a share link passes through, corrupting the
    // payload. Standard base64url is universally safe in a path segment.
    const code = encodePassportSnapshot(SAMPLE_SNAPSHOT, DEFAULT_PRESENTATION_OPTIONS);
    expect(code).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('decodes back to an equivalent snapshot and presentation', () => {
    const code = encodePassportSnapshot(SAMPLE_SNAPSHOT, DEFAULT_PRESENTATION_OPTIONS);
    const { snapshot, presentation, warnings } = decodePassportSnapshot(code);

    expect(snapshot).toEqual(SAMPLE_SNAPSHOT);
    expect(presentation).toEqual(DEFAULT_PRESENTATION_OPTIONS);
    expect(warnings).toEqual([]);
  });

  it('round-trips a custom presentation (template/accent/layout/qr)', () => {
    const presentation = {
      template: 'dao' as const,
      accentColor: '#ff00aa',
      layout: 'compact' as const,
      qr: { enabled: true, size: 220, errorCorrectionLevel: 'H' as const },
      features: ['some-future-flag'],
    };
    const code = encodePassportSnapshot(SAMPLE_SNAPSHOT, presentation);
    expect(decodePassportSnapshot(code).presentation).toEqual(presentation);
  });
});

describe('decodePassportPayload — corrupt input never throws', () => {
  it('returns an empty payload with a warning for undecodable input', () => {
    expect(() => decodePassportPayload('garbage-not-encoded')).not.toThrow();
    const result = decodePassportPayload('garbage-not-encoded');
    expect(result.sourceVersion).toBe(0);
    expect(result.payload.categories).toEqual([]);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('returns an empty payload for a validly-compressed non-object (e.g. a bare number)', () => {
    const code = compressJson(42);
    const result = decodePassportPayload(code);
    expect(result.payload).toEqual(
      expect.objectContaining({ v: PASSPORT_PAYLOAD_VERSION, categories: [], totalScore: 0 }),
    );
  });
});

describe('decodePassportPayload — v1 -> v2 migration', () => {
  it('backfills a missing `presentation` field with defaults and records a warning', () => {
    const v1Payload = {
      v: 1,
      algorithmVersion: 'v1',
      computedAt: NOW,
      totalScore: 6,
      categories: SAMPLE_SNAPSHOT.categories,
      // no `presentation` — v1 never had this field
    };
    const code = compressJson(v1Payload);
    const result = decodePassportPayload(code);

    expect(result.sourceVersion).toBe(1);
    expect(result.payload.v).toBe(2);
    expect(result.payload.presentation).toEqual(DEFAULT_PRESENTATION_OPTIONS);
    expect(result.payload.totalScore).toBe(6);
    expect(result.warnings.some((w) => w.includes('v1 to v2'))).toBe(true);
  });

  it('preserves an explicit v1 presentation-like field if one happened to be present', () => {
    const v1Payload = {
      v: 1,
      algorithmVersion: 'v1',
      computedAt: NOW,
      totalScore: 0,
      categories: [],
      presentation: { template: 'minimal', accentColor: '#123456', layout: 'compact', qr: { enabled: false, size: 100, errorCorrectionLevel: 'L' }, features: [] },
    };
    const result = decodePassportPayload(compressJson(v1Payload));
    expect(result.payload.presentation.template).toBe('minimal');
  });
});

describe('decodePassportPayload — unsupported future version (simulated v3)', () => {
  /**
   * v3 doesn't exist in this codebase yet, so this hand-builds a plain
   * object literal shaped like a hypothetical future payload — a new
   * top-level `theme` field, and a new per-provider `verificationMethod`
   * field — and feeds it through the *real* decoder via the low-level
   * `compressJson` primitive (bypassing the `PassportPayloadV2`-typed
   * `encodePassportPayload`, which can't accept a shape that doesn't exist).
   */
  const fakeV3Payload = {
    v: 3,
    algorithmVersion: 'v2',
    computedAt: NOW,
    totalScore: 42,
    categories: [
      {
        category: 'social',
        label: 'Social',
        earnedPoints: 6,
        cap: 24,
        providers: [
          {
            providerId: 'proof-of-personhood',
            category: 'social',
            label: 'Proof of Personhood',
            points: 6,
            occurredAt: NOW,
            isUnknownProvider: false,
            verificationMethod: 'zk-proof', // v3-only field
          },
        ],
      },
    ],
    presentation: DEFAULT_PRESENTATION_OPTIONS,
    theme: { darkMode: true }, // hypothetical v3-only top-level field
  };

  it('does not throw and decodes every field the current code understands', () => {
    const code = compressJson(fakeV3Payload);
    expect(() => decodePassportPayload(code)).not.toThrow();

    const result = decodePassportPayload(code);
    expect(result.sourceVersion).toBe(3);
    expect(result.payload.totalScore).toBe(42);
    expect(result.payload.categories[0].providers[0].providerId).toBe('proof-of-personhood');
  });

  it('preserves the unrecognized top-level field in .ext rather than dropping it', () => {
    const result = decodePassportPayload(compressJson(fakeV3Payload));
    expect(result.payload.ext).toEqual({ theme: { darkMode: true } });
  });

  it('preserves the unrecognized per-provider field in that provider\'s .ext', () => {
    const result = decodePassportPayload(compressJson(fakeV3Payload));
    const provider = result.payload.categories[0].providers[0];
    expect(provider.ext).toEqual({ verificationMethod: 'zk-proof' });
  });

  it('appends a "newer than supported" warning', () => {
    const result = decodePassportPayload(compressJson(fakeV3Payload));
    expect(result.warnings.some((w) => w.includes('newer than this app supports'))).toBe(true);
  });
});

describe('encodePassportPayload — always stamps the current version', () => {
  it('ignores any v the caller tries to pass and writes PASSPORT_PAYLOAD_VERSION', () => {
    const payload = {
      algorithmVersion: 'v2',
      computedAt: NOW,
      totalScore: 0,
      categories: [],
      presentation: DEFAULT_PRESENTATION_OPTIONS,
    } as Omit<PassportPayloadV2, 'v'>;

    const code = encodePassportPayload(payload);
    const result = decodePassportPayload(code);
    expect(result.payload.v).toBe(PASSPORT_PAYLOAD_VERSION);
  });
});
