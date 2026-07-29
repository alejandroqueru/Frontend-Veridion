'use client';

import { useState } from 'react';
import {
  Download,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Lock,
  Database,
  FileText,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { SectionContainer } from '@/shared/components/section-container';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/shared/ui/dialog';
import { useVerificationStore } from '@/features/verifications/store/verification-store';
import { useWalletStore } from '@/features/wallet/store/wallet-store';
import { useAuditLogStore } from '../audit-log-store';
import { buildDataExport, downloadDataExport } from '../export-service';
import { cascadeDeleteUserData } from '../deletion-service';
import { RETENTION_POLICIES } from '../retention-config';
import { AuditLogViewer } from './audit-log-viewer';

// ── Export Card ───────────────────────────────────────────────────────

function ExportCard() {
  const [isExporting, setIsExporting] = useState(false);
  const [lastExportedAt, setLastExportedAt] = useState<number | null>(null);

  const events = useVerificationStore((s) => s.events);
  const completedVerifications = useVerificationStore((s) => s.completedVerifications);
  const walletState = useWalletStore((s) => ({
    publicKey: s.publicKey,
    walletName: s.walletName,
    network: s.network,
  }));
  const auditEntries = useAuditLogStore((s) => s.entries);
  const appendEntry = useAuditLogStore((s) => s.appendEntry);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const now = Date.now();
      const payload = buildDataExport({
        events,
        completedVerifications,
        walletState,
        auditEntries,
        now,
      });
      downloadDataExport(payload);
      appendEntry('export', {
        eventCount: events.length,
        walletPublicKey: walletState.publicKey,
        exportedAt: new Date(now).toISOString(),
      });
      setLastExportedAt(now);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      className="rounded-xl border border-[#1a2a3a] bg-[#0d1f2d]/60 p-5 flex flex-col gap-4"
      style={{ boxShadow: '0 0 20px rgba(5,91,208,0.06)' }}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 shrink-0">
          <Download className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-white">Download my data</h4>
          <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
            Export a complete, machine-readable JSON file of all verification records, wallet
            metadata, and your consent audit log.
          </p>
        </div>
      </div>

      {/* What's included */}
      <ul className="space-y-1.5">
        {[
          'Verification events with timestamps and categories',
          'Wallet public key and network metadata',
          'Consent & access audit log',
        ].map((item) => (
          <li key={item} className="flex items-center gap-2 text-xs text-gray-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            {item}
          </li>
        ))}
      </ul>

      {/* Last export */}
      {lastExportedAt && (
        <p className="text-xs text-gray-500 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Last exported{' '}
          {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
            new Date(lastExportedAt),
          )}
        </p>
      )}

      {/* CTA */}
      <button
        id="btn-export-data"
        onClick={handleExport}
        disabled={isExporting}
        className="mt-auto flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isExporting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Preparing export…
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            Export my data
          </>
        )}
      </button>
    </div>
  );
}

// ── Erasure Card ──────────────────────────────────────────────────────

function ErasureCard({ onDeleted }: { onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const eventsCount = useVerificationStore((s) => s.events.length);
  const machinesCount = useVerificationStore((s) => Object.keys(s.machines).length);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      cascadeDeleteUserData();
      setOpen(false);
      onDeleted();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div
        className="rounded-xl border border-red-900/30 bg-red-950/20 p-5 flex flex-col gap-4"
        style={{ boxShadow: '0 0 20px rgba(220,38,38,0.04)' }}
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 shrink-0">
            <Trash2 className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Request data deletion</h4>
            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
              Permanently erase all verification records and identity data from Veridion's
              first-party stores. This action cannot be undone.
            </p>
          </div>
        </div>

        {/* What will be deleted */}
        <ul className="space-y-1.5">
          {[
            `${eventsCount} verification event${eventsCount !== 1 ? 's' : ''}`,
            `${machinesCount} in-flight session state record${machinesCount !== 1 ? 's' : ''}`,
            'Wallet connection & identity binding',
          ].map((item) => (
            <li key={item} className="flex items-center gap-2 text-xs text-gray-400">
              <Trash2 className="w-3.5 h-3.5 text-red-400/70 shrink-0" />
              {item}
            </li>
          ))}
        </ul>

        {/* Note: audit log preserved */}
        <p className="text-xs text-gray-500 flex items-center gap-1.5 border-t border-red-900/20 pt-3">
          <Lock className="w-3 h-3 shrink-0 text-gray-600" />
          Your audit log (export &amp; deletion records) is retained for compliance and cannot be
          erased.
        </p>

        {/* CTA */}
        <button
          id="btn-request-deletion"
          onClick={() => setOpen(true)}
          className="mt-auto flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-red-300 border border-red-700/40 hover:bg-red-900/30 hover:border-red-600/50 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Request erasure
        </button>
      </div>

      {/* Confirmation dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#0B0A0A] border-red-900/40 text-white max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-full bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <DialogTitle className="text-white">Permanently delete your data?</DialogTitle>
            </div>
            <DialogDescription className="text-gray-400 text-sm leading-relaxed">
              This will cascade across every first-party store holding your identity data.
            </DialogDescription>
          </DialogHeader>

          {/* Checklist */}
          <div className="rounded-lg border border-red-900/30 bg-red-950/20 p-4 space-y-2">
            {[
              { label: `${eventsCount} verification events`, key: 'events' },
              { label: `${machinesCount} session records`, key: 'machines' },
              { label: 'Wallet identity binding', key: 'wallet' },
              { label: 'Stored provider tokens / OAuth state', key: 'oauth' },
            ].map(({ label, key }) => (
              <div key={key} className="flex items-center gap-2 text-sm text-red-200/80">
                <Trash2 className="w-3.5 h-3.5 text-red-400 shrink-0" />
                {label}
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-500 leading-relaxed">
            Your audit log entries (this deletion request, any prior exports) are retained for
            regulatory compliance and{' '}
            <span className="text-gray-400 font-medium">cannot</span> be deleted.
          </p>

          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose
              id="btn-cancel-deletion"
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </DialogClose>
            <button
              id="btn-confirm-deletion"
              onClick={handleConfirm}
              disabled={isDeleting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Yes, permanently delete
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Retention Policy Card ─────────────────────────────────────────────

function RetentionPolicyCard() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-[#1a2a3a] bg-[#0d1f2d]/40 p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 shrink-0">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-white">Data retention policy</h4>
          <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
            Configurable retention windows per data category, enforced automatically on every
            dashboard load.
          </p>
        </div>
      </div>

      {/* Policy table */}
      <div className="rounded-lg border border-[#1a2a3a] overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#1a2a3a] bg-[#0a1520]/60">
              <th className="text-left px-3 py-2 text-gray-500 font-medium">Category</th>
              <th className="text-left px-3 py-2 text-gray-500 font-medium">Retention window</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a2a3a]">
            {RETENTION_POLICIES.filter((p) => p.category !== 'otp').map((policy) => (
              <tr key={policy.category} className="group hover:bg-white/2 transition-colors">
                <td className="px-3 py-2.5 text-gray-300 font-medium">{policy.label}</td>
                <td className="px-3 py-2.5 text-gray-500">
                  {policy.windowMs / (1000 * 60 * 60 * 24) >= 365
                    ? `${Math.round(policy.windowMs / (1000 * 60 * 60 * 24 * 365))} year${
                        Math.round(policy.windowMs / (1000 * 60 * 60 * 24 * 365)) !== 1 ? 's' : ''
                      }`
                    : policy.windowMs / (1000 * 60 * 60) >= 1
                      ? `${Math.round(policy.windowMs / (1000 * 60 * 60))} hour${
                          Math.round(policy.windowMs / (1000 * 60 * 60)) !== 1 ? 's' : ''
                        }`
                      : `${Math.round(policy.windowMs / (1000 * 60))} minutes`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Expandable descriptions */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-400 transition-colors self-start"
        id="btn-toggle-retention-details"
      >
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {expanded ? 'Hide' : 'Show'} policy details
      </button>

      {expanded && (
        <ul className="space-y-2">
          {RETENTION_POLICIES.filter((p) => p.category !== 'otp').map((policy) => (
            <li key={policy.category} className="text-xs text-gray-500 flex gap-2">
              <Database className="w-3.5 h-3.5 shrink-0 text-emerald-500/50 mt-0.5" />
              <span>
                <span className="text-gray-400 font-medium">{policy.label}:</span>{' '}
                {policy.description}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Audit Log Section ─────────────────────────────────────────────────

function AuditLogSection() {
  const [expanded, setExpanded] = useState(true);
  const entryCount = useAuditLogStore((s) => s.entries.length);

  return (
    <div className="mt-2">
      <button
        id="btn-toggle-audit-log"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-3 py-3 text-sm font-medium text-white hover:text-gray-300 transition-colors"
      >
        <span className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-500" />
          Consent &amp; access audit log
          {entryCount > 0 && (
            <span className="text-xs text-gray-600 bg-white/5 rounded-full px-2 py-0.5">
              {entryCount}
            </span>
          )}
        </span>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>

      {expanded && (
        <div className="pt-1 pb-3">
          <AuditLogViewer />
        </div>
      )}
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────

interface DataManagementPanelProps {
  onDeleted?: () => void;
}

/**
 * Self-service data management panel surfaced on the dashboard.
 * Contains three action cards (export, erasure, retention policy)
 * and the consent & access audit log viewer.
 */
export function DataManagementPanel({ onDeleted }: DataManagementPanelProps) {
  const handleDeleted = () => {
    onDeleted?.();
  };

  return (
    <SectionContainer className="p-3 sm:p-4 lg:p-6">
      {/* Section header */}
      <div className="flex items-start gap-2 mb-5 sm:mb-6">
        <div className="p-1.5 bg-[#112541] border-[1.5px] border-[#055BD0] rounded-full">
          <ShieldCheck className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
        </div>
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-white">
            Data portability &amp; privacy
          </h3>
          <p className="text-xs sm:text-[13px] text-gray-400 mt-0.5">
            Export your data, request erasure, and review your consent audit log
          </p>
        </div>
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <ExportCard />
        <ErasureCard onDeleted={handleDeleted} />
        <RetentionPolicyCard />
      </div>

      {/* Divider */}
      <div className="border-t border-[#1a2a3a] mt-2" />

      {/* Audit log */}
      <AuditLogSection />
    </SectionContainer>
  );
}
