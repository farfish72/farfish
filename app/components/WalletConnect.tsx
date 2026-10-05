"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { logWalletConnectionAttempt, logWalletConnectionError } from "../utils/walletDebug";
import { hasInjectedProvider, isMobile, isAndroidWebView } from "../utils/device";

export default function WalletConnect() {
  const { address, isConnected } = useAccount();
  const { connectAsync, connectors, isPending: wagmiPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [connecting, setConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showConnectorMenu, setShowConnectorMenu] = useState(false);

  const isPending = connecting || wagmiPending;

  const handleConnectorSelect = async (connectorId: string) => {
    const connector = connectors.find((c) => c.id === connectorId);
    if (!connector) return;

    setShowConnectorMenu(false);
    setErrorMsg(null);
    setConnecting(true);

    const timer = setTimeout(() => {
      setConnecting(false);
    }, 45000);

    try {
      // Log connection attempt for debugging
      const hasInjected = hasInjectedProvider();
      const isMobileDevice = isMobile();
      const isWebView = isAndroidWebView();

      logWalletConnectionAttempt({
        connectorId: connector.id,
        connectorType: connector.name,
        hasInjected,
        isMobile: isMobileDevice,
        isWebView,
        userAgent: typeof window !== "undefined" ? navigator.userAgent : "unknown",
      });

      await connectAsync({ connector });
    } catch (err: any) {
      logWalletConnectionError(err, `Connector: ${connector.name} (${connector.id})`);
      const msg = err?.message || String(err);
      if (
        msg.includes("rejected") ||
        msg.includes("User rejected") ||
        err?.name === "UserRejectedRequestError"
      ) {
        setErrorMsg("Connection rejected");
      } else if (
        msg.includes("closed") ||
        msg.includes("cancelled") ||
        msg.includes("Connection request reset")
      ) {
        setErrorMsg("Connection cancelled");
      } else {
        setErrorMsg("Connection failed");
      }
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      clearTimeout(timer);
      setConnecting(false);
    }
  };

  const handleConnect = () => {
    setShowConnectorMenu(true);
  };

  return (
    <div className="w-full">
      <div className="app-panel mb-2">
        <div className={`flex items-center ${isConnected && address ? 'justify-between' : 'justify-center'}`}>
          <div>
            {isConnected && address ? (
              <>
                <p className="text-sm font-semibold">Wallet</p>
                <p className="text-xs text-white/60 mt-1">
                  {`${address.slice(0, 6)}...${address.slice(-4)}`}
                </p>
              </>
            ) : null}
          </div>
          <button
            type="button"
            onClick={isConnected ? () => disconnect() : handleConnect}
            disabled={isPending}
            className={`w-full py-4 text-lg font-semibold rounded-xl flex items-center justify-center gap-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed ${
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

      {showConnectorMenu && (
        <div className="app-panel mt-2">
          <p className="text-sm font-semibold mb-2">Select Connection Method</p>
          <div className="flex flex-col gap-2">
            {connectors.map((connector) => {
              const hasInjected = hasInjectedProvider();
              const isMobileDevice = isMobile();
              
              let label = connector.name;
              let recommended = false;
              
              if (connector.id === "injected" && hasInjected) {
                label = "Browser Wallet";
                recommended = true;
              } else if (connector.id === "walletConnect") {
                label = "WalletConnect";
                if (!hasInjected || isMobileDevice) {
                  recommended = true;
                }
              } else if (connector.id === "coinbaseWallet") {
                label = "Coinbase Wallet";
              }
              
              return (
                <button
                  key={connector.id}
                  type="button"
                  onClick={() => handleConnectorSelect(connector.id)}
                  className={`px-3 py-2 rounded-md text-sm font-semibold text-left transition ${
                    recommended
                      ? "bg-gradient-to-r from-teal to-mint text-ink hover:opacity-90"
                      : "bg-white/10 text-white/80 hover:bg-white/20"
                  }`}
                >
                  {label}
                  {recommended && (
                    <span className="text-xs ml-2 opacity-75">(Recommended)</span>
                  )}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setShowConnectorMenu(false)}
              className="px-3 py-2 rounded-md text-sm font-semibold text-white/60 hover:text-white/80 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
