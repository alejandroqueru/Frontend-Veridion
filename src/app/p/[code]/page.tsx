import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { Symbol } from '@/shared/components/icons/symbol';
import { PassportRenderer } from '@/features/passport/components/passport-renderer';
import { PassportQrCode } from '@/features/passport/components/passport-qr-code';
import { PrintPassportButton } from '@/features/passport/components/print-passport-button';
import { decodePassportSnapshot } from '@/features/passport/encoding';
import { generatePassportQrSvg, PRINT_QR_ERROR_CORRECTION_LEVEL } from '@/features/passport/qr';
import type { PassportRenderContext } from '@/features/passport/types';
import { cn } from '@/lib/utils';

interface PageProps {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ context?: string }>;
}

function resolveContext(raw: string | undefined): PassportRenderContext {
  return raw === 'print' || raw === 'export' ? raw : 'public';
}

async function resolveOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const host = requestHeaders.get('host');
  if (!host) return '';
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'https';
  return `${protocol}://${host}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  const { snapshot } = decodePassportSnapshot(code);
  return {
    title: `Veridion Passport — Human Score ${Math.round(snapshot.totalScore)}`,
    description: 'A portable, verifiable identity passport for the Stellar ecosystem.',
  };
}

/**
 * Public shareable passport — also serves the "print" and "export" render
 * contexts via `?context=`, since both are fundamentally the same frozen
 * data/CSS concern rather than a separate page. Server component: decoding
 * is pure/sync, which keeps this no-JS-baseline and lets `generateMetadata`
 * produce a real share preview.
 */
export default async function PublicPassportPage({ params, searchParams }: PageProps) {
  const { code } = await params;
  const { context: rawContext } = await searchParams;
  const context = resolveContext(rawContext);
  const { snapshot, presentation, warnings } = decodePassportSnapshot(code);

  const origin = await resolveOrigin();
  const shareUrl = `${origin}/p/${code}`;
  const qrConfig =
    context === 'print' || context === 'export'
      ? { ...presentation.qr, errorCorrectionLevel: PRINT_QR_ERROR_CORRECTION_LEVEL }
      : presentation.qr;
  const qrSvg = await generatePassportQrSvg(shareUrl, qrConfig);

  const isChromeless = context === 'print';

  return (
    <div
      className={cn(
        'min-h-screen flex flex-col items-center gap-6 p-6 sm:p-10',
        isChromeless ? 'bg-white text-black' : 'bg-[#0B0A0A] text-white',
      )}
    >
      {!isChromeless && (
        <header className="flex items-center gap-2 print:hidden">
          <Symbol size="sm" />
          <span className="text-sm opacity-70">Veridion Passport</span>
        </header>
      )}

      <PassportRenderer snapshot={snapshot} presentation={presentation} context={context} className="w-full max-w-xl" />

      {qrConfig.enabled && qrSvg && (
        <PassportQrCode url={shareUrl} config={qrConfig} svgMarkup={qrSvg} className="print:mt-4" />
      )}

      {warnings.length > 0 && !isChromeless && (
        <ul className="text-xs opacity-40 print:hidden">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}

      {!isChromeless && (
        <div className="flex items-center gap-3 print:hidden">
          <PrintPassportButton />
          <Link href="/dashboard/passport" className="text-xs underline opacity-70 hover:opacity-100">
            Get your own Passport
          </Link>
        </div>
      )}
    </div>
  );
}
