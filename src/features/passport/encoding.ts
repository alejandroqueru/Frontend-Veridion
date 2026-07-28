/**
 * Versioned, compressed, URL-safe encoding for shareable passport links.
 *
 * Three layers, each usable independently:
 *  - `compressJson`/`decompressJson` — raw string<->JSON primitives (used
 *    directly by tests to fabricate payload shapes that don't exist as real
 *    TS types yet, e.g. a simulated future version).
 *  - `encodePassportPayload`/`decodePassportPayload` — the versioned
 *    envelope (`PassportPayloadV2`), including migration/compat handling.
 *  - `encodePassportSnapshot`/`decodePassportSnapshot` — the convenience API
 *    routes/components actually call, working directly in terms of
 *    `PassportSnapshot`/`PassportPresentationOptions`.
 *
 * The version lives *inside* the compressed JSON (the `v` field) rather
 * than as a separate prefix — one source of truth, same principle as
 * `CURRENT_ALGORITHM_VERSION` in `scoring/schema.ts`.
 */

import LZString from 'lz-string';
import {
  DEFAULT_PRESENTATION_OPTIONS,
  DEFAULT_QR_OPTIONS,
  type PassportCategorySnapshot,
  type PassportPresentationOptions,
  type PassportProviderSnapshot,
  type PassportSnapshot,
  type PassportTemplateId,
  type QrPresentationOptions,
} from './types';

export const PASSPORT_PAYLOAD_VERSION = 2;

export interface PassportPayloadV2 {
  v: 2;
  algorithmVersion: string;
  computedAt: number;
  totalScore: number;
  categories: PassportCategorySnapshot[];
  presentation: PassportPresentationOptions;
  /** Unrecognized top-level fields from a newer payload version — preserved, never dropped. */
  ext?: Record<string, unknown>;
}

export interface DecodePassportResult {
  /** Always normalized to the latest known shape (`PASSPORT_PAYLOAD_VERSION`). */
  payload: PassportPayloadV2;
  /** The `v` the incoming payload actually declared (0 if undecodable/unversioned). */
  sourceVersion: number;
  warnings: string[];
}

// ── Layer 1: raw compress/decompress primitives ─────────────────────────

/**
 * lz-string's own `compressToEncodedURIComponent` alphabet includes `+` and
 * `$`, which turn out not to survive unchanged through every URL-handling
 * layer a share link passes through (observed: Next.js's dynamic page
 * segment handling can alter them, corrupting the payload). Standard
 * base64url (RFC 4648 §5, alphabet `A-Za-z0-9-_`, no padding) is the
 * alphabet every URL/path layer is guaranteed to leave untouched, so we
 * compress to base64 and translate to base64url ourselves rather than
 * trusting lz-string's URI-safe variant.
 */
function base64ToBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBase64(base64url: string): string {
  const padded = base64url + '='.repeat((4 - (base64url.length % 4)) % 4);
  return padded.replace(/-/g, '+').replace(/_/g, '/');
}

export function compressJson(value: unknown): string {
  return base64ToBase64Url(LZString.compressToBase64(JSON.stringify(value)));
}

/** Never throws — corrupt/garbage input returns `undefined`. */
export function decompressJson(code: string): unknown {
  try {
    const json = LZString.decompressFromBase64(base64UrlToBase64(code));
    if (!json) return undefined;
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

// ── Layer 2: versioned payload envelope ─────────────────────────────────

type PassportMigration = (raw: Record<string, unknown>) => Record<string, unknown>;

/**
 * Keyed by *source* version, each entry upgrading exactly one step. A v1
 * payload had no `presentation` field at all (introduced in v2) — the
 * migration backfills it with defaults rather than leaving it undefined.
 */
const PASSPORT_PAYLOAD_MIGRATIONS: Record<number, PassportMigration> = {
  1: (raw) => ({
    ...raw,
    v: 2,
    presentation: raw.presentation ?? DEFAULT_PRESENTATION_OPTIONS,
  }),
};

const KNOWN_TOP_KEYS = new Set(['v', 'algorithmVersion', 'computedAt', 'totalScore', 'categories', 'presentation']);
const KNOWN_PROVIDER_KEYS = new Set([
  'providerId',
  'category',
  'label',
  'points',
  'occurredAt',
  'isUnknownProvider',
]);
const TEMPLATE_IDS: readonly PassportTemplateId[] = ['professional', 'minimal', 'dao', 'social'];
const ERROR_CORRECTION_LEVELS: readonly QrPresentationOptions['errorCorrectionLevel'][] = ['L', 'M', 'Q', 'H'];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Returns the subset of `raw`'s own keys not in `known`, or undefined if there are none. */
function pickUnknown(raw: Record<string, unknown>, known: Set<string>): Record<string, unknown> | undefined {
  const rest = Object.fromEntries(Object.entries(raw).filter(([key]) => !known.has(key)));
  return Object.keys(rest).length > 0 ? rest : undefined;
}

function normalizeProvider(raw: unknown): PassportProviderSnapshot {
  const r = asRecord(raw);
  const ext = pickUnknown(r, KNOWN_PROVIDER_KEYS);
  return {
    providerId: typeof r.providerId === 'string' ? r.providerId : 'unknown',
    category: typeof r.category === 'string' ? r.category : 'unknown',
    label: typeof r.label === 'string' ? r.label : 'Unknown provider',
    points: typeof r.points === 'number' ? r.points : 0,
    occurredAt: typeof r.occurredAt === 'number' ? r.occurredAt : 0,
    isUnknownProvider: typeof r.isUnknownProvider === 'boolean' ? r.isUnknownProvider : false,
    ...(ext ? { ext } : {}),
  };
}

function normalizeCategory(raw: unknown): PassportCategorySnapshot {
  const r = asRecord(raw);
  const providersRaw = Array.isArray(r.providers) ? r.providers : [];
  return {
    category: typeof r.category === 'string' ? r.category : 'unknown',
    label: typeof r.label === 'string' ? r.label : 'Unknown',
    earnedPoints: typeof r.earnedPoints === 'number' ? r.earnedPoints : 0,
    cap: typeof r.cap === 'number' ? r.cap : 0,
    providers: providersRaw.map(normalizeProvider),
  };
}

function normalizeQr(raw: unknown): QrPresentationOptions {
  const r = asRecord(raw);
  const level = r.errorCorrectionLevel;
  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : DEFAULT_QR_OPTIONS.enabled,
    size: typeof r.size === 'number' ? r.size : DEFAULT_QR_OPTIONS.size,
    errorCorrectionLevel: ERROR_CORRECTION_LEVELS.includes(level as QrPresentationOptions['errorCorrectionLevel'])
      ? (level as QrPresentationOptions['errorCorrectionLevel'])
      : DEFAULT_QR_OPTIONS.errorCorrectionLevel,
  };
}

function normalizePresentation(raw: unknown): PassportPresentationOptions {
  const r = asRecord(raw);
  const template = TEMPLATE_IDS.includes(r.template as PassportTemplateId)
    ? (r.template as PassportTemplateId)
    : DEFAULT_PRESENTATION_OPTIONS.template;

  return {
    template,
    accentColor: typeof r.accentColor === 'string' ? r.accentColor : DEFAULT_PRESENTATION_OPTIONS.accentColor,
    layout: r.layout === 'compact' ? 'compact' : 'detailed',
    qr: normalizeQr(r.qr),
    features: Array.isArray(r.features) ? r.features.filter((f): f is string => typeof f === 'string') : [],
  };
}

function normalizePayload(record: Record<string, unknown>): PassportPayloadV2 {
  const categoriesRaw = Array.isArray(record.categories) ? record.categories : [];
  const ext = pickUnknown(record, KNOWN_TOP_KEYS);

  return {
    v: PASSPORT_PAYLOAD_VERSION,
    algorithmVersion: typeof record.algorithmVersion === 'string' ? record.algorithmVersion : 'v2',
    computedAt: typeof record.computedAt === 'number' ? record.computedAt : 0,
    totalScore: typeof record.totalScore === 'number' ? record.totalScore : 0,
    categories: categoriesRaw.map(normalizeCategory),
    presentation: normalizePresentation(record.presentation),
    ...(ext ? { ext } : {}),
  };
}

function emptyPayload(): PassportPayloadV2 {
  return {
    v: PASSPORT_PAYLOAD_VERSION,
    algorithmVersion: 'v2',
    computedAt: 0,
    totalScore: 0,
    categories: [],
    presentation: DEFAULT_PRESENTATION_OPTIONS,
  };
}

export function encodePassportPayload(payload: Omit<PassportPayloadV2, 'v'>): string {
  const full: PassportPayloadV2 = { ...payload, v: PASSPORT_PAYLOAD_VERSION };
  return compressJson(full);
}

/**
 * Never throws. Handles three cases:
 *  1. Corrupt/undecodable input -> empty payload + warning.
 *  2. `v` below current -> walks `PASSPORT_PAYLOAD_MIGRATIONS` forward,
 *     backfilling fields introduced by later versions with defaults.
 *  3. `v` above current (a payload from a future app version) -> no
 *     migration exists to run, so every known field is still read
 *     defensively and everything else is captured into `.ext` rather than
 *     silently discarded — the payload still renders with what this code
 *     understands.
 */
export function decodePassportPayload(code: string): DecodePassportResult {
  const warnings: string[] = [];
  const decoded = decompressJson(code);

  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
    warnings.push('Could not decode passport payload — showing an empty passport.');
    return { payload: emptyPayload(), sourceVersion: 0, warnings };
  }

  let record = decoded as Record<string, unknown>;
  const sourceVersion = typeof record.v === 'number' ? record.v : 0;
  let version = sourceVersion;

  while (version < PASSPORT_PAYLOAD_VERSION && PASSPORT_PAYLOAD_MIGRATIONS[version]) {
    record = PASSPORT_PAYLOAD_MIGRATIONS[version](record);
    warnings.push(`Upgraded passport payload from v${version} to v${version + 1}.`);
    version += 1;
  }

  if (version > PASSPORT_PAYLOAD_VERSION) {
    warnings.push(
      `Payload version ${version} is newer than this app supports (v${PASSPORT_PAYLOAD_VERSION}) — rendering with best-effort compatibility.`,
    );
  } else if (version < PASSPORT_PAYLOAD_VERSION) {
    warnings.push(
      `Payload version ${version} has no migration path to v${PASSPORT_PAYLOAD_VERSION} — rendering with defaults for missing fields.`,
    );
  }

  return { payload: normalizePayload(record), sourceVersion, warnings };
}

// ── Layer 3: snapshot-shaped convenience API ────────────────────────────

export function encodePassportSnapshot(snapshot: PassportSnapshot, presentation: PassportPresentationOptions): string {
  return encodePassportPayload({
    algorithmVersion: snapshot.algorithmVersion,
    computedAt: snapshot.computedAt,
    totalScore: snapshot.totalScore,
    categories: snapshot.categories,
    presentation,
  });
}

export interface DecodedPassportView {
  snapshot: PassportSnapshot;
  presentation: PassportPresentationOptions;
  warnings: string[];
}

export function decodePassportSnapshot(code: string): DecodedPassportView {
  const { payload, warnings } = decodePassportPayload(code);
  return {
    snapshot: {
      algorithmVersion: payload.algorithmVersion,
      computedAt: payload.computedAt,
      totalScore: payload.totalScore,
      categories: payload.categories,
    },
    presentation: payload.presentation,
    warnings,
  };
}
