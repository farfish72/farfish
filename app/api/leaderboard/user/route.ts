import { NextRequest, NextResponse } from "next/server";
import { ensureReferralEnv } from "../../../config/referral";
import { getKey, keys } from "../../../../lib/upstash";

type LeaderboardRow = {
  rank: number;
  wallet: string;
  referrals_count: number;
  rewards: number; // Referrals x 20 FRH
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

export async function GET(req: NextRequest) {
  try {
    ensureReferralEnv();
  } catch (error: any) {
    // Missing env/KV - safe empty stats (no fake rank)
    return NextResponse.json({
      rank: 0,
      wallet: "",
      referrals_count: 0,
      rewards: 0,
    } as LeaderboardRow);
  }

  const wallet = req.nextUrl.searchParams.get("wallet")?.trim().toLowerCase();
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: "Missing or invalid wallet" }, { status: 400 });
  }

  try {
    // Get user's referral count
    const countRaw = await getKey<number | string | null>(`refcount:${normalizeWallet(wallet)}`);
    const referrals_count = Number(countRaw ?? 0);

    // Calculate rewards: referrals x 20 FRH
    const rewards = referrals_count * 20;

    // Get ALL users and calculate rank within the full ranked list
    const allUsers = await getAllUsers();
    
    // If user is not in the system yet, they still get a rank
    const normalizedWallet = normalizeWallet(wallet);
    if (!allUsers.includes(normalizedWallet)) {
      allUsers.push(normalizedWallet);
    }

    // Get referral counts for all users
    const allUserCounts = await Promise.all(
      allUsers.map(async (userWallet) => {
        const userCountRaw = await getKey<number | string | null>(`refcount:${userWallet}`);
        return {
          wallet: userWallet,
          referrals_count: Number(userCountRaw ?? 0),
        };
      }),
    );

    // Sort by referral count (descending), then by wallet address (ascending) for deterministic tie-breaking
    const sorted = allUserCounts.sort((a, b) => {
      if (b.referrals_count !== a.referrals_count) {
        return b.referrals_count - a.referrals_count;
      }
      return a.wallet.localeCompare(b.wallet);
    });

    // Find user's rank in the sorted list
    const userIndex = sorted.findIndex(u => u.wallet === normalizedWallet);
    const rank = userIndex >= 0 ? userIndex + 1 : 0;

    return NextResponse.json({
      rank,
      wallet: normalizedWallet,
      referrals_count,
      rewards,
    } as LeaderboardRow);
  } catch (error: any) {
    console.error("User leaderboard lookup failed:", error);
    // On error, return safe empty stats with no fake rank
    return NextResponse.json({
      rank: 0,
      wallet: normalizeWallet(wallet),
      referrals_count: 0,
      rewards: 0,
    } as LeaderboardRow);
  }
}
