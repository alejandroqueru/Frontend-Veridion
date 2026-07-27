import {
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  relativeLuminance,
  contrastRatio,
  generateAccessiblePalette,
  WCAG_AA_NORMAL,
} from './palette';

const HEX_RE = /^#[0-9a-f]{6}$/;

describe('hexToRgb / rgbToHex round trip', () => {
  it('round-trips a 6-digit hex color', () => {
    expect(hexToRgb('#7EDA76')).toEqual({ r: 0x7e, g: 0xda, b: 0x76 });
    expect(rgbToHex({ r: 0x7e, g: 0xda, b: 0x76 })).toBe('#7eda76');
  });

  it('expands 3-digit shorthand hex', () => {
    expect(hexToRgb('#0f0')).toEqual({ r: 0, g: 255, b: 0 });
  });

  it('never throws on garbage input, falling back to black', () => {
    expect(() => hexToRgb('not-a-color')).not.toThrow();
    expect(hexToRgb('not-a-color')).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe('rgbToHsl / hslToRgb round trip', () => {
  it('round-trips pure red', () => {
    const hsl = rgbToHsl({ r: 255, g: 0, b: 0 });
    expect(hsl.h).toBeCloseTo(0, 0);
    expect(hslToRgb(hsl)).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('handles achromatic (gray) colors without NaN', () => {
    const hsl = rgbToHsl({ r: 128, g: 128, b: 128 });
    expect(hsl.s).toBe(0);
    expect(Number.isNaN(hsl.h)).toBe(false);
  });
});

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 5);
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
  });
});

describe('contrastRatio', () => {
  it('is exactly 21:1 for black vs white (the maximum possible ratio)', () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 1);
  });

  it('is 1:1 for a color against itself', () => {
    expect(contrastRatio({ r: 120, g: 40, b: 200 }, { r: 120, g: 40, b: 200 })).toBeCloseTo(1, 5);
  });

  it('is symmetric regardless of argument order', () => {
    const a = { r: 200, g: 50, b: 50 };
    const b = { r: 10, g: 10, b: 10 };
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10);
  });
});

describe('generateAccessiblePalette — accessibility guarantee', () => {
  const seeds = [
    '#7EDA76', // the app's existing green accent
    '#055BD0', // the app's existing blue accent
    '#FFD700', // the app's existing gold accent (low contrast against both black and white!)
    '#ffffff', // pure white — must darken drastically for a light surface
    '#000000', // pure black — must lighten drastically for a dark surface
    '#808080', // mid gray
    '#ff0000', // saturated red
  ];

  it.each(seeds)('meets WCAG AA (%s) against both dark and light surfaces', (seed) => {
    const palette = generateAccessiblePalette(seed);
    expect(palette.meetsAA).toBe(true);
    expect(palette.contrastRatio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
  });

  it.each(seeds)('produces valid 6-digit hex strings for every output color (%s)', (seed) => {
    const palette = generateAccessiblePalette(seed);
    expect(palette.accent).toMatch(HEX_RE);
    expect(palette.onDarkSurface).toMatch(HEX_RE);
    expect(palette.onLightSurface).toMatch(HEX_RE);
    for (const rampColor of Object.values(palette.ramp)) {
      expect(rampColor).toMatch(HEX_RE);
    }
  });

  it('is deterministic across repeated calls with the same seed', () => {
    const first = generateAccessiblePalette('#7EDA76');
    const second = generateAccessiblePalette('#7EDA76');
    expect(first).toEqual(second);
  });

  it('leaves the accent unmodified — only the surface-specific text variants are adjusted', () => {
    const palette = generateAccessiblePalette('#7EDA76');
    expect(palette.accent).toBe('#7eda76');
  });

  it('picks the higher-contrast of black/white for onAccent', () => {
    const darkSeed = generateAccessiblePalette('#111111');
    expect(darkSeed.onAccent).toBe('#ffffff');

    const lightSeed = generateAccessiblePalette('#f5f5f5');
    expect(lightSeed.onAccent).toBe('#000000');
  });

  it('respects a custom (lower) target ratio', () => {
    const palette = generateAccessiblePalette('#7EDA76', 3);
    expect(palette.meetsAA).toBe(true);
    expect(palette.contrastRatio).toBeGreaterThanOrEqual(3);
  });
});
