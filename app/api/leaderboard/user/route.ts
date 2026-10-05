import { NextRequest, NextResponse } from "next/server";
import { ensureReferralEnv, getServerReferralEnv } from "../../../config/referral";

type LeaderboardRow = {
  rank: number;
  wallet: string;
  referrals_count: number;
  rewards: number;
};

export const dynamic = "force-dynamic";

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

export async function GET(req: NextRequest) {
  try {
    ensureReferralEnv();
  } catch (error: any) {
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
    // Get user's score from sorted set (atomic operation!)
    let score = await upstashRequest<number | null>(
      `zscore/leaderboard/${encodeURIComponent(wallet)}`
    );
    
    // If user not in sorted set, add them with score 0
    if (score === null) {
      console.log(`ℹ️  [USER RANK] New user ${wallet}, adding to sorted set with score 0`);
      await upstashRequest(`zadd/leaderboard/nx/0/${encodeURIComponent(wallet)}`, {
        method: 'POST'
      });
      score = 0;
    }
    
    const referrals_count = score ?? 0;
    const rewards = referrals_count * 20;
    
    // Get user's rank from sorted set (0-based, so add 1)
    const rankIndex = await upstashRequest<number | null>(
      `zrevrank/leaderboard/${encodeURIComponent(wallet)}`
    );
    
    const rank = rankIndex !== null ? rankIndex + 1 : 0;

    console.log(`✅ [USER RANK] ${wallet}: rank #${rank}, ${referrals_count} referrals`);

    return NextResponse.json({
      rank,
      wallet,
      referrals_count,
      rewards,
    } as LeaderboardRow);
  } catch (error: any) {
    console.error("❌ [USER RANK] Failed:", error);
    return NextResponse.json({
      rank: 0,
      wallet,
      referrals_count: 0,
      rewards: 0,
    } as LeaderboardRow);
  }
}
