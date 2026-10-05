// app/profile/page.tsx
"use client";

import { useMemo, useState, useEffect, useCallback, Suspense } from "react";
import { useAccount, useChainId, useConnect } from "wagmi";
import { base } from "viem/chains";
import { getPublicClient } from "@wagmi/core";
import { wagmiConfig } from "../lib/wagmi";
import { 
  User,
  Wallet, 
  Fire, 
  Crown, 
  Ranking,
  Lock,
} from "@phosphor-icons/react";
import Header from "../components/Header";
import { NFT_CONTRACT_ADDRESS } from "../constants";
import nftDropAbi from "../abi/nftDrop.json";
import useUserStakes from "../hooks/useUserStakes";
import { AppIcon } from "../components/ui";
import { useToast } from "../providers/ToastProvider";

type ToastState = { type: "error" | "success"; message: string } | null;

type LiveStats = {
  nftsOwned: number;
  chestStreak: number;
  rank: number | null;
};

const faqItems = [
  {
    question: "1. What is FarFISH?",
    answer: "FarFISH is a daily habit-building app on Base that rewards consistent on-chain activity. Connect your wallet, complete tasks, and accumulate tokens before launch.",
  },
  {
    question: "2. How do I earn tokens?",
    answer: "Claim daily rewards in Chest, complete social tasks in Steam, lock NFTs for bonus yield, and refer friends to earn per referral.",
  },
  {
    question: "3. What are the main features?",
    answer: "Chest (daily check-in), Steam (task missions), Stake (NFT locking), Hall of Fame (rankings), and Profile (your stats and identity).",
  },
  {
    question: "4. How does NFT locking work?",
    answer: "Own a FarFISH NFT, then lock it for 30–360 days to earn yield. Rarer NFTs unlock higher multipliers. Release anytime after the lock period ends.",
  },
  {
    question: "5. What determines my rank?",
    answer: "Your rank is based on total referrals and token balance. More activity = higher standing in the Hall of Fame.",
  },
  {
    question: "6. Is my data safe?",
    answer: "Yes. FarFISH is non-custodial and built on Base. You control your wallet and assets at all times — we never hold your funds.",
  },
  {
    question: "7. How do referrals work?",
    answer: "Share your referral link to earn 20 tokens per new user. Hit milestones (5, 10, 30, 50 referrals) for bonus rewards on top.",
  },
  {
    question: "8. When can I trade FRH?",
    answer: "FRH token listing is planned for Q1 2027. Until then, focus on building your daily habits and accumulating tokens.",
  },
];

const formatStatValue = (value: number | string | undefined, suffix = "") => {
  if (value === undefined || value === null) return `0${suffix}`;
  return `${value}${suffix}`;
};

const TOKEN_IDS = Array.from({ length: 16 }, (_, i) => i); // 0-15

function ProfilePageContent() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connectAsync, connectors, isPending: isConnectPending } = useConnect();
  const { showError, showSuccess } = useToast();
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [toast, setToast] = useState<ToastState>(null);
  const { stakes } = useUserStakes();
  const [isConnectingManual, setIsConnectingManual] = useState(false);

  const isConnecting = isConnectingManual || isConnectPending;

  // Wallet-dependent stats (only loaded when wallet connected)
  const [liveStats, setLiveStats] = useState<LiveStats>({ nftsOwned: 0, chestStreak: 0, rank: null });
  const [loadingStats, setLoadingStats] = useState(false);

  const isBaseNetwork = chainId === base.id;

  // Get User ID from wallet address (Rank page pattern)
  const getUserId = () => {
    if (!address) return "Guest";
    return address.slice(-8).toLowerCase();
  };

  // Get Tier based on active stakes (Trust Anchor pattern)
  const getTier = () => {
    return stakes.length > 0 ? "Premium" : "Basic";
  };

  // Handle wallet connection (same as home page)
  const handleConnectWallet = useCallback(async () => {
    setIsConnectingManual(true);
    const timeout = setTimeout(() => {
      setIsConnectingManual(false);
    }, 45000);

    try {
      const hasInjected = typeof window !== "undefined" && Boolean((window as any).ethereum);
      const injectedConn = connectors.find((c) => c.id === "injected");
      const walletConnectConn = connectors.find((c) => c.id === "walletConnect");

      const connectorToUse = hasInjected && injectedConn
        ? injectedConn
        : walletConnectConn || connectors[0];

      if (!connectorToUse) {
        showError("No wallet connector found. Please install a Web3 wallet.");
        return;
      }

      await connectAsync({ connector: connectorToUse });
      showSuccess("Wallet connected successfully!");
    } catch (err: any) {
      console.warn("Wallet connect error:", err);
      const msg = err?.message || String(err);
      if (
        msg.includes("rejected") ||
        msg.includes("User rejected") ||
        err?.name === "UserRejectedRequestError"
      ) {
        showError("Connection rejected by user");
      } else if (
        msg.includes("closed") ||
        msg.includes("cancelled") ||
        msg.includes("Connection request reset")
      ) {
        showError("Connection cancelled");
      } else {
        showError(err?.shortMessage || err?.message || "Failed to connect wallet");
      }
    } finally {
      clearTimeout(timeout);
      setIsConnectingManual(false);
    }
  }, [connectAsync, connectors, showError, showSuccess]);

  // Wallet-dependent stats (only when wallet connected)
  type StatsErrorState = { nftsOwned: boolean; chestStreak: boolean; rank: boolean };
  const [statsError, setStatsError] = useState<StatsErrorState>({
    nftsOwned: false,
    chestStreak: false,
    rank: false,
  });
  const [statsRefreshToken, setStatsRefreshToken] = useState(0);

  const fetchLiveStats = useCallback(async () => {
    if (!address) {
      setLiveStats({ nftsOwned: 0, chestStreak: 0, rank: null });
      setStatsError({ nftsOwned: false, chestStreak: false, rank: false });
      return;
    }

    setLoadingStats(true);
    setStatsError({ nftsOwned: false, chestStreak: false, rank: false });
    try {
      // Fetch NFT owned count
      let nftsOwned = 0;
      if (NFT_CONTRACT_ADDRESS) {
        try {
          const publicClient = getPublicClient(wagmiConfig, { chainId: base.id });
          if (publicClient) {
            const balancePromises = TOKEN_IDS.map((id) =>
              (publicClient.readContract as any)({
                address: NFT_CONTRACT_ADDRESS as `0x${string}`,
                abi: nftDropAbi as any,
                functionName: "balanceOf",
                args: [address as `0x${string}`, BigInt(id)],
              }) as Promise<bigint>
            );
            const balances = await Promise.all(balancePromises);
            nftsOwned = balances.reduce((sum, balance) => sum + Number(balance), 0);
          }
        } catch (error) {
          console.error("Failed to fetch NFT owned count:", error);
          setStatsError((prev) => ({ ...prev, nftsOwned: true }));
        }
      }

      // Fetch chest streak from KV (via API)
      let chestStreak = 0;
      try {
        const streakRes = await fetch(`/api/profile/streak?wallet=${address}`, {
          headers: { "x-user-wallet": address },
          cache: "no-store",
        });
        if (streakRes.ok) {
          const streakData = await streakRes.json();
          chestStreak = Number(streakData?.streakDays ?? 0);
        }
      } catch (error) {
        console.error("Failed to fetch chest streak:", error);
        setStatsError((prev) => ({ ...prev, chestStreak: true }));
      }

      // Fetch rank from leaderboard API
      let rank: number | null = null;
      try {
        const rankRes = await fetch(`/api/leaderboard/user?wallet=${address}`, {
          cache: "no-store",
        });
        if (rankRes.ok) {
          const rankData = await rankRes.json();
          // API returns rank = 0 when user not found, otherwise actual rank number
          rank = Number(rankData?.rank ?? 0);
        }
      } catch (error) {
        console.error("Failed to fetch rank:", error);
        setStatsError((prev) => ({ ...prev, rank: true }));
      }

      setLiveStats({ nftsOwned, chestStreak, rank });
    } catch (error) {
      console.error("Failed to fetch stats:", error);
      setStatsError((prev) => ({
        nftsOwned: prev.nftsOwned || true,
        chestStreak: prev.chestStreak || true,
        rank: prev.rank || true,
      }));
    } finally {
      setLoadingStats(false);
    }
  }, [address, statsRefreshToken]);

  // Only fetch stats when wallet is connected
  useEffect(() => {
    if (address) {
      fetchLiveStats();
    }
  }, [fetchLiveStats, address]);

  // Listen for global staking updates so Profile stays in sync with on-chain state
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      setStatsRefreshToken((prev) => prev + 1);
    };
    window.addEventListener("farfish:staking-updated", handler);
    return () => {
      window.removeEventListener("farfish:staking-updated", handler);
    };
  }, []);

  // Wallet stats (only when connected)
  const stats = useMemo(
    () => [
      {
        label: "NFTs Held",
        value: loadingStats ? "…" : statsError.nftsOwned ? "Error" : formatStatValue(liveStats.nftsOwned),
      },
      {
        label: "NFTs Staked",
        value: loadingStats ? "…" : formatStatValue(stakes.length),
      },
      {
        label: "Streak",
        value: loadingStats ? "…" : statsError.chestStreak ? "Error" : formatStatValue(liveStats.chestStreak, " days"),
      },
      {
        label: "Rank",
        value: loadingStats ? "…" : statsError.rank ? "Error" : (liveStats.rank && liveStats.rank > 0 ? `#${liveStats.rank}` : "No rank"),
      },
    ],
    [liveStats, loadingStats, statsError, stakes.length]
  );

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <Header title="Profile" />

      <div className="mt-4 space-y-4 flex-1 flex flex-col">
        {/* USER PROFILE SECTION - ONLY WHEN CONNECTED */}
        {isConnected && address && (
          <section className="app-panel">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-xl bg-white/15 border-2 border-white/30 flex items-center justify-center shadow-lg">
                <User size={40} weight="bold" className="text-white" />
              </div>
              
              <div className="flex-1">
                <div className="text-lg font-bold text-white mb-1">
                  User ID: {getUserId()}
                </div>
                <div className="text-sm text-white/60">
                  Tier: {getTier()}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* WALLET SECTION - CONDITIONAL */}
        <section className="app-panel">
          {isConnected && address ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-white/15 border border-white/30 flex items-center justify-center">
                  <AppIcon icon={Wallet} size="md" weight="bold" className="text-white" />
                </div>
                <span className="text-sm font-medium text-white">Connected to Base</span>
              </div>
              
              {/* Wallet Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                {stats.map((stat, idx) => {
                  const icons = [Crown, Lock, Fire, Ranking];
                  const StatIcon = icons[idx];
                  
                  return (
                    <div
                      key={stat.label}
                      className={`rounded-xl border border-white/10 bg-white/5 p-3 hover:scale-105 transition-all duration-300 ${
                        loadingStats ? "animate-pulse" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-white/15 border border-white/30 flex items-center justify-center shadow-sm flex-shrink-0">
                          <AppIcon icon={StatIcon} size="sm" weight="bold" className="text-white" />
                        </div>
                        <p className="text-[11px] uppercase tracking-wide text-white/60 font-medium">
                          {stat.label}
                        </p>
                      </div>
                      <p className="text-lg font-bold text-white">{stat.value}</p>
                    </div>
                  );
                })}
              </div>
              
              {Object.values(statsError).some(Boolean) && !loadingStats && (
                <p className="text-xs text-red-300 text-center">
                  Some stats failed to load. Try again later.
                </p>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConnectWallet}
              disabled={isConnecting}
              className="w-full py-4 text-lg font-semibold rounded-xl bg-gradient-to-r from-teal to-mint text-ink transition hover:opacity-95 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isConnecting ? (
                <>
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect Wallet"
              )}
            </button>
          )}
        </section>

        {/* FAQ SECTION - ALWAYS VISIBLE */}
        <section className="app-panel">
          <h3 className="text-lg font-semibold mb-3">Frequently Asked Questions</h3>
          <div className="space-y-2">
            {faqItems.map((faq, idx) => {
              const open = openIdx === idx;
              return (
                <div
                  key={faq.question}
                  className="rounded-xl border border-white/10 bg-white/5"
                >
                  <button
                    aria-label={`Toggle ${faq.question}`}
                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                    onClick={() => setOpenIdx(open ? null : idx)}
                  >
                    <span className="font-medium text-sm">{faq.question}</span>
                  </button>
                  {open && (
                    <div className="px-4 pb-4 text-sm text-white/70">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md">
          <div
            className={`rounded-lg border px-4 py-3 text-sm shadow-lg ${
              toast.type === "success"
                ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                : "border-red-400/40 bg-red-500/15 text-red-100"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <div className="w-40 h-10 rounded-xl bg-white/10 animate-pulse" />
        </div>
      }
    >
      <ProfilePageContent />
    </Suspense>
  );
}
