'use client';

import { useMemo, useState } from 'react';
import { DashboardLayout } from '@/features/dashboard/layout/dashboard-layout';
import { SectionContainer } from '@/shared/components/section-container';
import { Button } from '@/shared/ui/button';
import { usePassportSnapshot } from '@/features/passport/hooks';
import { PassportRenderer } from '@/features/passport/components/passport-renderer';
import { PassportEditorControls } from '@/features/passport/components/passport-editor-controls';
import { PassportQrCode } from '@/features/passport/components/passport-qr-code';
import { encodePassportSnapshot } from '@/features/passport/encoding';
import { DEFAULT_PRESENTATION_OPTIONS } from '@/features/passport/types';
import type { PassportPresentationOptions } from '@/features/passport/types';

export default function PassportEditorPage() {
  const snapshot = usePassportSnapshot();
  const [presentation, setPresentation] = useState<PassportPresentationOptions>(DEFAULT_PRESENTATION_OPTIONS);
  const [copied, setCopied] = useState(false);

  const shareCode = useMemo(() => encodePassportSnapshot(snapshot, presentation), [snapshot, presentation]);
  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/p/${shareCode}`;
  }, [shareCode]);

  async function handleCopy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <DashboardLayout>
      <div className="py-6 px-4 sm:py-8 sm:px-6 lg:py-12 lg:px-16 xl:px-24">
        <h1 className="text-lg text-lighter-gray-text mb-4 sm:mb-6">Share your Passport</h1>
        <div className="grid gap-6 lg:grid-cols-[280px_1fr] items-start">
          <SectionContainer className="p-4">
            <h2 className="text-sm font-semibold mb-4">Customize</h2>
            <PassportEditorControls presentation={presentation} onChange={setPresentation} />
          </SectionContainer>

          <SectionContainer className="p-4 sm:p-6 flex flex-col items-center gap-4">
            <PassportRenderer snapshot={snapshot} presentation={presentation} context="editor" className="w-full" />

            {presentation.qr.enabled && shareUrl && (
              <PassportQrCode url={shareUrl} config={presentation.qr} />
            )}

            <div className="flex items-center gap-2 w-full">
              <input
                readOnly
                value={shareUrl}
                aria-label="Share link"
                onFocus={(event) => event.target.select()}
                className="flex-1 min-w-0 text-xs rounded border border-custom-border bg-transparent px-2 py-1.5 text-white/80"
              />
              <Button type="button" size="sm" onClick={handleCopy}>
                {copied ? 'Copied!' : 'Copy link'}
              </Button>
            </div>
          </SectionContainer>
        </div>
      </div>
    </DashboardLayout>
  );
}
