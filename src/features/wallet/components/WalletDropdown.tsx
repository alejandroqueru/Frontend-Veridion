"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/ui/button';
import { useWallet } from '../hooks/useWallet';
import { ChevronDown, Wallet, LogOut } from 'lucide-react';

interface WalletDropdownProps {
  className?: string;
}

export function WalletDropdown({ className = '' }: WalletDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  
  const [isWalletKitReady, setIsWalletKitReady] = useState(false);
  const [kit, setKit] = useState<any>(null);

  useEffect(() => {
    import('../services/walletConfig').then(({ initializeWalletKit }) => {
      initializeWalletKit()
        .then((walletKit) => {
          setKit(walletKit);
          setIsWalletKitReady(true);
        })
        .catch((error) => {
          console.error('Failed to initialize wallet kit:', error);
          setIsWalletKitReady(true);
        });
    });
  }, []);

  const {
    isConnected,
    publicKey,
    walletName,
    shortAddress,
    isTestnet,
    handleDisconnect,
    connectWallet,
    handleConnectionError,
  } = useWallet();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleConnectClick = async () => {
    if (!kit) return;
    try {
      const { connectWallet: connectWalletService } = await import('../services/walletConfig');
      await connectWalletService(kit, connectWallet);
    } catch (error) {
      handleConnectionError({
        code: 'CONNECTION_ERROR',
        message: error instanceof Error ? error.message : 'Failed to connect wallet',
        details: error,
      });
    }
  };

  // If not connected, show the connect button
  if (!isConnected || !publicKey) {
    return (
      <div className={className}>
        <Button
          onClick={handleConnectClick}
          disabled={!isWalletKitReady || !kit}
          className="bg-transparent border border-white/20 hover:bg-white/10 px-6 py-3 text-sm text-white rounded-lg transition-colors"
        >
          <Wallet size={16} className="mr-2" />
          {!isWalletKitReady ? 'Loading...' : 'Connect Wallet'}
        </Button>
      </div>
    );
  }

  const handleDisconnectClick = () => {
    handleDisconnect();
    setIsOpen(false);
    router.push('/');
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Wallet Button */}
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-4 px-10 py-6 bg-white/5 border-white/10 hover:bg-white/10 text-white"
      >
        <div className="flex items-center gap-4 pl-2">
          <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col items-start ">
            <span className="text-base font-medium">{shortAddress}</span>
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${isTestnet ? 'bg-yellow-500' : 'bg-green-500'}`} />
              <span className="text-xs text-gray-400">{isTestnet ? 'Testnet' : 'Mainnet'}</span>
            </div>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ease-in-out ${isOpen ? 'rotate-180' : 'rotate-0'}`} />
      </Button>

      {/* Dropdown Menu */}
      <div className={`absolute right-0 top-full mt-2 w-64 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl z-50 transition-all duration-200 ease-in-out ${
        isOpen 
          ? 'opacity-100 translate-y-0 pointer-events-auto' 
          : 'opacity-0 -translate-y-2 pointer-events-none'
      }`}>
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{walletName}</p>
                <p className="text-xs text-gray-400 break-all">{publicKey}</p>
                <div className="flex items-center gap-1 mt-1">
                  <div className={`w-2 h-2 rounded-full ${isTestnet ? 'bg-yellow-500' : 'bg-green-500'}`} />
                  <span className="text-xs text-gray-400">{isTestnet ? 'Testnet' : 'Mainnet'}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-4">
            <Button
              variant="ghost"
              onClick={handleDisconnectClick}
              className="w-full justify-start gap-3 text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <LogOut className="w-4 h-4" />
              Disconnect Wallet
            </Button>
          </div>
        </div>
    </div>
  );
}
