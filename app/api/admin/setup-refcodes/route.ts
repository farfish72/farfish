import { NextRequest, NextResponse } from "next/server";

/**
 * ONE-TIME ADMIN ENDPOINT
 * Creates refcode entries for all existing users in production
 * 
 * Usage:
 * POST /api/admin/setup-refcodes
 * Body: { "secret": "your-secret-here" }
 * 
 * ⚠️ DELETE THIS FILE AFTER RUNNING ONCE!
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes timeout

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { secret } = body;

    // Simple secret protection (set ADMIN_SETUP_SECRET in Vercel env)
    const expectedSecret = process.env.ADMIN_SETUP_SECRET || "farfish-setup-2026";
    
    if (secret !== expectedSecret) {
      return NextResponse.json({ 
        error: "Unauthorized - Invalid secret" 
      }, { status: 401 });
    }

    const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
    const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!UPSTASH_URL || !UPSTASH_TOKEN) {
      return NextResponse.json({ 
        error: "Redis credentials missing" 
      }, { status: 500 });
    }

    const baseUrl = UPSTASH_URL.endsWith("/") ? UPSTASH_URL.slice(0, -1) : UPSTASH_URL;

    async function redisRequest(command: string) {
      const res = await fetch(`${baseUrl}/${command}`, {
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
      });
      const data = await res.json();
      return data.result;
    }

    console.log("[ADMIN SETUP] Starting refcode setup for all users...");

    // Get all referral entries
    const referralKeys = await redisRequest("keys/referral:*");
    const wallets = new Set<string>();

    // Extract all unique wallets
    if (Array.isArray(referralKeys)) {
      for (const key of referralKeys) {
        const wallet = key.replace("referral:", "");
        if (wallet.match(/^0x[a-fA-F0-9]{40}$/i)) {
          wallets.add(wallet.toLowerCase());
          
          // Also get the referrer from this referral
          try {
            const referralData = await redisRequest(`get/${key}`);
            if (referralData) {
              let referrer;
              if (typeof referralData === 'string' && referralData.startsWith('{')) {
                const parsed = JSON.parse(referralData);
                referrer = parsed.referrer;
              } else {
                referrer = referralData;
              }
              
              if (referrer && typeof referrer === 'string' && referrer.match(/^0x[a-fA-F0-9]{40}$/i)) {
                wallets.add(referrer.toLowerCase());
              }
            }
          } catch (e) {
            // Skip invalid entries
          }
        }
      }
    }

    // Also get wallets from leaderboard
    const leaderboardWallets = await redisRequest("zrange/leaderboard/0/-1");
    if (Array.isArray(leaderboardWallets)) {
      leaderboardWallets.forEach((wallet: any) => {
        if (typeof wallet === 'string' && wallet.match(/^0x[a-fA-F0-9]{40}$/i)) {
          wallets.add(wallet.toLowerCase());
        }
      });
    }

    const allWallets = Array.from(wallets);
    console.log(`[ADMIN SETUP] Found ${allWallets.length} unique wallets`);

    let created = 0;
    let alreadyExists = 0;
    let errors = 0;

    // Create refcodes for all users
    for (const wallet of allWallets) {
      const refCode = wallet.slice(-8);
      
      try {
        // Check if exists
        const existing = await redisRequest(`get/refcode:${refCode}`);
        
        if (existing) {
          alreadyExists++;
          continue;
        }

        // Create refcode entry
        await redisRequest(`set/refcode:${refCode}/${wallet}`);
        
        // Initialize in leaderboard if not exists (score 0)
        await fetch(`${baseUrl}/zadd/leaderboard/NX/0/${encodeURIComponent(wallet)}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
        });

        created++;
        console.log(`[ADMIN SETUP] Created refcode ${refCode} for ${wallet.slice(0, 10)}...`);
        
      } catch (error) {
        console.error(`[ADMIN SETUP] Error for ${wallet}:`, error);
        errors++;
      }
    }

    const summary = {
      success: true,
      totalWallets: allWallets.length,
      refcodesCreated: created,
      alreadyExisted: alreadyExists,
      errors,
      timestamp: new Date().toISOString(),
    };

    console.log("[ADMIN SETUP] Complete:", summary);

    return NextResponse.json(summary);

  } catch (error: any) {
    console.error("[ADMIN SETUP] Failed:", error);
    return NextResponse.json({ 
      error: error?.message || "Setup failed" 
    }, { status: 500 });
  }
}
