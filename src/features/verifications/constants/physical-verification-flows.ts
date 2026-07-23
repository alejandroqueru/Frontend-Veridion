// Per-method field configuration for the Physical Verification multi-step
// workflow. One generic component (`PhysicalVerificationFlow`) renders any
// of these, rather than four bespoke near-duplicate components.

export type PhysicalFieldConfig =
  | { type: 'text'; id: string; label: string; placeholder?: string }
  | { type: 'checkbox'; id: string; label: string };

export interface PhysicalFlowConfig {
  id: string;
  instructions: string;
  fields: readonly PhysicalFieldConfig[];
  processingLabel: string;
  points: number;
}

export const PHYSICAL_FLOWS: Record<string, PhysicalFlowConfig> = {
  'government-id': {
    id: 'government-id',
    instructions:
      'Provide your legal name and government ID number. We use this to verify your identity.',
    fields: [
      { type: 'text', id: 'fullName', label: 'Full legal name', placeholder: 'Jane Doe' },
      { type: 'text', id: 'idNumber', label: 'Government ID number', placeholder: 'e.g. X1234567' },
    ],
    processingLabel: 'Verifying your identity document…',
    points: 1000,
  },
  binance: {
    id: 'binance',
    instructions: 'Enter your Binance Account Bound Token (BABT) ID to confirm your Binance KYC status.',
    fields: [{ type: 'text', id: 'babtId', label: 'BABT token ID', placeholder: 'e.g. 0xabc123…' }],
    processingLabel: 'Confirming your Binance KYC status…',
    points: 1000,
  },
  biometrics: {
    id: 'biometrics',
    instructions: 'Confirm you consent to a one-time facial liveness check to prove you are a unique human.',
    fields: [{ type: 'checkbox', id: 'consent', label: 'I consent to a facial liveness check' }],
    processingLabel: 'Running liveness check…',
    points: 1000,
  },
  'proof-clean-hands': {
    id: 'proof-clean-hands',
    instructions: 'Confirm you are not listed on any government sanctions list.',
    fields: [{ type: 'checkbox', id: 'confirmation', label: 'I confirm I am not on any sanctions list' }],
    processingLabel: 'Screening against sanctions lists…',
    points: 1000,
  },
};

export function getPhysicalFlowConfig(id: string): PhysicalFlowConfig | null {
  return PHYSICAL_FLOWS[id] ?? null;
}
