"use client";

import { useAccount } from "wagmi";
import { useEffect, useMemo, useState } from "react";

type FarcasterProfile = {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  bio?: string;
  followerCount?: number;
  followingCount?: number;
};

type Rarity = "common" | "rare" | "epic" | "legendary";

type RarityBreakdown = Record<Rarity, number>;

type UserStats = {
  nftsOwned?: number;
  staked?: number;
  streakDays?: number;
  rankLabel?: string;
  rarityBreakdown?: RarityBreakdown;
};

type FarcasterUser = {
  displayName: string;
  fid: number;
  pfpUrl: string;
  walletAddress: string;
  stats?: UserStats;
  farcasterProfile?: FarcasterProfile | null;
};

const rarityOrder: Rarity[] = ["common", "rare", "epic", "legendary"];

const defaultBreakdown = (): RarityBreakdown => ({
  common: 0,
  rare: 0,
  epic: 0,
  legendary: 0,
});

export default function useUser() {
  const { address } = useAccount();
  const [loadingNFTs, setLoadingNFTs] = useState(false);
  const [loadingFarcaster, setLoadingFarcaster] = useState(false);
  const [rarityBreakdown, setRarityBreakdown] = useState<RarityBreakdown>(defaultBreakdown());
  const [farcasterProfile, setFarcasterProfile] = useState<FarcasterProfile | null>(null);
  const [stakedCount, setStakedCount] = useState(0);

  // Fetch Farcaster display data (PFP + username only) via server-side API
  useEffect(() => {
    let cancelled = false;
    
    const fetchFarcasterDisplayData = async () => {
      if (!address) {
        if (!cancelled) {
          setFarcasterProfile(null);
        }
        return;
      }

      setLoadingFarcaster(true);
      try {
        // Call server-side API that has access to NEYNAR_API_KEY
        const response = await fetch(`/api/farcaster/profile?wallet=${address}`, {
          cache: "no-store",
        });
        
        if (response.ok) {
          const data = await response.json();
          if (!cancelled) {
            setFarcasterProfile(data.profile);
          }
        } else {
          if (!cancelled) {
            setFarcasterProfile(null);
          }
        }
      } catch (error) {
        console.error("Failed to fetch Farcaster display data:", error);
        if (!cancelled) {
          setFarcasterProfile(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingFarcaster(false);
        }
      }
    };

    fetchFarcasterDisplayData();
    
    return () => {
      cancelled = true;
    };
  }, [address]);

  useEffect(() => {
    const fetchNFTs = async () => {
      if (!address) {
        setRarityBreakdown(defaultBreakdown());
        return;
      }

      setLoadingNFTs(true);
      try {
        // NFT fetching logic would go here
        setRarityBreakdown(defaultBreakdown());
      } catch (error) {
        console.error("Failed to fetch owned NFTs", error);
        setRarityBreakdown(defaultBreakdown());
      } finally {
        setLoadingNFTs(false);
      }
    };

    fetchNFTs();
  }, [address]);

  const nftsOwned = useMemo(
    () => rarityOrder.reduce((total, rarity) => total + (rarityBreakdown[rarity] ?? 0), 0),
    [rarityBreakdown]
  );

  // Display name priority: localStorage override > Farcaster display name > Farcaster username > default
  const displayName = useMemo(() => {
    const localUsername = typeof window !== "undefined" ? localStorage.getItem('username') : null;
    
    // If user has set a custom username, use it
    if (localUsername && localUsername.trim()) {
      return localUsername.trim();
    }
    
    // Otherwise use Farcaster data if available
    if (farcasterProfile?.displayName) {
      return farcasterProfile.displayName;
    }
    
    if (farcasterProfile?.username) {
      return farcasterProfile.username;
    }
    
    return "FarFISH Captain";
  }, [farcasterProfile]);

  // Profile picture priority: localStorage override > Farcaster PFP > default
  const pfpUrl = useMemo(() => {
    const localImage = typeof window !== "undefined" ? localStorage.getItem('profileImage') : null;
    
    // If user has set a custom image, use it
    if (localImage && localImage.trim()) {
      return localImage;
    }
    
    // Otherwise use Farcaster PFP if available
    if (farcasterProfile?.pfpUrl) {
      return farcasterProfile.pfpUrl;
    }
    
    return "/farfish-logo.png";
  }, [farcasterProfile]);

  const fid = farcasterProfile?.fid ?? 0;

  const stats: UserStats = {
    nftsOwned,
    staked: stakedCount,
    streakDays: 0, // This comes from KV via API calls
    rankLabel:
      nftsOwned >= 5 ? "Gold" : nftsOwned >= 3 ? "Silver" : nftsOwned > 0 ? "Bronze" : "Unranked",
    rarityBreakdown,
  };

  const connectedUser: FarcasterUser | null = address
    ? {
        displayName,
        fid,
        pfpUrl,
        walletAddress: address, // Primary identifier for all tracking
        stats,
        farcasterProfile,
      }
    : null;

  return {
    user: connectedUser,
    loadingNFTs,
    loadingFarcaster,
    hasFarcasterProfile: !!farcasterProfile,
  };
}

export type { FarcasterUser, RarityBreakdown };

