/**
 * Generates an accessible color palette from a single user-chosen seed hex
 * color, using the actual WCAG 2.x relative-luminance/contrast-ratio
 * formulas (not an approximation) — see
 * https://www.w3.org/TR/WCAG21/#contrast-minimum. Pure and deterministic
 * (no randomness), so it's directly snapshot/assertion-testable.
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface HSL {
  h: number;
  s: number;
  l: number;
}

/** WCAG AA minimum contrast ratio for normal-sized text/icons. */
export const WCAG_AA_NORMAL = 4.5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const HEX_RE = /^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

/** Never throws — an invalid hex string deterministically falls back to black. */
export function hexToRgb(hex: string): RGB {
  const match = HEX_RE.exec(hex.trim());
  const full = match ? (match[1].length === 3 ? expandShorthand(match[1]) : match[1]) : '000000';
  const int = parseInt(full, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function expandShorthand(shorthand: string): string {
  return shorthand
    .split('')
    .map((c) => c + c)
    .join('');
}

export function rgbToHex({ r, g, b }: RGB): string {
  const toHex = (value: number) => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;

  return { h: h * 60, s, l };
}

function hueToRgbChannel(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hn = ((h % 360) + 360) % 360 / 360;

  return {
    r: Math.round(hueToRgbChannel(p, q, hn + 1 / 3) * 255),
    g: Math.round(hueToRgbChannel(p, q, hn) * 255),
    b: Math.round(hueToRgbChannel(p, q, hn - 1 / 3) * 255),
  };
}

function linearizeChannel(channel255: number): number {
  const c = channel255 / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance, L = 0.2126*R + 0.7152*G + 0.0722*B (linearized channels). */
export function relativeLuminance(rgb: RGB): number {
  return (
    0.2126 * linearizeChannel(rgb.r) + 0.7152 * linearizeChannel(rgb.g) + 0.0722 * linearizeChannel(rgb.b)
  );
}

/** WCAG contrast ratio, (L1+0.05)/(L2+0.05) with L1 the lighter of the two. Range [1, 21]. */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

const WHITE: RGB = { r: 255, g: 255, b: 255 };
const BLACK: RGB = { r: 0, g: 0, b: 0 };
/** This app's actual dark background (src/app/layout.tsx) — the palette's "on dark surface" text color is guaranteed readable against the real chrome, not a generic black. */
const APP_DARK_SURFACE: RGB = hexToRgb('#0B0A0A');

/**
 * Holds hue/saturation fixed (so the result still reads as "the user's
 * color") and steps lightness toward whichever extreme increases contrast
 * against `surface`, in small increments, until `targetRatio` is met or the
 * full lightness range has been searched. Since contrast ratio scales
 * monotonically with luminance and lightness alone can reach any luminance
 * from 0 to 1 (down to full black, up to full white), a full-range search
 * always finds a passing lightness once s can produce the needed extreme —
 * only a pathological targetRatio above 21 could fail.
 */
function adjustForContrast(seed: RGB, surface: RGB, targetRatio: number): RGB {
  if (contrastRatio(seed, surface) >= targetRatio) return seed;

  const hsl = rgbToHsl(seed);
  const direction = relativeLuminance(surface) < 0.5 ? 1 : -1;

  let best = seed;
  let bestRatio = contrastRatio(seed, surface);

  for (let step = 1; step <= 40; step++) {
    const candidateL = clamp(hsl.l + direction * step * 0.025, 0, 1);
    const candidateRgb = hslToRgb({ ...hsl, l: candidateL });
    const candidateRatio = contrastRatio(candidateRgb, surface);

    if (candidateRatio > bestRatio) {
      best = candidateRgb;
      bestRatio = candidateRatio;
    }
    if (candidateRatio >= targetRatio) return candidateRgb;
  }

  // Full range searched without reaching target (only possible for an
  // unreasonably high targetRatio) — return the best contrast we found.
  return best;
}

export interface AccessiblePalette {
  seed: string;
  /** The seed color, unmodified — for use as a fill/background (badges, buttons), not directly as text. */
  accent: string;
  /** Whichever of black/white contrasts better against `accent`, for text/icons drawn on top of it. */
  onAccent: '#000000' | '#ffffff';
  /** Seed hue, lightness-adjusted to be readable as text directly on this app's dark background. */
  onDarkSurface: string;
  /** Seed hue, lightness-adjusted to be readable as text on a white background (print/export contexts). */
  onLightSurface: string;
  ramp: Record<'100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900', string>;
  /** True only if both onDarkSurface and onLightSurface actually clear targetRatio. */
  meetsAA: boolean;
  /** The worse (smaller) of the two achieved contrast ratios above. */
  contrastRatio: number;
}

const RAMP_LIGHTNESS: Record<string, number> = {
  '100': 0.95,
  '200': 0.85,
  '300': 0.75,
  '400': 0.65,
  '500': 0.5,
  '600': 0.4,
  '700': 0.3,
  '800': 0.2,
  '900': 0.1,
};

export function generateAccessiblePalette(seedHex: string, targetRatio: number = WCAG_AA_NORMAL): AccessiblePalette {
  const seedRgb = hexToRgb(seedHex);
  const seedHsl = rgbToHsl(seedRgb);

  const onDarkRgb = adjustForContrast(seedRgb, APP_DARK_SURFACE, targetRatio);
  const onLightRgb = adjustForContrast(seedRgb, WHITE, targetRatio);

  const onAccent = contrastRatio(seedRgb, BLACK) >= contrastRatio(seedRgb, WHITE) ? '#000000' : '#ffffff';

  const ramp = Object.fromEntries(
    Object.entries(RAMP_LIGHTNESS).map(([step, l]) => [step, rgbToHex(hslToRgb({ ...seedHsl, l }))]),
  ) as AccessiblePalette['ramp'];

  const darkRatio = contrastRatio(onDarkRgb, APP_DARK_SURFACE);
  const lightRatio = contrastRatio(onLightRgb, WHITE);
  const worstRatio = Math.min(darkRatio, lightRatio);

  return {
    seed: rgbToHex(seedRgb),
    accent: rgbToHex(seedRgb),
    onAccent,
    onDarkSurface: rgbToHex(onDarkRgb),
    onLightSurface: rgbToHex(onLightRgb),
    ramp,
    meetsAA: worstRatio >= targetRatio,
    contrastRatio: worstRatio,
  };
}
