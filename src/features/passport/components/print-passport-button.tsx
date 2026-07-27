'use client';

import { Button } from '@/shared/ui/button';

/** Export view, pragmatically: the browser's native print-to-PDF, so no rasterization dependency is needed for a downloadable passport. */
export function PrintPassportButton() {
  return (
    <Button type="button" size="sm" variant="outline" className="print:hidden" onClick={() => window.print()}>
      Print / Save as PDF
    </Button>
  );
}
