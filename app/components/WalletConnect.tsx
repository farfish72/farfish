"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";

export default function WalletConnect() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  const handleConnect = () => {
    // Use WalletConnect connector (first in list)
    const walletConnectConnector = connectors.find(c => c.id === "walletConnect");
    if (walletConnectConnector) {
      connect({ connector: walletConnectConnector });
    } else if (connectors[0]) {
      // Fallback to first available connector
      connect({ connector: connectors[0] });
    }
  };

  return (
    <div className="w-full">
      <div className="app-panel mb-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Wallet</p>
            {isConnected && address && (
              <p className="text-xs text-white/60 mt-1">Connected</p>
            )}
            {!isConnected && (
              <p className="text-xs text-white/60 mt-1">Disconnected</p>
            )}
          </div>
          <button
            type="button"
            onClick={isConnected ? () => disconnect() : handleConnect}
            disabled={isPending}
            className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed ${
              isPending
                ? "bg-white/10 text-white/60"
                : isConnected
                ? "bg-red-500/20 text-red-300 hover:bg-red-500/30"
                : "bg-gradient-to-r from-teal to-mint text-ink hover:opacity-90"
            }`}
          >
            {isPending ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Connecting...
              </>
            ) : isConnected && address ? (
              "Disconnect"
            ) : (
              "Connect Wallet"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
