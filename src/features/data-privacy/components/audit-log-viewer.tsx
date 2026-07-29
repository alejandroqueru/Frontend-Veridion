'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Lock, Download, Trash2, Share2, ShieldAlert } from 'lucide-react';
import { useAuditLogStore } from '../audit-log-store';
import type { AuditLogEntry, AuditAction } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────

function formatTimestamp(ms: number): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(ms));
}

const ACTION_META: Record<
  AuditAction,
  { label: string; icon: React.ReactNode; color: string; bg: string }
> = {
  export: {
    label: 'Data exported',
    icon: <Download className="w-3.5 h-3.5" />,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
  },
  deletion: {
    label: 'Data deletion requested',
    icon: <Trash2 className="w-3.5 h-3.5" />,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
  },
  access: {
    label: 'Data shared with provider',
    icon: <Share2 className="w-3.5 h-3.5" />,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/20',
  },
  purge: {
    label: 'Automatic retention purge',
    icon: <ShieldAlert className="w-3.5 h-3.5" />,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
  },
};

// ── Single row ────────────────────────────────────────────────────────

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  const [open, setOpen] = useState(false);
  const meta = ACTION_META[entry.action] ?? ACTION_META.access;
  const hasDetails = Object.keys(entry.details).length > 0;

  return (
    <div
      className={`rounded-lg border px-4 py-3 transition-colors ${meta.bg}`}
    >
      <button
        onClick={() => hasDetails && setOpen((o) => !o)}
        className="w-full flex items-center gap-3 text-left"
        aria-expanded={open}
        disabled={!hasDetails}
        id={`audit-entry-${entry.id}`}
      >
        {/* Action icon */}
        <span className={`shrink-0 ${meta.color}`}>{meta.icon}</span>

        {/* Label + timestamp */}
        <span className="flex-1 min-w-0">
          <span className={`text-sm font-medium ${meta.color}`}>{meta.label}</span>
          <span className="block text-xs text-gray-500 mt-0.5">
            {formatTimestamp(entry.timestamp)}
          </span>
        </span>

        {/* Immutability badge */}
        <span
          title="This audit record cannot be altered after being written"
          className="flex items-center gap-1 text-xs text-gray-600 shrink-0"
        >
          <Lock className="w-3 h-3" />
          <span className="hidden sm:inline">immutable</span>
        </span>

        {/* Expand toggle */}
        {hasDetails && (
          <span className="text-gray-600 shrink-0 ml-1">
            {open ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </span>
        )}
      </button>

      {/* Expanded details */}
      {open && hasDetails && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap break-all leading-relaxed">
            {JSON.stringify(entry.details, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Viewer ────────────────────────────────────────────────────────────

/**
 * Accordion-style audit log viewer.
 * Renders all audit entries in append order (oldest first) with icons,
 * timestamps, lock badges, and expandable raw details.
 */
export function AuditLogViewer() {
  const entries = useAuditLogStore((s) => s.entries);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <Lock className="w-8 h-8 text-gray-700" />
        <p className="text-sm text-gray-500">No audit events recorded yet.</p>
        <p className="text-xs text-gray-600 max-w-xs">
          Export and deletion requests, along with any provider access events, will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" role="log" aria-label="Consent and access audit log">
      {/* Legend */}
      <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
        <Lock className="w-3 h-3" />
        All records are cryptographically append-only and cannot be altered after being written.
      </p>

      {/* Entries — newest first for readability */}
      {[...entries].reverse().map((entry) => (
        <AuditRow key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
