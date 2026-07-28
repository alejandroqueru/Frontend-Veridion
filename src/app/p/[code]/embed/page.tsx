import { PassportRenderer } from '@/features/passport/components/passport-renderer';
import { decodePassportSnapshot } from '@/features/passport/encoding';

interface EmbedPageProps {
  params: Promise<{ code: string }>;
}

/**
 * Iframe-embeddable passport: zero chrome (no header/CTA/footer), sized to
 * fill its container. Same decode + `PassportRenderer` call as the public
 * page — only the surrounding markup differs.
 */
export default async function EmbedPassportPage({ params }: EmbedPageProps) {
  const { code } = await params;
  const { snapshot, presentation } = decodePassportSnapshot(code);

  return (
    <div className="bg-[#0B0A0A] p-3">
      <PassportRenderer snapshot={snapshot} presentation={presentation} context="embed" />
    </div>
  );
}
