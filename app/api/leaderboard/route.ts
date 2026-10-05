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
    // Use sorted set for atomic leaderboard query (single Redis call!)
    const result = await upstashRequest<(string | number)[] | null>('zrevrange/leaderboard/0/-1/WITHSCORES');
    
    if (!result || !Array.isArray(result) || result.length === 0) {
      console.log("ℹ️ [LEADERBOARD] No users in sorted set");
      return NextResponse.json([]);
    }

    // Parse sorted set result: [wallet1, score1, wallet2, score2, ...]
    const leaderboard: LeaderboardRow[] = [];
    for (let i = 0; i < result.length; i += 2) {
      const wallet = String(result[i]);
      const referrals_count = Number(result[i + 1]);
      
      leaderboard.push({
        rank: Math.floor(i / 2) + 1,
        wallet,
        referrals_count,
        rewards: referrals_count * 20,
      });
    }

    console.log(`✅ [LEADERBOARD] Returned ${leaderboard.length} users from sorted set`);
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

