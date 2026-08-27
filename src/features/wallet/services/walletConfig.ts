// Wallet configuration and utilities

import type { WalletConnectionError } from '../types/wallet.types';

/**
 * Initialize wallet kit with proper error handling
 */
export async function initializeWalletKit() {
  try {
    const { 
      StellarWalletsKit,
      FreighterModule,
      AlbedoModule,
      RabetModule,
    } = await import('@creit.tech/stellar-wallets-kit');
    
    const { WALLET_CONFIG } = await import('@/config/wallet.config');
    
    const walletKit = new StellarWalletsKit({
      network: WALLET_CONFIG.network,
      modules: [
        new FreighterModule(),
        new AlbedoModule(),
        new RabetModule(),
      ],
    });
    
    return walletKit;
  } catch (error) {
    console.error('Failed to initialize wallet kit:', error);
    throw new Error('Wallet initialization failed');
  }
}

/**
 * Connect to wallet with error handling
 */
/** The slice of the wallet-kit surface that connecting needs. */
export interface WalletConnectionKit {
  openModal: (options: { onWalletSelected: (option: { id: string; name: string }) => Promise<void> }) => Promise<void>;
  setWallet: (id: string) => void;
  getAddress: () => Promise<{ address: string }>;
}

export async function connectWallet(
  kit: WalletConnectionKit,
  onWalletSelected: (publicKey: string, walletName: string, walletId: string) => void
): Promise<void> {
  try {
    await kit.openModal({
      onWalletSelected: async (option: { id: string; name: string }) => {
        kit.setWallet(option.id);
        const { address } = await kit.getAddress();
        onWalletSelected(address, option.name, option.id);
      },
    });
  } catch (error) {
    const walletError: WalletConnectionError = {
      code: 'CONNECTION_ERROR',
      message: error instanceof Error ? error.message : 'Failed to connect wallet',
      details: error,
    };
    throw walletError;
  }
}

/** The slice of the wallet-kit surface that message signing needs. */
export interface MessageSigningKit {
  setWallet: (id: string) => void;
  signMessage: (message: string) => Promise<{ signedMessage: string; signerAddress?: string }>;
}

/**
 * Ask the connected wallet to sign an arbitrary message (SEP-43).
 *
 * The adapter is re-selected first: a kit instance is built fresh per call and
 * has no memory of which wallet the user connected with — that lives in the
 * wallet store.
 *
 * Declining the prompt surfaces as a rejected promise from the wallet, which at
 * this level is indistinguishable from a genuine adapter failure. Both become
 * one typed error so the UI can say something plain either way.
 */
export async function signMessageWithWallet(
  kit: MessageSigningKit,
  walletId: string,
  message: string
): Promise<string> {
  try {
    kit.setWallet(walletId);
    const { signedMessage } = await kit.signMessage(message);
    if (!signedMessage) throw new Error('Wallet returned an empty signature');
    return signedMessage;
  } catch (error) {
    const walletError: WalletConnectionError = {
      code: 'SIGNING_ERROR',
      message: error instanceof Error ? error.message : 'Failed to sign the message',
      details: error,
    };
    throw walletError;
  }
}

/**
 * Validate wallet address format
 */
export function validateAddress(address: string): boolean {
  // Basic Stellar address validation
  return /^[A-Z0-9]{56}$/.test(address);
}

/**
 * Get short address format
 */
export function getShortAddress(address: string, startChars: number = 3, endChars: number = 3): string {
  if (!address) return '';
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}