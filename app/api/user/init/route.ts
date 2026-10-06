import { NextRequest, NextResponse } from "next/server";
import { ensureReferralEnv } from "../../../config/referral";
import { setKey, getKey } from "../../../../lib/upstash";

const walletRegex = /^0x[a-fA-F0-9]{40}$/;

export const dynamic = "force-dynamic";

/**
 * Initialize user in the system - creates refcode cache entry
 * Called automatically when wallet connects
 * 
 * This fixes the "RefCode not found" issue by ensuring every user
 * has a refcode entry as soon as they connect their wallet
 */
export async function POST(req: NextRequest) {
  let body: { wallet: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const wallet = body.wallet?.trim().toLowerCase();

  if (!wallet || !walletRegex.test(wallet)) {
    return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });
  }

  try {
    ensureReferralEnv();
  } catch (error: any) {
    console.error("[USER INIT] Environment validation failed:", error?.message);
    return NextResponse.json({ success: false }, { status: 200 });
  }

  try {
    const refCode = wallet.slice(-8).toLowerCase();

    // Check if refcode already exists (idempotent)
    const existing = await getKey<string>(`refcode:${refCode}`);
    if (existing) {
      return NextResponse.json({ success: true, alreadyExists: true });
    }

    // Create refcode cache entry
    await setKey(`refcode:${refCode}`, wallet);

    // Initialize in sorted set with score 0 (if not exists)
    try {
      const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
      const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
      
      if (upstashUrl && upstashToken) {
        const baseUrl = upstashUrl.endsWith("/") ? upstashUrl.slice(0, -1) : upstashUrl;
        await fetch(`${baseUrl}/zadd/leaderboard/nx/0/${encodeURIComponent(wallet)}`, {
          method: 'POST',
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${upstashToken}`,
          },
        });
      }
    } catch (error) {
      console.error("[USER INIT] Failed to add to sorted set:", error);
      // Continue - refcode is still created
    }

    console.log(`✅ [USER INIT] Created refcode for ${wallet.slice(0, 10)}...${wallet.slice(-6)}`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[USER INIT] Failed:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to initialize user" },
      { status: 500 }
    );
  }
}
