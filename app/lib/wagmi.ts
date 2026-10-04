"use client";

import { http, createConfig, fallback } from "wagmi";
import { base, mainnet } from "viem/chains";
import { walletConnect, injected, coinbaseWallet } from "wagmi/connectors";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "PLACEHOLDER_PROJECT_ID";

// Multiple public Base mainnet RPC endpoints with fallback.
// mainnet.base.org is rate-limited; these alternatives have higher limits.
export const wagmiConfig = createConfig({
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
    walletConnect({
      projectId,
      metadata: {
        name: "FarFISH",
        description: "Daily habit-building app on Base",
        url: "https://farfish.app",
        icons: ["https://farfish.app/icon.png"],
      },
      showQrModal: false,
    }),
    injected({ shimDisconnect: true }),
    coinbaseWallet({
      appName: "FarFISH",
      appLogoUrl: "https://farfish.app/icon.png",
    }),
  ],
  ssr: true,
});


