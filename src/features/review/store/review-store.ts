import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type FlagStatus = 'flagged' | 'confirmed-human' | 'confirmed-fraudulent' | 'dismissed';

export interface RiskSignal {
  source: string;
  score: number;
  reason: string;
}

export interface AccountFlag {
  id: string;
  accountId: string; // The wallet address or user ID
  status: FlagStatus;
  riskScore: number;
  signals: RiskSignal[];
  flaggedAt: number;
  resolvedBy?: string;
  resolvedAt?: number;
  resolutionNotes?: string;
}

export interface ReviewState {
  isAdmin: boolean;
  riskScore: number;
  riskThreshold: number;
  flags: AccountFlag[];

  // Actions
  setAdminMode: (isAdmin: boolean) => void;
  setRiskThreshold: (threshold: number) => void;
  setRiskScore: (accountId: string, score: number, signals: RiskSignal[]) => void;
  resolveFlag: (flagId: string, status: FlagStatus, reviewerId: string, notes?: string) => void;
  getFlagStatusForAccount: (accountId: string) => FlagStatus | null;
}

export const useReviewStore = create<ReviewState>()(
  persist(
    (set, get) => ({
      isAdmin: false,
      riskScore: 0,
      riskThreshold: 80,
      flags: [],

      setAdminMode: (isAdmin) => set({ isAdmin }),
      
      setRiskThreshold: (riskThreshold) => set({ riskThreshold }),
      
      setRiskScore: (accountId, score, signals) => {
        set({ riskScore: score });
        const { riskThreshold, flags } = get();
        
        if (score >= riskThreshold) {
          // Check if there is an active flag
          const activeFlag = flags.find(f => f.accountId === accountId && f.status === 'flagged');
          if (activeFlag) {
            // Update the flag with the higher score if the risk keeps increasing
            if (score > activeFlag.riskScore) {
              set({
                flags: flags.map(f => 
                  f.id === activeFlag.id 
                    ? { ...f, riskScore: score, signals }
                    : f
                )
              });
            }
            return; // Already flagged, updated if necessary
          }
          
          const dismissedFlags = flags.filter(f => f.accountId === accountId && f.status === 'dismissed');
          const isSameSignal = dismissedFlags.some(f => {
            // Simplistic check to avoid re-triggering for exact same signals
            return f.riskScore === score && f.signals.length === signals.length;
          });
          
          if (!isSameSignal) {
            const newFlag: AccountFlag = {
              id: `${accountId}-${Date.now()}`,
              accountId,
              status: 'flagged',
              riskScore: score,
              signals,
              flaggedAt: Date.now(),
            };
            set({ flags: [...flags, newFlag] });
          }
        }
      },
      
      resolveFlag: (flagId, status, reviewerId, notes) => {
        const { flags } = get();
        set({
          flags: flags.map(f => 
            f.id === flagId 
              ? { ...f, status, resolvedBy: reviewerId, resolvedAt: Date.now(), resolutionNotes: notes }
              : f
          )
        });
      },
      
      getFlagStatusForAccount: (accountId) => {
        const { flags } = get();
        // Since flags are appended, the last one is the most recent
        const accountFlags = flags.filter(f => f.accountId === accountId);
        if (accountFlags.length > 0) {
          return accountFlags[accountFlags.length - 1].status;
        }
        return null;
      }
    }),
    {
      name: 'review-storage',
    }
  )
);
