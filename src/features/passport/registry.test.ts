import { passportProviderRegistry } from './registry';
import { getSchema, CURRENT_ALGORITHM_VERSION } from '@/features/scoring/schema';

describe('passportProviderRegistry — parity with the scoring schema', () => {
  it('has a registry entry for every provider the current scoring schema knows about', () => {
    const schema = getSchema(CURRENT_ALGORITHM_VERSION);
    for (const provider of Object.values(schema.providers)) {
      expect(passportProviderRegistry.get(provider.id)).toBeDefined();
    }
  });

  it('registry entries carry a real icon component for every schema provider', () => {
    const schema = getSchema(CURRENT_ALGORITHM_VERSION);
    for (const provider of Object.values(schema.providers)) {
      const meta = passportProviderRegistry.get(provider.id);
      expect(typeof meta?.icon).not.toBe('undefined');
    }
  });
});

describe('passportProviderRegistry — default visibility per category', () => {
  it('defaults physical providers to verified-only (privacy: no incomplete-KYC placeholders)', () => {
    const meta = passportProviderRegistry.get('government-id');
    expect(meta?.visibility).toBe('verified-only');
  });

  it('defaults social providers to always (fine to show a locked placeholder)', () => {
    const meta = passportProviderRegistry.get('github');
    expect(meta?.visibility).toBe('always');
  });
});

describe('passportProviderRegistry — unknown provider resolution', () => {
  it('get() returns undefined for an id the registry does not recognize', () => {
    expect(passportProviderRegistry.get('some-future-provider')).toBeUndefined();
  });

  it('resolve() never throws and synthesizes a fallback using the caller-supplied label/category', () => {
    expect(() =>
      passportProviderRegistry.resolve('some-future-provider', 'social', 'Some Future Provider'),
    ).not.toThrow();

    const fallback = passportProviderRegistry.resolve('some-future-provider', 'social', 'Some Future Provider');
    expect(fallback.id).toBe('some-future-provider');
    expect(fallback.label).toBe('Some Future Provider');
    expect(fallback.category).toBe('social');
    expect(fallback.icon).toBeDefined();
  });

  it('resolve() falls back to always-visible for an unrecognized category', () => {
    const fallback = passportProviderRegistry.resolve('mystery', 'mystery-category', 'Mystery');
    expect(fallback.visibility).toBe('always');
  });
});

describe('passportProviderRegistry — all()', () => {
  it('returns a non-empty flat list including known providers', () => {
    const all = passportProviderRegistry.all();
    expect(all.length).toBeGreaterThan(0);
    expect(all.some((meta) => meta.id === 'github')).toBe(true);
  });
});
