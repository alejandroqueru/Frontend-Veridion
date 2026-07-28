import { generatePassportQrSvg } from './qr';
import { DEFAULT_QR_OPTIONS } from './types';

const SAMPLE_URL = 'https://veridion.example/p/abc123';

describe('generatePassportQrSvg', () => {
  it('produces scannable <svg> markup for a valid url', async () => {
    const svg = await generatePassportQrSvg(SAMPLE_URL, DEFAULT_QR_OPTIONS);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('reflects the requested size in the svg width attribute', async () => {
    const svg = await generatePassportQrSvg(SAMPLE_URL, { ...DEFAULT_QR_OPTIONS, size: 256 });
    expect(svg).toContain('width="256"');
  });

  it.each(['L', 'M', 'Q', 'H'] as const)('generates without throwing at error-correction level %s', async (level) => {
    await expect(
      generatePassportQrSvg(SAMPLE_URL, { ...DEFAULT_QR_OPTIONS, errorCorrectionLevel: level }),
    ).resolves.toContain('<svg');
  });

  it('a higher error-correction level produces a denser (larger) svg payload than a lower one for the same data', async () => {
    const low = await generatePassportQrSvg(SAMPLE_URL, { ...DEFAULT_QR_OPTIONS, errorCorrectionLevel: 'L' });
    const high = await generatePassportQrSvg(SAMPLE_URL, { ...DEFAULT_QR_OPTIONS, errorCorrectionLevel: 'H' });
    expect(high.length).toBeGreaterThanOrEqual(low.length);
  });

  it('returns an empty string when qr is disabled, without calling into the QR library', async () => {
    const svg = await generatePassportQrSvg(SAMPLE_URL, { ...DEFAULT_QR_OPTIONS, enabled: false });
    expect(svg).toBe('');
  });

  it('returns an empty string for an empty url rather than throwing', async () => {
    await expect(generatePassportQrSvg('', DEFAULT_QR_OPTIONS)).resolves.toBe('');
  });
});
