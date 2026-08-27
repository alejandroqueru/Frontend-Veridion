// Wallet-specific type definitions

export type NetworkType = 'testnet' | 'mainnet';

export interface WalletInfo {
  publicKey: string;
  walletName: string;
  network: NetworkType;
}

export interface WalletConnectionError {
  code: string;
  message: string;
  details?: unknown;
}

// Supported wallet types
export type SupportedWallet = 
  | 'freighter'
  | 'albedo'
  | 'rabet'
  | 'walletconnect'
  | 'xbull';

export interface WalletOption {
  id: SupportedWallet;
  name: string;
  icon: string;
  description: string;
}

// Wallet state interface
export interface WalletState {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  
  // Wallet info
  publicKey: string | null;
  walletName: string | null;
  walletId: string | null;

  // Network
  network: NetworkType;

  // Actions
  setConnecting: (connecting: boolean) => void;
  setConnected: (connected: boolean) => void;
  setWalletInfo: (publicKey: string, walletName: string, walletId: string) => void;
  disconnect: () => void;
  setNetwork: (network: NetworkType) => void;
}
