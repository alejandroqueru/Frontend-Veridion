import React, { useState } from 'react';
import { useReviewStore, AccountFlag } from '../store/review-store';
import { ResolutionModal } from './resolution-modal';

export function ReviewQueue() {
  const flags = useReviewStore(s => s.flags);
  const [selectedFlag, setSelectedFlag] = useState<AccountFlag | null>(null);

  const pendingFlags = flags.filter(f => f.status === 'flagged');
  const resolvedFlags = flags.filter(f => f.status !== 'flagged');

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Pending Reviews</h2>
        {pendingFlags.length === 0 ? (
          <div className="bg-[#111111] border border-[#222] rounded-xl p-8 text-center text-gray-500">
            No accounts currently flagged for review.
          </div>
        ) : (
          <div className="bg-[#111111] border border-[#222] rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#1A1A1A] border-b border-[#222]">
                <tr>
                  <th className="p-4 text-gray-400 font-medium">Account ID</th>
                  <th className="p-4 text-gray-400 font-medium">Risk Score</th>
                  <th className="p-4 text-gray-400 font-medium">Flagged At</th>
                  <th className="p-4 text-gray-400 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222]">
                {pendingFlags.map(flag => (
                  <tr key={flag.id} className="hover:bg-[#151515] transition-colors">
                    <td className="p-4 text-white font-mono">{flag.accountId}</td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                        {flag.riskScore}
                      </span>
                    </td>
                    <td className="p-4 text-gray-400">
                      {new Date(flag.flaggedAt).toLocaleString()}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => setSelectedFlag(flag)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#222] hover:bg-[#333] text-white transition-colors"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Resolution History</h2>
        {resolvedFlags.length === 0 ? (
          <div className="bg-[#111111] border border-[#222] rounded-xl p-8 text-center text-gray-500">
            No resolved flags yet.
          </div>
        ) : (
          <div className="bg-[#111111] border border-[#222] rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#1A1A1A] border-b border-[#222]">
                <tr>
                  <th className="p-4 text-gray-400 font-medium">Account ID</th>
                  <th className="p-4 text-gray-400 font-medium">Risk Score</th>
                  <th className="p-4 text-gray-400 font-medium">Resolution</th>
                  <th className="p-4 text-gray-400 font-medium">Resolved By</th>
                  <th className="p-4 text-gray-400 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222]">
                {resolvedFlags.map(flag => (
                  <tr key={flag.id} className="hover:bg-[#151515] transition-colors">
                    <td className="p-4 text-white font-mono">{flag.accountId}</td>
                    <td className="p-4 text-gray-300">{flag.riskScore}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        flag.status === 'confirmed-human' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                        flag.status === 'confirmed-fraudulent' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        'bg-gray-500/10 text-gray-400 border-gray-500/20'
                      }`}>
                        {flag.status}
                      </span>
                    </td>
                    <td className="p-4 text-gray-400">{flag.resolvedBy}</td>
                    <td className="p-4 text-gray-400">
                      {flag.resolvedAt ? new Date(flag.resolvedAt).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedFlag && (
        <ResolutionModal 
          flag={selectedFlag} 
          onClose={() => setSelectedFlag(null)} 
        />
      )}
    </div>
  );
}
