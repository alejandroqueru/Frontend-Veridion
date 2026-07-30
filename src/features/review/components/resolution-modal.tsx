import React, { useState } from 'react';
import { AccountFlag, FlagStatus, useReviewStore } from '../store/review-store';
import * as Dialog from '@radix-ui/react-dialog'; // I noticed radix-ui in package.json earlier

interface ResolutionModalProps {
  flag: AccountFlag;
  onClose: () => void;
}

export function ResolutionModal({ flag, onClose }: ResolutionModalProps) {
  const resolveFlag = useReviewStore(s => s.resolveFlag);
  const [notes, setNotes] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<FlagStatus>('confirmed-human');

  const handleResolve = () => {
    // Hardcode reviewerId for mock purposes
    resolveFlag(flag.id, selectedStatus, 'admin-123', notes);
    onClose();
  };

  return (
    <Dialog.Root open={true} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 z-50 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] w-full max-w-md bg-[#111111] border border-[#222222] rounded-xl p-6 shadow-2xl z-50 text-white">
          <Dialog.Title className="text-xl font-semibold mb-4">
            Resolve Flag for {flag.accountId}
          </Dialog.Title>
          
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-400 mb-1">Risk Score</p>
              <p className="text-lg font-mono text-red-400">{flag.riskScore}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-400 mb-2">Resolution</p>
              <select 
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as FlagStatus)}
                className="w-full bg-[#1A1A1A] border border-[#333] rounded-lg p-2 text-white outline-none focus:border-blue-500"
              >
                <option value="confirmed-human">Confirm as Human</option>
                <option value="confirmed-fraudulent">Confirm as Fraudulent</option>
                <option value="dismissed">Dismiss Flag</option>
              </select>
            </div>

            <div>
              <p className="text-sm text-gray-400 mb-2">Notes</p>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional resolution notes..."
                className="w-full h-24 bg-[#1A1A1A] border border-[#333] rounded-lg p-3 text-white outline-none focus:border-blue-500 resize-none"
              />
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button 
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[#222] hover:bg-[#333] text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleResolve}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              >
                Submit Resolution
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
