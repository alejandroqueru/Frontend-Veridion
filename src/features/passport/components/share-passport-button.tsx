'use client';

import Link from 'next/link';
import { Button } from '@/shared/ui/button';

export function ShareToPassportButton() {
  return (
    <Button asChild size="sm" variant="outline">
      <Link href="/dashboard/passport">Share Passport</Link>
    </Button>
  );
}
