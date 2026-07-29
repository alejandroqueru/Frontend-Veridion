'use client';

import { ShieldOff, RotateCcw } from 'lucide-react';

/**
 * Full-width amber banner displayed after a successful data erasure.
 * Visually distinct from both the "never verified" empty state (blue) and
 * the normal verified dashboard, satisfying the spec requirement that
 * "deleted accounts aren't silently indistinguishable from new ones."
 */
export function PostDeletionState() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full rounded-xl border-2 border-amber-500/40 bg-amber-950/30 px-6 py-8 flex flex-col items-center gap-4 text-center backdrop-blur-sm"
      style={{
        background:
          'linear-gradient(135deg, rgba(120,53,15,0.25) 0%, rgba(78,35,9,0.35) 100%)',
        boxShadow: '0 0 40px rgba(245,158,11,0.08)',
      }}
    >
      {/* Icon */}
      <div className="flex items-center justify-center w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30">
        <ShieldOff className="w-7 h-7 text-amber-400" />
      </div>

      {/* Heading */}
      <div>
        <h2 className="text-xl font-semibold text-amber-200 mb-1">
          Your data has been permanently erased
        </h2>
        <p className="text-sm text-amber-300/70 max-w-md leading-relaxed">
          All verification records and identity data have been removed from Veridion's
          first-party stores. This account is now in a{' '}
          <span className="text-amber-300 font-medium">deleted state</span> — distinct from a
          new account that has never been verified.
        </p>
      </div>

      {/* Divider */}
      <div className="w-full max-w-xs border-t border-amber-500/20" />

      {/* Next steps */}
      <div className="flex flex-col gap-2 text-sm text-amber-300/60 max-w-sm">
        <div className="flex items-center gap-2">
          <RotateCcw className="w-4 h-4 shrink-0 text-amber-400/60" />
          <span>Reconnect your wallet and complete verifications to build a fresh profile.</span>
        </div>
        <p className="text-xs text-amber-400/40 mt-1">
          Your audit log (export &amp; deletion records) is retained for regulatory compliance and
          cannot be erased.
        </p>
      </div>
    </div>
  );
}
