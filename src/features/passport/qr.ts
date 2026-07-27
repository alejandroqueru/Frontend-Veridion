/**
 * QR generation for exported/printed/shared passports. Uses `qrcode`'s
 * `toString(..., { type: 'svg' })`, which is pure string generation (no
 * canvas/DOM) — isomorphic, so the exact same call works for a
 * server-rendered public passport page and for the live editor preview.
 */

import QRCode from 'qrcode';
import type { QrPresentationOptions } from './types';

/** Bump to a stronger error-correction level for print/export, where a smudge or fold on paper can't be "just rescan on screen." */
export const PRINT_QR_ERROR_CORRECTION_LEVEL: QrPresentationOptions['errorCorrectionLevel'] = 'H';

/**
 * Renders raw `<svg>...</svg>` markup for `url` at the requested size and
 * error-correction level. Never throws on an empty/invalid url — returns
 * an empty string, letting callers decide how to handle a missing QR.
 */
export async function generatePassportQrSvg(url: string, config: QrPresentationOptions): Promise<string> {
  if (!config.enabled || !url) return '';

  try {
    return await QRCode.toString(url, {
      type: 'svg',
      errorCorrectionLevel: config.errorCorrectionLevel,
      width: config.size,
      margin: 1,
    });
  } catch {
    return '';
  }
}
