'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Badge } from '@/shared/ui/badge';
import { Separator } from '@/shared/components/separator';
import { StellarIcon } from '@/shared/components/icons/stellar-icon';
import { stellarApi, stellarMainnetApi, StellarAccountInfo } from '../../services/stellar-api';
import { useVerificationStore } from '../../store/verification-store';
import { useSynchronousVerification } from '../../hooks/use-synchronous-verification';
import { useWalletStore } from '@/features/wallet/store/wallet-store';
import { fetchAndNormalizeStellarSignals } from '@/features/scoring/normalization';
import { getSignal, type SignalBundle } from '@/features/scoring/types';
import { getSchema, CURRENT_ALGORITHM_VERSION, STELLAR_SIGNAL_WEIGHTS } from '@/features/scoring/schema';
import { computeScoreExplanation } from '@/features/scoring/engine';
import { CheckCircle, Circle, Loader2, ExternalLink } from 'lucide-react';

interface StellarVerificationProps {
  onComplete?: (points: number, level: string, transactionCount: number) => void;
  onError?: (error: string) => void;
}

const SIGNAL_LABELS: Record<string, { title: string; description: string }> = {
  txVolumeTier: { title: 'Transaction volume', description: 'Log-scaled transaction count' },
  accountAgeDays: { title: 'Account age', description: 'Time since the account’s first transaction' },
  activityRecency: { title: 'Activity recency', description: 'How recently the account transacted' },
  operationDiversity: { title: 'Operation diversity', description: 'Distinct operation types used' },
};

export const StellarVerification: React.FC<StellarVerificationProps> = ({ onComplete, onError }) => {
  const [accountId, setAccountId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<{
    transactionCount: number;
    points: number;
    level: string;
    accountInfo: StellarAccountInfo | null;
    signals: SignalBundle;
  } | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  const { recordVerificationEvent } = useVerificationStore();
  const { publicKey, isConnected, network } = useWalletStore();
  const { begin, succeed, fail } = useSynchronousVerification('stellar-transactions');

  // Auto-fill with connected wallet if available
  React.useEffect(() => {
    if (isConnected && publicKey) {
      setAccountId(publicKey);
    }
  }, [isConnected, publicKey]);

  const handleVerify = async () => {
    if (!accountId.trim()) {
      setError('Please enter a valid Stellar account ID');
      return;
    }

    setLoading(true);
    setError(null);
    setVerificationResult(null);
    begin();

    try {
      // Use the appropriate API based on network
      const api = network === 'testnet' ? stellarApi : stellarMainnetApi;

      // Check if the account exists
      const exists = await api.accountExists(accountId);
      if (!exists) {
        setError('Account not found on Stellar network');
        fail('Account not found on Stellar network');
        setLoading(false);
        return;
      }

      // Get account information
      const accountInfo = await api.getAccountInfo(accountId);
      if (!accountInfo) {
        setError('Could not retrieve account information');
        fail('Could not retrieve account information');
        setLoading(false);
        return;
      }

      // Fetch + normalize the signals the scoring engine actually reads
      const now = Date.now();
      const { signals, raw } = await fetchAndNormalizeStellarSignals(accountId, api, now);

      // Preview the real engine-computed points for this single event —
      // the schema-driven source of truth, not a hardcoded tier lookup.
      const schema = getSchema(CURRENT_ALGORITHM_VERSION);
      const preview = computeScoreExplanation(
        [
          {
            eventId: `preview:${accountId}:${now}`,
            providerId: 'stellar-transactions',
            category: 'blockchain',
            occurredAt: now,
            algorithmVersionAtCapture: schema.version,
            rawPayload: { signals },
            source: 'live',
          },
        ],
        schema,
        now,
      );
      const points = preview.totalScore;
      // Cosmetic label only — not used for scoring.
      const level = api.getVerificationLevel(raw.transactionCount);

      setVerificationResult({
        transactionCount: raw.transactionCount,
        points,
        level,
        accountInfo,
        signals,
      });

      // If there's at least 1 transaction, complete the verification
      if (raw.transactionCount >= 1) {
        recordVerificationEvent('stellar-transactions', 'blockchain', { signals });
        setIsVerified(true);
        succeed();
        onComplete?.(points, level, raw.transactionCount);
      } else {
        const message = 'Account must have at least 1 transaction to complete verification';
        fail(message);
        onError?.(message);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred during verification';
      setError(errorMessage);
      fail(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatBalance = (balance: { asset_type: string; balance: string; asset_code?: string }) => {
    if (balance.asset_type === 'native') {
      return `${parseFloat(balance.balance).toFixed(7)} XLM`;
    }
    return `${balance.balance} ${balance.asset_code || balance.asset_type}`;
  };

  const getPointsColor = (points: number) => {
    if (points >= 25) return 'bg-green-100 text-green-800';
    if (points >= 10) return 'bg-blue-100 text-blue-800';
    if (points >= 5) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getLevelColor = (level: string) => {
    if (level.includes('Expert')) return 'bg-purple-100 text-purple-800';
    if (level.includes('Active')) return 'bg-green-100 text-green-800';
    if (level.includes('Regular')) return 'bg-blue-100 text-blue-800';
    if (level.includes('Frequent')) return 'bg-yellow-100 text-yellow-800';
    if (level.includes('Occasional')) return 'bg-orange-100 text-orange-800';
    if (level.includes('New')) return 'bg-gray-100 text-gray-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg">
          <StellarIcon size={24} className="text-purple-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Stellar Wallet Verification</h3>
          <p className="text-sm text-gray-400">Verify your Stellar blockchain activity</p>
        </div>
      </div>

      {/* Wallet Connection Status */}
      {isConnected && publicKey && (
        <Card className="bg-gradient-to-br from-green-500/10 to-blue-500/10 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-green-400 mb-2">
              <CheckCircle className="h-5 w-5" />
              <p className="font-semibold">Wallet Connected</p>
            </div>
            <div className="text-sm text-gray-300">
              <p><span className="text-gray-400">Account:</span> <span className="font-mono">{publicKey}</span></p>
              <p><span className="text-gray-400">Network:</span> <span className="capitalize">{network}</span></p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Input Section */}
      <Card className="bg-gradient-to-br from-card-darker to-card-dark border-gray-700/30">
        <CardHeader>
          <CardTitle className="text-white">
            {isConnected ? 'Verify Connected Wallet' : 'Enter Stellar Account ID'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="GABC123... (Stellar Account ID)"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="flex-1 bg-gray-800/50 border-gray-600 text-white placeholder-gray-400"
              disabled={loading || isConnected}
            />
            <Button
              onClick={handleVerify}
              disabled={loading || !accountId.trim()}
              className="border border-white hover:bg-white/10"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Verify'
              )}
            </Button>
          </div>


          {!isConnected && (
            <p className="text-sm text-gray-400">
              Connect your wallet to automatically verify your account, or enter a Stellar account ID manually.
            </p>
          )}

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Signal Breakdown — schema-driven, not a hardcoded tier table */}
      <Card className="bg-gradient-to-br from-card-darker to-card-dark border-gray-700/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <StellarIcon size={20} className="text-purple-400" />
            Signal Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!verificationResult ? (
            <p className="text-sm text-gray-400">
              Verify an account to see how each on-chain signal contributes to your score.
            </p>
          ) : (
            <div className="space-y-2">
              {Object.entries(STELLAR_SIGNAL_WEIGHTS).map(([key, weight]) => {
                const value = getSignal(verificationResult.signals, key) ?? 0;
                const label = SIGNAL_LABELS[key] ?? { title: key, description: '' };
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20"
                  >
                    <div>
                      <p className="text-white font-medium">{label.title}</p>
                      <p className="text-sm text-gray-400">{label.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-400">{Math.round(value * 100)}%</p>
                      <p className="text-xs text-gray-400">weight {Math.round(weight * 100)}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verification Result */}
      {verificationResult && (
        <Card className="bg-gradient-to-br from-card-darker to-card-dark border-gray-700/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              {isVerified ? (
                <CheckCircle className="h-5 w-5 text-green-400" />
              ) : (
                <Circle className="h-5 w-5 text-gray-400" />
              )}
              Verification Result
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Account Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-400 mb-1">Account ID</p>
                <p className="font-mono text-sm text-white break-all bg-gray-800/50 p-2 rounded">
                  {verificationResult.accountInfo?.account_id}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">Sequence</p>
                <p className="font-mono text-sm text-white bg-gray-800/50 p-2 rounded">
                  {verificationResult.accountInfo?.sequence}
                </p>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Transaction Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-800/30 rounded-lg">
                <p className="text-2xl font-bold text-white">
                  {verificationResult.transactionCount}
                </p>
                <p className="text-sm text-gray-400">Total Transactions</p>
              </div>

              <div className="text-center p-4 bg-gray-800/30 rounded-lg">
                <Badge className={`${getPointsColor(verificationResult.points)} text-lg px-3 py-1`}>
                  {verificationResult.points.toFixed(1)} Points
                </Badge>
                <p className="text-sm text-gray-400 mt-1">Earned</p>
              </div>

              <div className="text-center p-4 bg-gray-800/30 rounded-lg">
                <Badge className={`${getLevelColor(verificationResult.level)} text-sm px-3 py-1`}>
                  {verificationResult.level}
                </Badge>
                <p className="text-sm text-gray-400 mt-1">Level</p>
              </div>
            </div>


            {/* Balances */}
            {verificationResult.accountInfo?.balances && verificationResult.accountInfo.balances.length > 0 && (
              <>
                <Separator className="my-4" />
                <div>
                  <p className="text-sm text-gray-400 mb-2">Account Balances</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {verificationResult.accountInfo?.balances.map((balance, index: number) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-gray-800/30 rounded">
                        <span className="text-white text-sm">
                          {balance.asset_type === 'native' ? 'XLM' : (balance.asset_code as string)}
                        </span>
                        <span className="font-mono text-sm text-gray-300">
                          {formatBalance(balance)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* View on Explorer */}
            <div className="pt-4">
              <Button
                variant="outline"
                className="w-full border-gray-600 text-gray-300 hover:bg-gray-700"
                onClick={() => window.open(`https://stellar.expert/explorer/testnet/account/${accountId}`, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View on Stellar Explorer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success Message */}
      {isVerified && (
        <Card className="bg-green-500/10 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle className="h-5 w-5" />
              <p className="font-semibold">Verification Completed!</p>
            </div>
            <p className="text-green-300 text-sm mt-1">
              You&apos;ve earned {verificationResult?.points.toFixed(1)} points for your Stellar activity.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StellarVerification;
