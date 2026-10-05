"use client";

import { http, createConfig, fallback } from "wagmi";
import { base, mainnet } from "viem/chains";
import { walletConnect, injected, coinbaseWallet } from "wagmi/connectors";
import { isMobile } from "../utils/device";

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "6829b9ad661ef487af4d0c1bb5aa4a9e";

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
    injected({ shimDisconnect: true }),
    walletConnect({
      projectId,
      metadata: {
        name: "FarFISH",
        description: "Daily habit-building app on Base",
        url: "https://farfish.vercel.app",
        icons: ["https://farfish.vercel.app/farfish-logo.png"],
      },
      showQrModal: true,
    }),
    coinbaseWallet({
      appName: "FarFISH",
      appLogoUrl: "https://farfish.vercel.app/farfish-logo.png",
    }),
  ],
  ssr: true,
});


