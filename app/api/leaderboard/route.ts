import { NextResponse } from "next/server";
import { ensureReferralEnv, getServerReferralEnv } from "../../config/referral";

type LeaderboardRow = {
  wallet: string;
  referrals_count: number;
  rewards: number; // Referrals x 20 FRH
  rank: number;
};

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    ensureReferralEnv();
  } catch (error: any) {
    console.error("❌ [LEADERBOARD] Env check failed:", error.message);
    return NextResponse.json([]);
  }

  try {
    // Use sorted set for leaderboard (shows TOTAL rewards earned)
    const result = await upstashRequest<(string | number)[] | null>('zrevrange/leaderboard/0/-1/WITHSCORES');
    
    if (!result || !Array.isArray(result) || result.length === 0) {
      console.log("ℹ️ [LEADERBOARD] No users in sorted set");
      return NextResponse.json([]);
    }

    // Parse sorted set result: [wallet1, totalRewards1, wallet2, totalRewards2, ...]
    // totalRewards = how many times they got 20 tokens (as referrer OR referee)
    const leaderboard: LeaderboardRow[] = [];
    for (let i = 0; i < result.length; i += 2) {
      const wallet = String(result[i]);
      const rewardCount = Number(result[i + 1]); // How many 20 FRH rewards earned
      
      // Get actual referral count from refcount key for display
      let referrals_count = 0;
      try {
        const refcountResult = await upstashRequest<number | null>(`get/refcount:${wallet}`);
        referrals_count = refcountResult || 0;
      } catch (error) {
        console.warn(`⚠️ [LEADERBOARD] Could not fetch refcount for ${wallet}`);
      }
      
      leaderboard.push({
        rank: Math.floor(i / 2) + 1,
        wallet,
        referrals_count, // Actual referrals (for display)
        rewards: rewardCount * 20, // Total FRH earned
      });
    }

    console.log(`✅ [LEADERBOARD] Returned ${leaderboard.length} users (sorted by total rewards)`);
    return NextResponse.json(leaderboard);
  } catch (error: any) {
    console.error("❌ [LEADERBOARD] Failed:", error);
    return NextResponse.json([]);
  }
}

// Upstash request helper
async function upstashRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const { upstashUrl, upstashToken } = getServerReferralEnv();
  const baseUrl = upstashUrl.endsWith("/") ? upstashUrl.slice(0, -1) : upstashUrl;
  
  const res = await fetch(`${baseUrl}/${path}`, {
    method: init?.method ?? "GET",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${upstashToken}`,
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upstash request failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { result?: T };
  return data.result as T;
}

