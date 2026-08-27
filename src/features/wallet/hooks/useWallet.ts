import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWalletStore } from '../store/wallet-store';
import {
  getShortAddress as formatShortAddress,
  initializeWalletKit,
  signMessageWithWallet,
} from '../services/walletConfig';
import type { WalletConnectionError } from '../types/wallet.types';

export function useWallet() {
  const router = useRouter();
  const {
    isConnected,
    isConnecting,
    publicKey,
    walletName,
    walletId,
    network,
    setConnecting,
    setWalletInfo,
    disconnect,
    setNetwork,
  } = useWalletStore();

  const connectWallet = useCallback(
    (publicKey: string, walletName: string, walletId: string) => {
      setWalletInfo(publicKey, walletName, walletId);
      // Navigate to dashboard after successful connection
      router.push('/dashboard');
    },
    [setWalletInfo, router]
  );

  /**
   * Sign an authentication challenge with the connected wallet.
   *
   * Connecting a wallet only reports an address — it proves nothing, since any
   * extension can claim any public key. This is the step that actually proves
   * control of the key, and it is what `/api/v1/auth/verify` checks.
   */
  const signChallenge = useCallback(
    async (message: string): Promise<string> => {
      if (!walletId) {
        const error: WalletConnectionError = {
          code: 'NOT_CONNECTED',
          message: 'Connect a wallet before signing.',
        };
        throw error;
      }

      const kit = await initializeWalletKit();
      return signMessageWithWallet(kit, walletId, message);
    },
    [walletId]
  );

  const handleDisconnect = useCallback(() => {
    disconnect();
    // Navigate back to home
    router.push('/');
  }, [disconnect, router]);

  const handleConnectionError = useCallback(
    (error: WalletConnectionError) => {
      console.error('Wallet connection error:', error);
      setConnecting(false);
      // You could add toast notifications here
    },
    [setConnecting]
  );

  const switchNetwork = useCallback(
    (newNetwork: 'testnet' | 'mainnet') => {
      setNetwork(newNetwork);
    },
    [setNetwork]
  );

  const getShortAddress = useCallback(
    (address?: string) => {
      const addr = address || publicKey;
      if (!addr) return '';
      return formatShortAddress(addr);
    },
    [publicKey]
  );

  return {
    // State
    isConnected,
    isConnecting,
    publicKey,
    walletName,
    walletId,
    network,

    // Actions
    connectWallet,
    signChallenge,
    handleDisconnect,
    handleConnectionError,
    switchNetwork,
    getShortAddress,
    
    // Computed
    shortAddress: getShortAddress(),
    isTestnet: network === 'testnet',
    isMainnet: network === 'mainnet',
  };
}
