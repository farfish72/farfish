"use client";

import { http, createConfig, fallback } from "wagmi";
import { base, mainnet } from "viem/chains";
import { walletConnect, injected, coinbaseWallet } from "wagmi/connectors";
import { isMobile } from "../utils/device";

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "6829b9ad661ef487af4d0c1bb5aa4a9e";

// Multiple public Base mainnet RPC endpoints with fallback.
// mainnet.base.org is rate-limited; these alternatives have higher limits.
let _wagmiConfig: ReturnType<typeof createConfig>;

try {
  _wagmiConfig = createConfig({
    chains: [base, mainnet],
    transports: {
      [base.id]: fallback([
        http("https://mainnet.base.org"),             // Base official — works everywhere
        http("https://base-rpc.publicnode.com"),      // PublicNode fallback
        http("https://base.api.onfinality.io/public"), // OnFinality fallback
        http("https://base.llamarpc.com"),            // LlamaRPC — may block localhost CORS
      ]),
      [mainnet.id]: fallback([
        http("https://eth.llamarpc.com"),
        http("https://rpc.ankr.com/eth"),
        http("https://ethereum.publicnode.com"),
      ]),
    },
    connectors: [
      injected({ shimDisconnect: true }),
      walletConnect({
        projectId,
        metadata: {
          name: "FarFISH",
          description: "Daily habit-building app on Base",
          url: "https://app.farfish.xyz",
          icons: ["https://app.farfish.xyz/farfish-logo.png"],
        },
        showQrModal: true,
      }),
      coinbaseWallet({
        appName: "FarFISH",
        appLogoUrl: "https://app.farfish.xyz/farfish-logo.png",
      }),
    ],
    ssr: true,
  });
  
  // Report success to Android (only runs in browser)
  if (typeof window !== 'undefined') {
    // Defer to next tick so Android bridge is ready
    setTimeout(() => {
      try {
        if ((window as any).Android?.checkWalletConnectStatus) {
          (window as any).Android.checkWalletConnectStatus('success', '');
        }
      } catch (_) {}
    }, 1000);
  }
} catch (error: any) {
  console.error('WalletConnect/wagmi initialization failed:', error);
  
  if (typeof window !== 'undefined') {
    setTimeout(() => {
      try {
        if ((window as any).Android?.checkWalletConnectStatus) {
          (window as any).Android.checkWalletConnectStatus('failed', error?.message || 'Unknown error');
        }
      } catch (_) {}
    }, 1000);
  }
  
  // Re-create a minimal config so the app doesn't crash entirely
  _wagmiConfig = createConfig({
    chains: [base, mainnet],
    transports: {
      [base.id]: http('https://mainnet.base.org'),
      [mainnet.id]: http('https://eth.llamarpc.com'),
    },
    connectors: [injected({ shimDisconnect: true })],
    ssr: true,
  });
}

export const wagmiConfig = _wagmiConfig;


