// app/profile/page.tsx
"use client";

import Image from "next/image";
import { useMemo, useState, useEffect, useCallback, Suspense } from "react";
import { useAccount, useChainId } from "wagmi";
import { base } from "viem/chains";
import { getPublicClient } from "@wagmi/core";
import { wagmiConfig } from "../lib/wagmi";
import { UserCircle } from "@phosphor-icons/react";
import WalletConnect from "../components/WalletConnect";
import Header from "../components/Header";
import { NFT_CONTRACT_ADDRESS } from "../constants";
import nftDropAbi from "../abi/nftDrop.json";
import useUserStakes from "../hooks/useUserStakes";
import { AppIcon } from "../components/ui";

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
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [toast, setToast] = useState<ToastState>(null);
  const { stakes } = useUserStakes();

  // Wallet-dependent stats (only loaded when wallet connected)
  const [liveStats, setLiveStats] = useState<LiveStats>({ nftsOwned: 0, chestStreak: 0, rank: null });
  const [loadingStats, setLoadingStats] = useState(false);

  const isBaseNetwork = chainId === base.id;

  // Basic profile data (always available from localStorage)
  const getUsername = () => {
    const localUsername = typeof window !== "undefined" ? localStorage.getItem('username') : null;
    if (localUsername && localUsername.trim()) {
      return localUsername.trim();
    }
    return "Guest";
  };

  const getAvatarUrl = () => {
    const localImage = typeof window !== "undefined" ? localStorage.getItem('profileImage') : null;
    if (localImage && localImage.trim()) {
      return localImage;
    }
    return "/farfish-logo.png";
  };

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
          rank = Number(rankData?.rank ?? 0) > 0 ? Number(rankData.rank) : null;
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
        value: loadingStats ? "…" : statsError.rank ? "Error" : (liveStats.rank && liveStats.rank > 0 ? `#${liveStats.rank}` : "Unranked"),
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
        {/* USER PROFILE SECTION */}
        <section className="app-panel">
          <div className="flex items-start gap-4">
            <div className="relative h-16 w-16 rounded-xl overflow-hidden border-2 border-white/30">
              <Image
                src={getAvatarUrl()}
                alt="Profile"
                width={64}
                height={64}
                className="object-cover w-full h-full"
                unoptimized
              />
            </div>
            
            <div className="flex-1">
              <div className="text-lg font-bold text-white mb-1">
                {getUsername()}
              </div>
              <div className="text-sm text-white/60">
                FarFISH Member
              </div>
            </div>
          </div>
        </section>

        {/* WALLET SECTION - CONDITIONAL */}
        <section className="app-panel">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            <h3 className="text-lg font-semibold text-white">Wallet</h3>
          </div>
          
          {isConnected && address ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-sm text-green-300">Connected to Base</span>
              </div>
              
              {/* Wallet Stats Grid */}
              <div className="grid grid-cols-2 gap-2">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className={`rounded-xl border border-white/10 bg-white/5 p-3 text-center ${
                      loadingStats ? "animate-pulse" : ""
                    }`}
                  >
                    <p className="text-[11px] uppercase tracking-wide text-white/60">
                      {stat.label}
                    </p>
                    <p className="text-lg font-semibold mt-1">{stat.value}</p>
                  </div>
                ))}
              </div>
              
              {Object.values(statsError).some(Boolean) && !loadingStats && (
                <p className="text-xs text-red-300 text-center">
                  Some stats failed to load. Try again later.
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-white/70 mb-4">Link your wallet to view stats and claim rewards.</p>
              <WalletConnect />
            </div>
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
