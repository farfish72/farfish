import { NextResponse } from "next/server";
import { ensureReferralEnv } from "../../config/referral";
import { getKey, smembers, keys } from "../../../lib/upstash";

type LeaderboardRow = {
  wallet: string;
  referrals_count: number;
  rewards: number; // Referrals x 20 FRH
  rank: number;
};

export const dynamic = "force-dynamic";

const normalizeWallet = (wallet: string) => wallet.toLowerCase();

/**
 * Get all unique users from KV store by merging:
 * 1. Keys matching referral:* (referred users)
 * 2. Values of referral:* map to referrer wallets
 * 3. Keys matching refcode:* (owners of referral codes)
 */
const getAllUsers = async (): Promise<string[]> => {
  const allUsers = new Set<string>();

  try {
    // 1. Get all referred users from referral:* keys
    const referralKeys = await keys("referral:*");
    for (const key of referralKeys) {
      const wallet = key.replace("referral:", "");
      if (wallet && /^0x[a-fA-F0-9]{40}$/i.test(wallet)) {
        allUsers.add(normalizeWallet(wallet));
      }
    }

    // 2. Get all referrer wallets from referral:* values
    for (const key of referralKeys) {
      try {
        const referralData = await getKey<string | Record<string, unknown> | null>(key);
        if (referralData) {
          let referrer = "";
          if (typeof referralData === "string") {
            try {
              const parsed = JSON.parse(referralData);
              referrer = parsed?.referrer || "";
            } catch {
              referrer = referralData;
            }
          } else if (typeof referralData === "object" && referralData.referrer) {
            referrer = String(referralData.referrer);
          }
          
          if (referrer && /^0x[a-fA-F0-9]{40}$/i.test(referrer)) {
            allUsers.add(normalizeWallet(referrer));
          }
        }
      } catch {
        // Skip invalid entries
      }
    }

    // 3. Get all refcode owners from refcode:* values
    const refcodeKeys = await keys("refcode:*");
    for (const key of refcodeKeys) {
      try {
        const wallet = await getKey<string | null>(key);
        if (wallet && /^0x[a-fA-F0-9]{40}$/i.test(wallet)) {
          allUsers.add(normalizeWallet(wallet));
        }
      } catch {
        // Skip invalid entries
      }
    }
  } catch (error) {
    console.error("Error gathering all users:", error);
  }

  return Array.from(allUsers);
};

export async function GET() {
  try {
    ensureReferralEnv();
  } catch (error: any) {
    // Missing env/KV - return safe empty list
    return NextResponse.json([]);
  }

  try {
    // Get ALL unique users (not just referrers)
    const allUsers = await getAllUsers();
    
    if (!allUsers.length) {
      return NextResponse.json([]);
    }

    // Get referral counts for all users
    const withCounts = await Promise.all(
      allUsers.map(async (wallet) => {
        const countRaw = await getKey<number | string | null>(`refcount:${wallet}`);
        const count = Number(countRaw ?? 0);

        return {
          wallet,
          referrals_count: Number.isFinite(count) && count >= 0 ? count : 0,
        };
      }),
    );

    // Calculate rewards: referrals x 20 FRH
    const withRewards: LeaderboardRow[] = withCounts.map((row) => ({
      ...row,
      rewards: row.referrals_count * 20,
      rank: 0, // Will be set below
    }));

    // Sort by referral count (descending), then by wallet address (ascending) for deterministic tie-breaking
    const sorted = withRewards.sort((a, b) => {
      if (b.referrals_count !== a.referrals_count) {
        return b.referrals_count - a.referrals_count;
      }
      return a.wallet.localeCompare(b.wallet);
    });

    // Assign rank numbers sequentially starting from 1
    const withRanks = sorted.map((row, idx) => ({
      ...row,
      rank: idx + 1,
    }));

    return NextResponse.json(withRanks);
  } catch (error: any) {
    console.error("Leaderboard generation failed:", error);
    return NextResponse.json([]);
  }
}

