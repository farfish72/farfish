import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const walletRegex = /^0x[a-fA-F0-9]{40}$/;

/**
 * FISHING DATA MIGRATION ENDPOINT
 * 
 * Migrates existing fishing data from old format to new cooldown format.
 * This is a one-time migration utility for existing users.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const wallet = body.wallet?.trim().toLowerCase();
    
    if (!wallet || !walletRegex.test(wallet)) {
      return NextResponse.json({ error: "Missing or invalid wallet address" }, { status: 400 });
    }

    // Import Upstash functions dynamically
    const { getKey, setKey } = await import("../../../../lib/upstash");
    
    const userKey = `user:${wallet}`;
    
    // Get existing user data
    const userData = await getKey(userKey);
    let userObj: any = {};
    
    if (userData) {
      try {
        userObj = typeof userData === 'string' ? JSON.parse(userData) : userData;
      } catch {
        userObj = {};
      }
    }
    
    // Check if migration is needed
    const fishingData = userObj.steam?.fishing;
    if (!fishingData) {
      return NextResponse.json({
        success: true,
        message: "No fishing data to migrate",
        migrated: false
      });
    }
    
    // Check if already in new format
    if (fishingData.last && !fishingData.completed && !fishingData.ts) {
      return NextResponse.json({
        success: true,
        message: "Already in new format",
        migrated: false
      });
    }
    
    // Migrate from old format
    if (fishingData.completed && fishingData.ts) {
      userObj.steam.fishing = {
        last: fishingData.ts
      };
      
      // Save migrated data
      await setKey(userKey, JSON.stringify(userObj));
      
      return NextResponse.json({
        success: true,
        message: "Migration completed successfully",
        migrated: true,
        oldFormat: { completed: fishingData.completed, ts: fishingData.ts },
        newFormat: { last: fishingData.ts }
      });
    }
    
    return NextResponse.json({
      success: true,
      message: "No migration needed",
      migrated: false
    });
    
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json(
      { error: "Failed to migrate fishing data" },
      { status: 500 }
    );
  }
}