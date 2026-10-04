"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

export default function WalletConnect() {
  const { address, isConnected } = useAccount();
  const { connectAsync, connectors, isPending: wagmiPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [connecting, setConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isPending = connecting || wagmiPending;

  const handleConnect = async () => {
    setErrorMsg(null);
    setConnecting(true);

    const timer = setTimeout(() => {
      setConnecting(false);
    }, 45000);

    try {
      // Check if injected provider exists (e.g. mobile Web3 browser or extension)
      const hasInjected = typeof window !== "undefined" && Boolean((window as any).ethereum);
      const injectedConn = connectors.find((c) => c.id === "injected");
      const walletConnectConn = connectors.find((c) => c.id === "walletConnect");

      // In a Web3 browser, prefer injected for instant connection; otherwise use WalletConnect modal
      const connectorToUse = hasInjected && injectedConn
        ? injectedConn
        : walletConnectConn || connectors[0];

      if (!connectorToUse) {
        throw new Error("No wallet connector available");
      }

      await connectAsync({ connector: connectorToUse });
    } catch (err: any) {
      console.warn("Wallet connection error/cancelled:", err);
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

  return (
    <div className="w-full">
      <div className="app-panel mb-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Wallet</p>
            {isConnected && address ? (
              <p className="text-xs text-white/60 mt-1">
                {`${address.slice(0, 6)}...${address.slice(-4)}`}
              </p>
            ) : (
              <p className="text-xs text-white/60 mt-1">
                {errorMsg ? (
                  <span className="text-red-400">{errorMsg}</span>
                ) : (
                  "Disconnected"
                )}
              </p>
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
