"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useChainId,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { base } from "viem/chains";
import { formatEther } from "viem";
import { Fire } from "@phosphor-icons/react";

import Header from "../components/Header";
import ChestCard from "../components/ChestCard";
import TrustAnchor from "../components/TrustAnchor";
import useUserStakes from "../hooks/useUserStakes";

import claimControllerAbi from "../abi/claimController.json";
import erc20Abi from "../abi/erc20.json";
import { CLAIM_CONTROLLER_ADDRESS, ERC20_TOKEN_ADDRESS } from "../constants";
import { AppIcon } from "../components/ui";

/* ---------------- helpers ---------------- */
const formatTime = (seconds: bigint | number): string => {
  const s = typeof seconds === "bigint" ? Number(seconds) : seconds;
  if (!s || s <= 0) return "0m";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

/* ---------------- ROTATING TEXTS ---------------- */
const ROTATING_CHEST_TEXTS = [
  "Daily Bronze Chest unlocked\n\nClaim 3 FRH every day on FarFISH.\nFree, simple, on Base.",
  "Another day, another Bronze Chest\n\nFarFISH rewards consistency.\nFree FRH daily on Base.",
  "Daily check-in complete.\n\nBronze Chest claimed on FarFISH.\nFree FRH for real users.",
  "Small daily rewards > big promises.\n\nBronze Chest unlocked on FarFISH\nFree FRH, every day.",
  "Consistency pays\n\nClaim your daily Bronze Chest on FarFISH.\nFree FRH on Base.",
  "Daily Bronze Chest claimed\n\nFarFISH keeps rewarding active users.\nFree FRH, no tricks.",
  "Free daily rewards, done right.\n\nBronze Chest unlocked on FarFISH\nBuilt on Base.",
  "Daily habit unlocked 🔁\n\nBronze Chest claimed on FarFISH.\n3 FRH every day.",
  "No hype. Just daily rewards.\n\nBronze Chest unlocked on FarFISH\nFree FRH on Base.",
  "Another Bronze Chest day\n\nFarFISH rewards show up daily.\nFree FRH, claim yours.",
];

const FARFISH_MINIAPP_URL = "https://farfish.vercel.app";

/* ---------------- page ---------------- */
export default function ChestPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const isBase = chainId === base.id;

  // Get user stakes to determine tier
  const { activeStakes } = useUserStakes();
  
  // Trust Anchor state
  const [trustAnchorData, setTrustAnchorData] = useState({
    streak: null as number | null,
    daysActive: null as number | null,
    referrals: null as number | null,
    rank: null as number | null,
  });

  // Fetch referral data from KV
  useEffect(() => {
    const fetchReferralData = async () => {
      if (!address) return;
      
      try {
        const response = await fetch(`/api/leaderboard/user?wallet=${address}`);
        if (response.ok) {
          const data = await response.json();
          setTrustAnchorData(prev => ({
            ...prev,
            referrals: data.referrals_count || 0,
            rank: Number(data?.rank ?? 0) > 0 ? Number(data.rank) : null,
          }));
        }
      } catch (error) {
        console.error('Failed to fetch referral data:', error);
      }
    };
    
    fetchReferralData();
  }, [address]);

  // Read ERC20 token balance
  const { data: tokenBalance } = useReadContract({
    address: ERC20_TOKEN_ADDRESS as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(isConnected && address && isBase) },
  });

  // Format token balance
  const formattedBalance = useMemo(() => {
    if (!tokenBalance || typeof tokenBalance !== 'bigint') return null;
    const balance = formatEther(tokenBalance);
    const numBalance = parseFloat(balance);
    
    if (numBalance === 0) return "0 FRH";
    if (numBalance < 0.001) return "<0.001 FRH";
    if (numBalance < 1) return `${numBalance.toFixed(3)} FRH`;
    if (numBalance < 1000) return `${numBalance.toFixed(2)} FRH`;
    if (numBalance < 1000000) return `${(numBalance / 1000).toFixed(2)}K FRH`;
    return `${(numBalance / 1000000).toFixed(2)}M FRH`;
  }, [tokenBalance]);

  /* ================= DAILY BRONZE ================= */
  const { data: dailyData } = useReadContract({
    address: CLAIM_CONTROLLER_ADDRESS,
    abi: claimControllerAbi,
    functionName: "canClaimDailyChest",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(isConnected && address && isBase) },
  });

  const daily = useMemo(() => {
    if (!dailyData || !Array.isArray(dailyData)) return null;
    return {
      canClaim: Boolean(dailyData[0]),
      timeLeft: BigInt(dailyData[1]),
    };
  }, [dailyData]);

  const {
    writeContract: claimDaily,
    data: dailyTx,
    isPending: dailyPending,
  } = useWriteContract();

  const { isLoading: dailyConfirming } = useWaitForTransactionReceipt({
    hash: dailyTx,
  });

  const handleShareProgress = async () => {
    // Social sharing disabled for standalone Android app
    console.log("Share feature not available in standalone app");
  };

  const handleBronzeClaim = useCallback(async () => {
    if (!daily?.canClaim || !address) return;

    try {
      // Mark bronze as claimed today in localStorage
      localStorage.setItem('ff_bronze_claimed_today', 'true');
      
      // Update total rewards
      const currentTotal = parseFloat(localStorage.getItem('ff_total_rewards') || '0');
      localStorage.setItem('ff_total_rewards', (currentTotal + 3).toString());
      
      // Update streak and last claim date
      const lastClaimDate = localStorage.getItem('ff_last_claim_date');
      const today = new Date().toISOString().split('T')[0];
      
      if (lastClaimDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        const currentStreak = parseInt(localStorage.getItem('ff_streak') || '0', 10);
        
        if (lastClaimDate === yesterdayStr) {
          // Consecutive day - increment streak
          localStorage.setItem('ff_streak', (currentStreak + 1).toString());
        } else if (lastClaimDate !== today) {
          // Not consecutive - reset streak to 1
          localStorage.setItem('ff_streak', '1');
        }
        
        localStorage.setItem('ff_last_claim_date', today);
      }

      await claimDaily({
        address: CLAIM_CONTROLLER_ADDRESS,
        abi: claimControllerAbi,
        functionName: "claimDailyChest",
        args: [],
        account: address,
        chain: base,
      });
    } catch (error) {
      console.error('Bronze claim error:', error);
      throw error; // Let ChestCard handle the error display
    }
  }, [daily, address, claimDaily]);

  /* ================= SILVER ================= */
  const { data: silverData } = useReadContract({
    address: CLAIM_CONTROLLER_ADDRESS,
    abi: claimControllerAbi,
    functionName: "canClaimSilverChest",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(isConnected && address && isBase) },
  });

  const silver = useMemo(() => {
    if (!silverData || !Array.isArray(silverData)) return null;
    return {
      canClaim: Boolean(silverData[0]),
      timeLeft: BigInt(silverData[1]),
      hasStaked: Boolean(silverData[2]),
    };
  }, [silverData]);

  const {
    writeContract: claimSilver,
    isPending: silverPending,
  } = useWriteContract();

  const { isLoading: silverConfirming } = useWaitForTransactionReceipt({
    hash: undefined,
  });

  const handleSilverClaim = useCallback(async () => {
    if (!silver?.canClaim || !address) return;

    try {
      // Mark silver as claimed today in localStorage
      localStorage.setItem('ff_silver_claimed_today', 'true');
      
      // Update total rewards
      const currentTotal = parseFloat(localStorage.getItem('ff_total_rewards') || '0');
      localStorage.setItem('ff_total_rewards', (currentTotal + 6).toString());
      
      // Update streak and last claim date (same logic as bronze)
      const lastClaimDate = localStorage.getItem('ff_last_claim_date');
      const today = new Date().toISOString().split('T')[0];
      
      if (lastClaimDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        const currentStreak = parseInt(localStorage.getItem('ff_streak') || '0', 10);
        
        if (lastClaimDate === yesterdayStr) {
          // Consecutive day - increment streak
          localStorage.setItem('ff_streak', (currentStreak + 1).toString());
        } else if (lastClaimDate !== today) {
          // Not consecutive - reset streak to 1
          localStorage.setItem('ff_streak', '1');
        }
        
        localStorage.setItem('ff_last_claim_date', today);
      }

      await claimSilver({
        address: CLAIM_CONTROLLER_ADDRESS,
        abi: claimControllerAbi,
        functionName: "claimSilverChest",
        args: [],
        account: address,
        chain: base,
      });
    } catch (error) {
      console.error('Silver claim error:', error);
      throw error; // Let ChestCard handle the error display
    }
  }, [silver, address, claimSilver]);

  // Update Trust Anchor data when address changes or claims are made
  useEffect(() => {
    if (!address) return;

    // Get streak from localStorage
    const streak = localStorage.getItem('ff_streak');
    
    // Calculate days active (cumulative, never resets)
    // For now, use a simple calculation based on streak and historical data
    // In a real implementation, this would be stored separately and never decrease
    const daysActive = localStorage.getItem('ff_days_active');
    let calculatedDaysActive = 0;
    
    if (daysActive) {
      calculatedDaysActive = parseInt(daysActive, 10);
    } else {
      // Initialize days active based on current streak if not set
      calculatedDaysActive = streak ? parseInt(streak, 10) : 0;
      localStorage.setItem('ff_days_active', calculatedDaysActive.toString());
    }
    
    // Update days active if current streak is higher (user has been more active)
    const currentStreak = streak ? parseInt(streak, 10) : 0;
    if (currentStreak > calculatedDaysActive) {
      calculatedDaysActive = currentStreak;
      localStorage.setItem('ff_days_active', calculatedDaysActive.toString());
    }

    // Update state
    setTrustAnchorData(prev => ({
      ...prev,
      streak: currentStreak,
      daysActive: calculatedDaysActive,
    }));
  }, [address, dailyData, silverData]);

  /* ================= UI ================= */
  return (
    <div className="flex flex-col flex-1">
      <Header title="Chest" />

      <div className="mt-4 space-y-4 flex-1">
        {/* Daily Streak Indicator */}
        {trustAnchorData.streak !== null && trustAnchorData.streak > 0 && (
          <div className="app-panel border-orange-400/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/30 flex items-center justify-center shadow-lg">
                  <AppIcon icon={Fire} size="md" weight="fill" className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-orange-400">Day {trustAnchorData.streak} streak</h3>
                  <p className="text-sm text-white/70">
                    {daily?.canClaim 
                      ? "Today's chest is ready" 
                      : `Next in ${formatTime(daily?.timeLeft ?? 0n)}`
                    }
                  </p>
                </div>
              </div>
              <button
                onClick={handleShareProgress}
                disabled={!isConnected}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 backdrop-blur-sm border border-white/20 text-sm font-medium text-white transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Share streak
              </button>
            </div>
          </div>
        )}

        <TrustAnchor
          streak={trustAnchorData.streak}
          daysActive={trustAnchorData.daysActive}
          referrals={trustAnchorData.referrals}
          totalHolding={formattedBalance}
          rank={trustAnchorData.rank}
          hasActiveStake={activeStakes.length > 0}
        />
        <ChestCard
          title="Daily Bronze Chest"
          description="Opens every 24 hours."
          variant="bronze"
          badge={daily?.canClaim ? "Ready" : "Cooling"}
          progress={daily?.canClaim ? 100 : 0}
          actionLabel={
            daily?.canClaim 
              ? "Claim 3 FRH" 
              : `Next claim in: ${formatTime(daily?.timeLeft ?? 0n)}`
          }
          actionDisabled={
            !isConnected ||
            !isBase ||
            !daily?.canClaim ||
            dailyPending ||
            dailyConfirming
          }
          onAction={handleBronzeClaim}
        />

        <ChestCard
          title="Silver Chest"
          description="Requires an active NFT stake."
          variant="silver"
          badge={
            !silver?.hasStaked
              ? "Stake required"
              : silver?.canClaim
              ? "Ready"
              : "Cooling"
          }
          actionLabel={
            silver?.canClaim
              ? "Claim 6 FRH"
              : `Next claim in: ${formatTime(silver?.timeLeft ?? 0n)}`
          }
          actionDisabled={
            !isConnected ||
            !isBase ||
            !silver?.hasStaked ||
            !silver?.canClaim ||
            silverPending ||
            silverConfirming
          }
          onAction={handleSilverClaim}
        />

        <ChestCard
          title="Gold Chest"
          description="Staking milestone rewards coming."
          variant="default"
          badge="Next Up"
          actionLabel="Next Up"
          actionDisabled={true}
          onAction={() => {}}
        />
      </div>
    </div>
  );
}
