import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const walletRegex = /^0x[a-fA-F0-9]{40}$/;

/**
 * STEAM PAGE TASK STATUS ENDPOINT
 * 
 * Reads task completion status from the authoritative KV data model.
 * Uses user:{wallet} -> steam.{task}.completed structure.
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet")?.trim().toLowerCase();
  
  if (!wallet || !walletRegex.test(wallet)) {
    return NextResponse.json({ error: "Missing or invalid wallet address" }, { status: 400 });
  }

  try {
    // Import Upstash functions dynamically
    const { getKey } = await import("../../../../lib/upstash");
    
    const userKey = `user:${wallet}`;
    const userData = await getKey(userKey);
    
    let userObj: any = {};
    if (userData) {
      try {
        userObj = typeof userData === 'string' ? JSON.parse(userData) : userData;
      } catch {
        userObj = {};
      }
    }
    
    // Extract steam task completion status
    const steamData = userObj.steam || {};
    
    // Special handling for fishing task (cooldown-based)
    const fishingData = steamData.fishing || {};
    let fishingStatus = false;
    let fishingCooldown = 0;
    
    if (fishingData.last || fishingData.ts) {
      // Backward compatibility: support both 'last' and 'ts'
      const lastFishingTime = fishingData.last || fishingData.ts || 0;
      const now = Math.floor(Date.now() / 1000);
      const timeSinceLastFishing = now - lastFishingTime;
      const cooldownPeriod = 86400; // 24 hours
      
      if (timeSinceLastFishing >= cooldownPeriod) {
        fishingStatus = false; // Available to fish
        fishingCooldown = 0;
      } else {
        fishingStatus = true; // On cooldown
        fishingCooldown = cooldownPeriod - timeSinceLastFishing;
      }
    }
    
    // Map to the task IDs used in the frontend
    const tasks: Record<string, boolean> = {
      "daily_checkin": fishingStatus, // true = on cooldown, false = available
      "add_miniapp": steamData.add_app?.completed || false,
      "fc_follow": steamData.follow?.completed || false,
      "fc_like_recast": steamData.like_recast?.completed || false,
      "fc_comment": steamData.comment?.completed || false,
      // Other tasks remain false for now
      "referral": false,
      "referral_milestone_5": false,
      "referral_milestone_10": false,
      "referral_milestone_30": false,
      "referral_milestone_50": false,
      "nft_mint": false,
    };
    
    return NextResponse.json({
      wallet,
      tasks,
      fishingCooldown, // Add cooldown info for frontend
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error("Failed to fetch task status:", error);
    return NextResponse.json(
      { error: "Failed to fetch task status" },
      { status: 500 }
    );
  }
}